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

CREATE INDEX IF NOT EXISTS "google_play_purchases_token_idx"
  ON "google_play_purchases" ("purchase_token");

CREATE INDEX IF NOT EXISTS "google_play_purchases_user_idx"
  ON "google_play_purchases" ("clerk_user_id");
