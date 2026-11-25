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
      extra_credits integer NOT NULL CHECK (extra_credits >= 0),
      video_balance integer NOT NULL DEFAULT 0 CHECK (video_balance >= 0),
      plan text NOT NULL DEFAULT 'pro',
      role text NOT NULL DEFAULT 'user'
    );
    CREATE TABLE test_operations (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES test_accounts(id),
      status text NOT NULL,
      result text
    );
    CREATE TABLE test_video_requests (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES test_accounts(id),
      status text NOT NULL DEFAULT 'processing',
      result text
    );
    CREATE TABLE test_video_ledger (
      id bigserial PRIMARY KEY,
      operation_id text NOT NULL UNIQUE REFERENCES test_video_requests(id),
      amount integer NOT NULL CHECK (amount = -1)
    );
    CREATE TABLE test_ledger (
      id bigserial PRIMARY KEY,
      operation_id text NOT NULL UNIQUE REFERENCES test_operations(id),
      amount integer NOT NULL CHECK (amount < 0)
    );
    INSERT INTO test_accounts (id, credits, extra_credits, video_balance)
      VALUES ('test-user', 10, 5, 2), ('other-user', 100, 0, 3);
    INSERT INTO test_operations VALUES ('request-1', 'test-user', 'pending', NULL);
    INSERT INTO test_operations VALUES ('request-2', 'test-user', 'pending', NULL);
    INSERT INTO test_operations VALUES ('request-3', 'test-user', 'pending', NULL);
    INSERT INTO test_video_requests (id, user_id) VALUES
      ('video-a', 'test-user'), ('video-b', 'test-user');
  `);
});
after(async () => { await pool.end(); });

async function charge({ operation, cost, failAfterDebit = false }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT credits, extra_credits, plan, role FROM test_accounts WHERE id=$1 FOR UPDATE",
      ["test-user"]);
    const record = locked.rows[0];
    const pending = await client.query("SELECT status FROM test_operations WHERE id=$1 AND user_id=$2", [operation, "test-user"]);
    if (pending.rows[0]?.status === "complete") { await client.query("ROLLBACK"); return "duplicate"; }
    if (record.role !== "admin" && !["pro", "business", "agency"].includes(record.plan)) { await client.query("ROLLBACK"); return "plan_required"; }
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

test("downgrading an account during generation prevents final debit", async () => {
  await pool.query("UPDATE test_accounts SET plan='free' WHERE id='test-user'");
  assert.equal(await charge({ operation:"request-3", cost:1 }), "plan_required");
  const balance = await pool.query("SELECT credits,extra_credits FROM test_accounts WHERE id='test-user'");
  assert.deepEqual(balance.rows[0], { credits: 0, extra_credits: 0 });
  const operation = await pool.query("SELECT status FROM test_operations WHERE id='request-3'");
  assert.equal(operation.rows[0].status, "pending");
  const ledger = await pool.query("SELECT count(*)::int AS count FROM test_ledger");
  assert.equal(ledger.rows[0].count, 2);
});

async function collectVideo({ operation, failAfterDebit = false }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT video_balance,plan,role FROM test_accounts WHERE id='test-user' FOR UPDATE");
    const account = result.rows[0];
    const record = await client.query(
      "SELECT status FROM test_video_requests WHERE id=$1 AND user_id='test-user'",
      [operation]);
    if (record.rows[0]?.status === "complete") {
      await client.query("ROLLBACK");
      return "already_delivered";
    }
    if (!account || (account.role !== "admin" && !["pro","business","agency"].includes(account.plan))) {
      await client.query("ROLLBACK");
      return "plan_required";
    }
    if (account.video_balance < 1) {
      await client.query("ROLLBACK");
      return "no_video_balance";
    }
    const saved = await client.query(
      "UPDATE test_video_requests SET status='complete', result=$2 WHERE id=$1 AND user_id='test-user' AND status='processing' RETURNING id",
      [operation, JSON.stringify({ videoUrl:"https://example.invalid/video.mp4" })]);
    if (!saved.rowCount) { await client.query("ROLLBACK"); return "not_ready"; }
    await client.query(
      "UPDATE test_accounts SET video_balance=video_balance-1 WHERE id='test-user'");
    if (failAfterDebit) throw Error("simulated provider delivery ledger failure");
    await client.query("INSERT INTO test_video_ledger (operation_id,amount) VALUES ($1,-1)", [operation]);
    await client.query("COMMIT");
    return "delivered";
  } catch (error) {
    await client.query("ROLLBACK");
    if (failAfterDebit) return "rolled_back";
    throw error;
  } finally { client.release(); }
}

test("two simultaneous video collection attempts debit just once", async () => {
  const [a,b] = await Promise.all([
    collectVideo({operation:"video-a"}),
    collectVideo({operation:"video-a"})
  ]);
  assert.deepEqual([a,b].sort(), ["already_delivered","delivered"]);
  const user = await pool.query("SELECT video_balance FROM test_accounts WHERE id='test-user'");
  assert.equal(user.rows[0].video_balance, 1);
  const ledgers = await pool.query("SELECT count(*)::int AS n FROM test_video_ledger");
  assert.equal(ledgers.rows[0].n, 1);
});

test("video saving/debit/ledger rollback together; no second charge on retry", async () => {
  assert.equal(await collectVideo({operation:"video-b",failAfterDebit:true}), "rolled_back");
  const pending = await pool.query("SELECT status FROM test_video_requests WHERE id='video-b'");
  assert.equal(pending.rows[0].status, "processing");
  const user = await pool.query("SELECT video_balance FROM test_accounts WHERE id='test-user'");
  assert.equal(user.rows[0].video_balance, 1);
  assert.equal(await collectVideo({operation:"video-b"}), "delivered");
  assert.equal(await collectVideo({operation:"video-b"}), "already_delivered");
  const ledgers = await pool.query("SELECT count(*)::int AS n FROM test_video_ledger");
  assert.equal(ledgers.rows[0].n, 2);
});

test("video delivery is denied after account plan downgrade", async () => {
  await pool.query("INSERT INTO test_video_requests (id,user_id) VALUES ('video-c','test-user')");
  await pool.query("UPDATE test_accounts SET plan='free', video_balance=1 WHERE id='test-user'");
  assert.equal(await collectVideo({operation:"video-c"}), "plan_required");
  const row = await pool.query("SELECT video_balance FROM test_accounts WHERE id='test-user'");
  assert.equal(row.rows[0].video_balance, 1);
  const status = await pool.query("SELECT status FROM test_video_requests WHERE id='video-c'");
  assert.equal(status.rows[0].status, "processing");
});
