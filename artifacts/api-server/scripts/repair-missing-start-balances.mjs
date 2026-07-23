import { createRequire } from "node:module";
import Stripe from "stripe";

const CONFIRMATION = "CONFIRMAR_REPARO_START_DIRETORIA";
const emailArg = process.argv.find((arg) => arg.startsWith("--email="));
const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm="));
const email = emailArg?.slice("--email=".length).trim().toLowerCase();
const confirmation = confirmArg?.slice("--confirm=".length).trim();

if (!email || confirmation !== CONFIRMATION) {
  console.error(`Uso: node artifacts/api-server/scripts/repair-missing-start-balances.mjs --email=usuario@dominio.com --confirm=${CONFIRMATION}`);
  process.exit(2);
}

if (email !== "diretoria.protegnv@gmail.com") {
  throw new Error("Este reparo está restrito à conta diretoria.protegnv@gmail.com");
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY não configurada");

const requireFromDb = createRequire("/app/lib/db/package.json");
const { Pool } = requireFromDb("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const client = await pool.connect();
try {
  await client.query("BEGIN");

  const userResult = await client.query(
    `select id, clerk_id, email, plan, credits, creative_credits, extra_credits,
            extra_creative_credits, video_balance, stripe_customer_id,
            stripe_subscription_id, stripe_subscription_status
       from users
      where lower(email) = $1
      for update`,
    [email],
  );

  const user = userResult.rows[0];
  if (!user) throw new Error("Usuário não encontrado");
  if (user.plan !== "pro") throw new Error(`Plano inesperado: ${user.plan}`);
  if (user.stripe_subscription_status !== "active") {
    throw new Error(`Assinatura não está ativa: ${user.stripe_subscription_status}`);
  }
  if (!user.stripe_customer_id || !user.stripe_subscription_id) {
    throw new Error("Vínculo Stripe incompleto");
  }
  if (Number(user.credits) !== 0 || Number(user.creative_credits) !== 0) {
    throw new Error("Saldos do plano não estão zerados; reparo abortado");
  }

  const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    throw new Error(`Assinatura Stripe não está ativa: ${subscription.status}`);
  }
  if (subscription.customer !== user.stripe_customer_id) {
    throw new Error("Assinatura Stripe não pertence ao cliente esperado");
  }
  if (subscription.metadata?.planKey !== "pro") {
    throw new Error(`Plano Stripe inesperado: ${subscription.metadata?.planKey ?? "ausente"}`);
  }

  await client.query(
    `update users
        set credits = 20,
            creative_credits = 40,
            updated_at = now()
      where id = $1`,
    [user.id],
  );

  await client.query(
    `insert into credits_transactions
      (clerk_user_id, amount, type, balance_type, description, balance_before, balance_after, created_at)
     values
      ($1, 20, 'credit', 'general', 'Reparo de ativação START — créditos gerais não concedidos', 0, 20, now()),
      ($1, 40, 'credit', 'creative', 'Reparo de ativação START — créditos de imagem não concedidos', 0, 40, now())`,
    [user.clerk_id],
  );

  await client.query("COMMIT");

  console.log(JSON.stringify({
    mode: "executed",
    email,
    plan: "pro",
    creditsBefore: 0,
    creditsAfter: 20,
    creativeCreditsBefore: 0,
    creativeCreditsAfter: 40,
    extraCreditsPreserved: Number(user.extra_credits),
    extraCreativeCreditsPreserved: Number(user.extra_creative_credits),
    videoBalancePreserved: Number(user.video_balance),
    subscriptionId: user.stripe_subscription_id,
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
