import Stripe from "stripe";
import { pool } from "@workspace/db";

const emailArg = process.argv.find((arg) => arg.startsWith("--email="));
const email = emailArg?.slice("--email=".length).trim().toLowerCase();
if (!email) {
  console.error("Uso: node artifacts/api-server/scripts/diagnose-user-plan-balances.mjs --email=usuario@dominio.com");
  process.exit(2);
}

if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY não configurada");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

try {
  const userResult = await pool.query(
    `select id, clerk_id, email, plan, credits, creative_credits, extra_credits,
            extra_creative_credits, video_balance, stripe_customer_id,
            stripe_subscription_id, stripe_subscription_status, updated_at
       from users
      where lower(email) = $1
      limit 1`,
    [email],
  );

  const user = userResult.rows[0] ?? null;
  if (!user) {
    console.log(JSON.stringify({ mode: "read_only", email, found: false }, null, 2));
    process.exit(0);
  }

  const txResult = await pool.query(
    `select id, amount, type, balance_type, description, balance_before,
            balance_after, stripe_session_id, created_at
       from credits_transactions
      where clerk_user_id = $1
      order by created_at desc
      limit 50`,
    [user.clerk_id],
  );

  let subscriptions = [];
  if (user.stripe_customer_id) {
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: "all",
      limit: 100,
    });
    subscriptions = stripeSubscriptions.data.map((subscription) => ({
      id: subscription.id,
      status: subscription.status,
      created: subscription.created,
      currentPeriodEnd: subscription.current_period_end ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      metadata: subscription.metadata,
      priceId: subscription.items.data[0]?.price?.id ?? null,
    }));
  }

  console.log(JSON.stringify({
    mode: "read_only",
    email,
    found: true,
    user,
    transactions: txResult.rows,
    subscriptions,
  }, null, 2));
} finally {
  await pool.end();
}
