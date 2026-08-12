import fs from "node:fs/promises";
import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_not_configured");

const oneTimeRouteUrl = new URL(
  "../../../artifacts/api-server/src/routes/googlePlayBilling.ts",
  import.meta.url,
);
const subscriptionRouteUrl = new URL(
  "../../../artifacts/api-server/src/routes/googlePlaySubscriptionEntitlements.ts",
  import.meta.url,
);
const migrationUrl = new URL("../drizzle/0001_google_play_purchases.sql", import.meta.url);

const [oneTimeSource, subscriptionSource, migrationSql] = await Promise.all([
  fs.readFile(oneTimeRouteUrl, "utf8"),
  fs.readFile(subscriptionRouteUrl, "utf8"),
  fs.readFile(migrationUrl, "utf8"),
]);

function expectSource(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`source_contract_missing:${label}`);
}

// Contratos comerciais precisam permanecer alinhados ao código real das rotas.
for (const [fragment, label] of [
  ['creditos_100: { type: "credits", quantity: 100, grantAmount: 100 }', "creditos_100"],
  ['imagens_10: { type: "images", quantity: 10, grantAmount: 100 }', "imagens_10"],
  ['videos_10: { type: "videos", quantity: 10, grantAmount: 10 }', "videos_10"],
]) expectSource(oneTimeSource, fragment, label);

for (const [fragment, label] of [
  ['iattom_start:', "iattom_start"],
  ['internalPlan: "pro"', "start_internal_plan"],
  ['monthlyCredits: 200', "start_monthly_credits"],
  ['monthlyBasePlanId: "start-mensal"', "start_monthly_base_plan"],
  ['annualBasePlanId: "start-anual"', "start_annual_base_plan"],
  ['iattom_premium:', "iattom_premium"],
  ['internalPlan: "business"', "premium_internal_plan"],
  ['monthlyCredits: 500', "premium_monthly_credits"],
  ['monthlyBasePlanId: "premium-mensal"', "premium_monthly_base_plan"],
  ['annualBasePlanId: "premium-anual"', "premium_annual_base_plan"],
  ['iattom_pro:', "iattom_pro"],
  ['internalPlan: "agency"', "pro_internal_plan"],
  ['monthlyCredits: 1000', "pro_monthly_credits"],
  ['monthlyBasePlanId: "pro-mensal"', "pro_monthly_base_plan"],
  ['annualBasePlanId: "pro-anual"', "pro_annual_base_plan"],
  ['const multiplier = isAnnual ? 12 : 1', "annual_multiplier"],
  ['const eventKey = `subscription:${purchaseToken}:${periodIdentity}`', "subscription_event_key"],
]) expectSource(subscriptionSource, fragment, label);

const client = new Client({ connectionString: databaseUrl });
await client.connect();

async function beginCleanSchema() {
  await client.query("BEGIN");
  await client.query(`
    CREATE TABLE users (
      id serial PRIMARY KEY,
      clerk_id text UNIQUE NOT NULL,
      plan text NOT NULL DEFAULT 'free',
      credits integer NOT NULL DEFAULT 0,
      extra_credits integer NOT NULL DEFAULT 0,
      extra_creative_credits integer NOT NULL DEFAULT 0,
      video_balance integer NOT NULL DEFAULT 0,
      plan_selected boolean NOT NULL DEFAULT false
    );
  `);
  await client.query(`
    CREATE TABLE credits_transactions (
      id serial PRIMARY KEY,
      clerk_user_id text NOT NULL,
      amount integer NOT NULL,
      type text NOT NULL,
      balance_type text,
      description text NOT NULL,
      balance_before integer NOT NULL,
      balance_after integer NOT NULL
    );
  `);
  await client.query(`
    CREATE TABLE video_transactions (
      id serial PRIMARY KEY,
      clerk_user_id text NOT NULL,
      amount integer NOT NULL,
      type text NOT NULL,
      pack_id text,
      description text NOT NULL,
      balance_before integer NOT NULL,
      balance_after integer NOT NULL
    );
  `);
  await client.query(migrationSql);
  await client.query(`
    INSERT INTO users (clerk_id) VALUES ('user-a'), ('user-b');
  `);
}

async function grantOneTime({ userId, token, productId, type, amount }) {
  const eventKey = `one-time:${token}`;
  await client.query("SAVEPOINT one_time_grant");
  try {
    const inserted = await client.query(
      `INSERT INTO google_play_purchases (
        event_key, purchase_token, clerk_user_id, product_id, product_type,
        entitlement_type, entitlement_amount, google_state
      ) VALUES ($1,$2,$3,$4,'one_time',$5,$6,'PURCHASED')
      ON CONFLICT (event_key) DO NOTHING
      RETURNING id`,
      [eventKey, token, userId, productId, type, amount],
    );
    if (inserted.rowCount === 0) {
      await client.query("RELEASE SAVEPOINT one_time_grant");
      return false;
    }

    if (type === "credits") {
      await client.query(`UPDATE users SET extra_credits = extra_credits + $1 WHERE clerk_id = $2`, [amount, userId]);
    } else if (type === "images") {
      await client.query(`UPDATE users SET extra_creative_credits = extra_creative_credits + $1 WHERE clerk_id = $2`, [amount, userId]);
    } else if (type === "videos") {
      await client.query(`UPDATE users SET video_balance = video_balance + $1 WHERE clerk_id = $2`, [amount, userId]);
    } else {
      throw new Error(`unknown_one_time_type:${type}`);
    }
    await client.query("RELEASE SAVEPOINT one_time_grant");
    return true;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT one_time_grant");
    await client.query("RELEASE SAVEPOINT one_time_grant");
    throw error;
  }
}

async function grantSubscription({ userId, token, period, productId, basePlanId, plan, amount }) {
  const eventKey = `subscription:${token}:${period}`;
  await client.query("SAVEPOINT subscription_grant");
  try {
    const owner = await client.query(
      `SELECT clerk_user_id FROM google_play_purchases WHERE purchase_token = $1 LIMIT 1`,
      [token],
    );
    if (owner.rows[0] && owner.rows[0].clerk_user_id !== userId) {
      throw new Error("google_subscription_owned_by_another_user");
    }

    const inserted = await client.query(
      `INSERT INTO google_play_purchases (
        event_key, purchase_token, clerk_user_id, product_id, product_type,
        base_plan_id, entitlement_type, entitlement_amount, internal_plan,
        google_state
      ) VALUES ($1,$2,$3,$4,'subscription',$5,'plan_credits',$6,$7,'SUBSCRIPTION_STATE_ACTIVE')
      ON CONFLICT (event_key) DO NOTHING
      RETURNING id`,
      [eventKey, token, userId, productId, basePlanId, amount, plan],
    );
    if (inserted.rowCount === 0) {
      await client.query("RELEASE SAVEPOINT subscription_grant");
      return false;
    }

    await client.query(
      `UPDATE users
       SET plan = $1, credits = credits + $2, plan_selected = true
       WHERE clerk_id = $3`,
      [plan, amount, userId],
    );
    await client.query("RELEASE SAVEPOINT subscription_grant");
    return true;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT subscription_grant");
    await client.query("RELEASE SAVEPOINT subscription_grant");
    throw error;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}:expected_${expected}:got_${actual}`);
}

try {
  await beginCleanSchema();

  // Produtos avulsos: concede uma única vez.
  assertEqual(await grantOneTime({ userId: "user-a", token: "credits-token", productId: "creditos_100", type: "credits", amount: 100 }), true, "credits_first_grant");
  assertEqual(await grantOneTime({ userId: "user-a", token: "credits-token", productId: "creditos_100", type: "credits", amount: 100 }), false, "credits_replay");
  assertEqual(await grantOneTime({ userId: "user-a", token: "images-token", productId: "imagens_10", type: "images", amount: 100 }), true, "images_first_grant");
  assertEqual(await grantOneTime({ userId: "user-a", token: "videos-token", productId: "videos_10", type: "videos", amount: 10 }), true, "videos_first_grant");

  let balances = await client.query(`SELECT extra_credits, extra_creative_credits, video_balance FROM users WHERE clerk_id='user-a'`);
  assertEqual(balances.rows[0].extra_credits, 100, "credits_balance");
  assertEqual(balances.rows[0].extra_creative_credits, 100, "images_balance");
  assertEqual(balances.rows[0].video_balance, 10, "videos_balance");

  // START mensal e anual em usuários/tokens separados para validar franquias exatas.
  assertEqual(await grantSubscription({ userId: "user-a", token: "start-monthly-token", period: "order-start-m-1", productId: "iattom_start", basePlanId: "start-mensal", plan: "pro", amount: 200 }), true, "start_monthly_first");
  assertEqual(await grantSubscription({ userId: "user-a", token: "start-monthly-token", period: "order-start-m-1", productId: "iattom_start", basePlanId: "start-mensal", plan: "pro", amount: 200 }), false, "start_monthly_replay");
  assertEqual(await grantSubscription({ userId: "user-a", token: "start-annual-token", period: "order-start-a-1", productId: "iattom_start", basePlanId: "start-anual", plan: "pro", amount: 2400 }), true, "start_annual_first");

  // PREMIUM e PRO anual/mensal.
  assertEqual(await grantSubscription({ userId: "user-a", token: "premium-monthly-token", period: "order-premium-m-1", productId: "iattom_premium", basePlanId: "premium-mensal", plan: "business", amount: 500 }), true, "premium_monthly_first");
  assertEqual(await grantSubscription({ userId: "user-a", token: "premium-annual-token", period: "order-premium-a-1", productId: "iattom_premium", basePlanId: "premium-anual", plan: "business", amount: 6000 }), true, "premium_annual_first");
  assertEqual(await grantSubscription({ userId: "user-a", token: "pro-monthly-token", period: "order-pro-m-1", productId: "iattom_pro", basePlanId: "pro-mensal", plan: "agency", amount: 1000 }), true, "pro_monthly_first");
  assertEqual(await grantSubscription({ userId: "user-a", token: "pro-annual-token", period: "order-pro-a-1", productId: "iattom_pro", basePlanId: "pro-anual", plan: "agency", amount: 12000 }), true, "pro_annual_first");

  // Renovação legítima: mesmo token, período novo, nova franquia uma única vez.
  assertEqual(await grantSubscription({ userId: "user-a", token: "renew-token", period: "order-renew-1", productId: "iattom_start", basePlanId: "start-mensal", plan: "pro", amount: 200 }), true, "renew_period_1");
  assertEqual(await grantSubscription({ userId: "user-a", token: "renew-token", period: "order-renew-2", productId: "iattom_start", basePlanId: "start-mensal", plan: "pro", amount: 200 }), true, "renew_period_2");
  assertEqual(await grantSubscription({ userId: "user-a", token: "renew-token", period: "order-renew-2", productId: "iattom_start", basePlanId: "start-mensal", plan: "pro", amount: 200 }), false, "renew_period_2_replay");

  // Mesmo token não pode migrar para outro usuário.
  let crossUserBlocked = false;
  try {
    await grantSubscription({ userId: "user-b", token: "renew-token", period: "order-renew-3", productId: "iattom_start", basePlanId: "start-mensal", plan: "pro", amount: 200 });
  } catch (error) {
    crossUserBlocked = error?.message === "google_subscription_owned_by_another_user";
  }
  assertEqual(crossUserBlocked, true, "cross_user_token_block");

  balances = await client.query(`SELECT credits FROM users WHERE clerk_id='user-a'`);
  // 200 + 2400 + 500 + 6000 + 1000 + 12000 + 200 + 200 = 22500
  assertEqual(balances.rows[0].credits, 22500, "subscription_total_balance");

  const ledger = await client.query(`SELECT COUNT(*)::int AS total FROM google_play_purchases`);
  // 3 avulsos + 8 eventos de assinatura efetivamente concedidos.
  assertEqual(ledger.rows[0].total, 11, "ledger_event_count");

  await client.query("ROLLBACK");
  console.log("GOOGLE_PLAY_ENTITLEMENT_TEST=SUCCESS");
} catch (error) {
  try { await client.query("ROLLBACK"); } catch {}
  throw error;
} finally {
  await client.end();
}
