-- PROPOSTA NAO EXECUTAVEL DE MIGRACAO POSTGRESQL. NAO APLICAR NA PRODUCAO.
BEGIN;
CREATE TABLE IF NOT EXISTS commercial_guest_checkout_claims (
 id bigserial PRIMARY KEY, registration_id text NOT NULL UNIQUE,
 stripe_checkout_session_id text NOT NULL UNIQUE,
 stripe_subscription_id text NOT NULL UNIQUE, stripe_customer_id text NOT NULL UNIQUE,
 stripe_invoice_id text NOT NULL, clerk_user_id text NOT NULL UNIQUE,
 commercial_plan text NOT NULL CHECK (commercial_plan IN ('START','PREMIUM','PRO')),
 internal_plan text NOT NULL CHECK (internal_plan IN ('pro','business','agency')),
 price_id text NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','LEASED','RETRYABLE','DONE','MANUAL_REVIEW')),
 lease_token uuid,lease_until timestamptz, attempt_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- UNIQUE por Clerk e Customer privilegia seguranca de primeira compra guest;
-- renovações/upgrades seguem em outro fluxo; revisar antes de implementar.
ROLLBACK; -- SEGURANCA: nao deixa mudanca no banco mesmo se executado.