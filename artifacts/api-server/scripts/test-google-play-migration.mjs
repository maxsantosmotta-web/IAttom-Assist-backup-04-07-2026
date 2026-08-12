import fs from "node:fs/promises";
import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL_not_configured");
}

const migrationPath = new URL(
  "../../../lib/db/drizzle/0001_google_play_purchases.sql",
  import.meta.url,
);
const migrationSql = await fs.readFile(migrationPath, "utf8");

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("BEGIN");

  await client.query(`
    CREATE TABLE users (
      id serial PRIMARY KEY,
      clerk_id text UNIQUE NOT NULL,
      credits integer DEFAULT 0 NOT NULL
    );
  `);

  await client.query(`
    INSERT INTO users (clerk_id, credits)
    VALUES ('migration-sentinel-user', 777);
  `);

  await client.query(migrationSql);
  await client.query(migrationSql);

  const tableCheck = await client.query(`
    SELECT to_regclass('public.google_play_purchases') AS table_name;
  `);
  if (tableCheck.rows[0]?.table_name !== "google_play_purchases") {
    throw new Error("google_play_purchases_table_missing");
  }

  const columns = await client.query(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'google_play_purchases';
  `);

  const requiredColumns = new Set([
    "event_key",
    "purchase_token",
    "clerk_user_id",
    "product_id",
    "product_type",
    "entitlement_type",
    "entitlement_amount",
    "google_state",
  ]);
  const actualColumns = new Set(columns.rows.map((row) => row.column_name));
  for (const column of requiredColumns) {
    if (!actualColumns.has(column)) {
      throw new Error(`required_column_missing:${column}`);
    }
  }

  const indexes = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'google_play_purchases';
  `);
  const indexNames = new Set(indexes.rows.map((row) => row.indexname));
  for (const indexName of [
    "google_play_purchases_token_idx",
    "google_play_purchases_user_idx",
  ]) {
    if (!indexNames.has(indexName)) {
      throw new Error(`required_index_missing:${indexName}`);
    }
  }

  await client.query(`
    INSERT INTO google_play_purchases (
      event_key,
      purchase_token,
      clerk_user_id,
      product_id,
      product_type,
      entitlement_type,
      entitlement_amount,
      google_state
    ) VALUES (
      'migration-test:event-1',
      'migration-test:token-1',
      'migration-sentinel-user',
      'creditos_100',
      'one_time',
      'credits',
      100,
      'PURCHASED'
    );
  `);

  let uniqueConstraintWorked = false;
  try {
    await client.query(`
      INSERT INTO google_play_purchases (
        event_key,
        purchase_token,
        clerk_user_id,
        product_id,
        product_type,
        entitlement_type,
        entitlement_amount,
        google_state
      ) VALUES (
        'migration-test:event-1',
        'migration-test:token-2',
        'migration-sentinel-user',
        'creditos_100',
        'one_time',
        'credits',
        100,
        'PURCHASED'
      );
    `);
  } catch (error) {
    if (error?.code === "23505") uniqueConstraintWorked = true;
    else throw error;
  }

  if (!uniqueConstraintWorked) {
    throw new Error("event_key_unique_constraint_not_enforced");
  }

  const sentinel = await client.query(`
    SELECT credits
    FROM users
    WHERE clerk_id = 'migration-sentinel-user';
  `);
  if (sentinel.rows[0]?.credits !== 777) {
    throw new Error("existing_table_was_modified");
  }

  await client.query("ROLLBACK");
  console.log("GOOGLE_PLAY_MIGRATION_TEST=SUCCESS");
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {}
  throw error;
} finally {
  await client.end();
}
