import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import pg from "pg";

const { Pool } = pg;
const ci = process.env.CI === "true";
const url = process.env.CHATGPT_CI_POSTGRES_URL;
if (!ci || !url) throw new Error("Ephemeral CI Postgres URL required; Railway is never a test target");
const target = new URL(url);
if (!["127.0.0.1", "localhost"].includes(target.hostname) ||
    target.pathname !== "/chatgpt_ci_test" || target.port !== "5432") {
  throw new Error("Only disposable localhost CI database is allowed");
}
const pool = new Pool({ connectionString: url, max: 6 });

before(async () => {
  await pool.query(`
    CREATE TABLE test_accounts (
      id text PRIMARY KEY,
      credits integer NOT NULL CHECK (credits >= 0),
      extra_credits integer NOT NULL CHECK (extra_credits >= 0)
    );
    CREATE TABLE test_operations (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES test_accounts(id),
      status text NOT NULL,
      result text
    );
    CREATE TABLE test_ledger (
      id bigserial PRIMARY KEY,
      operation_id text NOT NULL UNIQUE REFERENCES test_operations(id),
      amount integer NOT NULL CHECK (amount < 0)
    );
    INSERT INTO test_accounts VALUES ('test-user', 10, 5), ('other-user', 100, 0);
    INSERT INTO test_operations VALUES ('request-1', 'test-user', 'pending', NULL);
    INSERT INTO test_operations VALUES ('request-2', 'test-user', 'pending', NULL);
  `);
});
after(async () => { await pool.end(); });

async function charge({ operation, cost, failAfterDebit = false }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT credits, extra_credits FROM test_accounts WHERE id=$1 FOR UPDATE",
      ["test-user"]);
    const record = locked.rows[0];
    const pending = await client.query("SELECT status FROM test_operations WHERE id=$1 AND user_id=$2", [operation, "test-user"]);
    if (pending.rows[0]?.status === "complete") { await client.query("ROLLBACK"); return "duplicate"; }
    const balance = record.credits + record.extra_credits;
    if (balance < cost) { await client.query("ROLLBACK"); return "insufficient"; }
    const current = await client.query(
      "UPDATE test_operations SET status='complete', result=$2 WHERE id=$1 AND user_id=$3 AND status='pending' RETURNING id",
      [operation, JSON.stringify({ delivered: true }), "test-user"]);
    if (!current.rowCount) { await client.query("ROLLBACK"); return "duplicate"; }
    const fromPlan = Math.min(cost, record.credits);
    await client.query("UPDATE test_accounts SET credits=$2, extra_credits=$3 WHERE id=$1",
      ["test-user", record.credits - fromPlan, record.extra_credits - (cost - fromPlan)]);
    if (failAfterDebit) throw new Error("Simulated failure before ledger commit");
    await client.query("INSERT INTO test_ledger (operation_id,amount) VALUES ($1,$2)",
      [operation, -cost]);
    await client.query("COMMIT");
    return "charged";
  } catch (error) {
    await client.query("ROLLBACK");
    if (failAfterDebit) return "rolled_back";
    throw error;
  } finally {
    client.release();
  }
}

test("concurrent requests serialize debit and reject duplicate operation", async () => {
  const results = await Promise.all([
    charge({ operation:"request-1", cost:10 }),
    charge({ operation:"request-1", cost:10 })
  ]);
  assert.deepEqual(results.sort(), ["charged", "duplicate"]);
  const balance = await pool.query("SELECT credits,extra_credits FROM test_accounts WHERE id='test-user'");
  assert.deepEqual(balance.rows[0], { credits: 0, extra_credits: 5 });
  const ledger = await pool.query("SELECT amount FROM test_ledger WHERE operation_id='request-1'");
  assert.equal(ledger.rowCount, 1);
  assert.equal(ledger.rows[0].amount, -10);
});

test("insufficient balance leaves operation pending and ledger unchanged", async () => {
  assert.equal(await charge({ operation:"request-2", cost:6 }), "insufficient");
  const state = await pool.query("SELECT status FROM test_operations WHERE id='request-2'");
  assert.equal(state.rows[0].status, "pending");
  const ledger = await pool.query("SELECT count(*)::int AS total FROM test_ledger");
  assert.equal(ledger.rows[0].total, 1);
});

test("simulated failure rolls back debit, save and ledger in PostgreSQL", async () => {
  assert.equal(await charge({ operation:"request-2", cost:5, failAfterDebit:true }), "rolled_back");
  const state = await pool.query("SELECT status FROM test_operations WHERE id='request-2'");
  assert.equal(state.rows[0].status, "pending");
  const balance = await pool.query("SELECT credits,extra_credits FROM test_accounts WHERE id='test-user'");
  assert.deepEqual(balance.rows[0], { credits: 0, extra_credits: 5 });
  assert.equal(await charge({ operation:"request-2", cost:5 }), "charged");
  const final = await pool.query("SELECT credits,extra_credits FROM test_accounts WHERE id='test-user'");
  assert.deepEqual(final.rows[0], { credits: 0, extra_credits: 0 });
  const tx = await pool.query("SELECT count(*)::int AS total FROM test_ledger");
  assert.equal(tx.rows[0].total, 2);
});

test("different account cannot modify another account's saved operation", async () => {
  const attempted = await pool.query(
    "UPDATE test_operations SET status='complete' WHERE id=$1 AND user_id=$2 RETURNING id",
    ["request-2", "other-user"]);
  assert.equal(attempted.rowCount, 0);
});
