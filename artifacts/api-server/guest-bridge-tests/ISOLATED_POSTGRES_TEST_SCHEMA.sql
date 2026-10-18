-- ONLY FOR EMBEDDED POSTGRESQL ENGINE TESTS IN AN ISOLATED TEMPORARY DATABASE.
-- NOT A PRODUCTION MIGRATION. Never run against IAttom Assist's DATABASE_URL.
-- Tables intentionally prefixed guest_test_ and do not refer to real users.
CREATE TABLE IF NOT EXISTS guest_test_users (
  clerk_id TEXT PRIMARY KEY,
  verified_primary_email TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','pro','business','agency')),
  general_credits INTEGER NOT NULL DEFAULT 0 CHECK (general_credits >= 0)
);
CREATE TABLE IF NOT EXISTS guest_test_paid_purchases (
  session_id TEXT PRIMARY KEY CHECK (session_id LIKE 'cs_live_%'),
  subscription_id TEXT NOT NULL UNIQUE CHECK (subscription_id LIKE 'sub_%'),
  customer_id TEXT NOT NULL CHECK (customer_id LIKE 'cus_%'),
  registration_id UUID NOT NULL,
  price_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('START','PREMIUM','PRO')),
  internal_plan TEXT NOT NULL CHECK (internal_plan IN ('pro','business','agency')),
  promised_general_credits INTEGER NOT NULL CHECK (promised_general_credits > 0),
  -- True only after mock verified-Stripe evidence; schema alone cannot verify Stripe.
  server_paid_verified BOOLEAN NOT NULL CHECK (server_paid_verified = true),
  clerk_id TEXT REFERENCES guest_test_users(clerk_id),
  state TEXT NOT NULL DEFAULT 'PAID_UNLINKED' CHECK
    (state IN ('PAID_UNLINKED','READY','COMPLETED','MANUAL_REVIEW')),
  CHECK ((state = 'PAID_UNLINKED' AND clerk_id IS NULL)
      OR state <> 'PAID_UNLINKED')
);
CREATE TABLE IF NOT EXISTS guest_test_general_grants (
  grant_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES guest_test_paid_purchases(session_id),
  subscription_id TEXT NOT NULL,
  clerk_id TEXT NOT NULL REFERENCES guest_test_users(clerk_id),
  price_id TEXT NOT NULL,
  period_start BIGINT NOT NULL,
  period_end BIGINT NOT NULL,
  general_credits INTEGER NOT NULL CHECK (general_credits > 0),
  balance_type TEXT NOT NULL CHECK (balance_type = 'general'),
  CHECK (period_end > period_start),
  UNIQUE (subscription_id,price_id,period_start,period_end,balance_type)
);
