import { pool } from "@workspace/db";

export async function ensureGooglePlayLedger(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "google_play_purchases" (
      "id" serial PRIMARY KEY NOT NULL,
      "event_key" text NOT NULL UNIQUE,
      "purchase_token" text NOT NULL,
      "clerk_user_id" text NOT NULL,
      "product_id" text NOT NULL,
      "product_type" text NOT NULL,
      "base_plan_id" text,
      "order_id" text,
      "entitlement_type" text NOT NULL,
      "entitlement_amount" integer DEFAULT 0 NOT NULL,
      "internal_plan" text,
      "google_state" text NOT NULL,
      "expiry_time" timestamp,
      "processed_at" timestamp DEFAULT now() NOT NULL,
      "acknowledged_at" timestamp,
      "consumed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS "google_play_purchases_token_idx"
      ON "google_play_purchases" ("purchase_token");
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS "google_play_purchases_user_idx"
      ON "google_play_purchases" ("clerk_user_id");
  `);

  const check = await pool.query<{ table_name: string | null }>(
    `SELECT to_regclass('public.google_play_purchases')::text AS table_name`,
  );

  if (check.rows[0]?.table_name !== "google_play_purchases") {
    throw new Error("google_play_purchases_table_not_ready");
  }
}
