-- PROPOSTA REVISAO ISOLADA, NUNCA EXECUTAR NA PRODUCAO SEM AUTORIZACAO.
-- Tabela exclusiva das compras da landing. Nao altera usuarios, boletos, planos ou saldos.
BEGIN;
CREATE TABLE IF NOT EXISTS commercial_guest_claims (
  checkout_session_id text PRIMARY KEY,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  stripe_invoice_id text NOT NULL,
  registration_id uuid NOT NULL,
  price_id text NOT NULL,
  commercial_plan text NOT NULL CHECK (commercial_plan IN ('START','PREMIUM','PRO')),
  checkout_created_at bigint NOT NULL CHECK (checkout_created_at > 0),
  pre_registration_issued_at bigint NOT NULL CHECK (pre_registration_issued_at > 0),
  pre_registration_proof text NOT NULL CHECK (pre_registration_proof ~ '^[a-f0-9]{64}$'),
  plan_key text NOT NULL CHECK (plan_key IN ('pro','business','agency')),
  general_credit_amount integer NOT NULL CHECK (general_credit_amount > 0),
  billing_period_start bigint NOT NULL,
  billing_period_end bigint NOT NULL,
  clerk_user_id text REFERENCES users(clerk_id),
  status text NOT NULL DEFAULT 'PAID_UNLINKED' CHECK
    (status IN ('PAID_UNLINKED','READY','PROCESSING','RETRYABLE','COMPLETED','REVIEW')),
  lease_token text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (billing_period_end > billing_period_start),
  CHECK ((status <> 'PAID_UNLINKED') OR clerk_user_id IS NULL),
  CHECK (status <> 'COMPLETED' OR clerk_user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS commercial_guest_claims_clerk_idx
 ON commercial_guest_claims(clerk_user_id);
COMMIT;
