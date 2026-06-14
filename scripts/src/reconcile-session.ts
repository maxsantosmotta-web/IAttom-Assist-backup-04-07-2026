import Stripe from "stripe";
import pg from "pg";

const { Pool } = pg;

const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 400,
  business: 1000,
  agency: 2300,
};

const PLAN_CREATIVE_CREDITS: Record<string, number> = {
  free: 0,
  pro: 100,
  business: 150,
  agency: 250,
};

async function getStripeSecret(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (hostname && token) {
    const resp = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: token } },
    );
    if (resp.ok) {
      const data = await resp.json() as {
        items?: Array<{ settings?: { secret?: string; secret_key?: string } }>;
      };
      const s = data.items?.[0]?.settings;
      const key = s?.secret ?? s?.secret_key;
      if (key) return key;
    }
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("No Stripe key available");
  return key;
}

async function main() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error("Usage: pnpm --filter @workspace/scripts run reconcile-session <sessionId>");
    process.exit(1);
  }

  console.log(`\n=== RECONCILE SESSION: ${sessionId} ===\n`);

  const secretKey = await getStripeSecret();
  const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as never });

  // 1. Fetch session
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  console.log(`Session: status=${session.status}, mode=${session.mode}, customer=${session.customer}`);

  if (session.status !== "complete") {
    console.error(`Session not complete (status: ${session.status})`);
    process.exit(1);
  }

  if (session.mode !== "subscription" || !session.subscription) {
    console.error("Not a subscription session or no subscription attached");
    process.exit(1);
  }

  // 2. Fetch subscription
  const subId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription.id;

  const sub = await stripe.subscriptions.retrieve(subId);
  console.log(`Subscription: status=${sub.status}, metadata=`, sub.metadata);

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const clerkUserId = sub.metadata?.clerkUserId;
  const planKey = sub.metadata?.planKey;

  if (!clerkUserId) {
    console.error("No clerkUserId in subscription metadata");
    process.exit(1);
  }

  if (!planKey || !Object.prototype.hasOwnProperty.call(PLAN_CREDITS, planKey)) {
    console.error(`Invalid planKey: "${planKey}"`);
    process.exit(1);
  }

  // 3. Fetch Stripe customer for email/name
  const customer = await stripe.customers.retrieve(customerId);
  const customerEmail = !customer.deleted ? (customer.email ?? undefined) : undefined;
  const customerName = !customer.deleted ? (customer.name ?? undefined) : undefined;
  console.log(`Customer: email=${customerEmail}, name=${customerName}`);

  // 4. DB operations
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Try to find user by stripeCustomerId
    let userRow = await pool.query(
      `SELECT id, clerk_id, email, plan, stripe_customer_id, credits FROM users WHERE stripe_customer_id = $1 LIMIT 1`,
      [customerId]
    );

    // Fallback: try by clerkId
    if (userRow.rows.length === 0) {
      console.log("Not found by customerId, trying clerkId...");
      userRow = await pool.query(
        `SELECT id, clerk_id, email, plan, stripe_customer_id, credits FROM users WHERE clerk_id = $1 LIMIT 1`,
        [clerkUserId]
      );
    }

    // Fallback: try by email
    if (userRow.rows.length === 0 && customerEmail) {
      console.log("Not found by clerkId, trying email...");
      userRow = await pool.query(
        `SELECT id, clerk_id, email, plan, stripe_customer_id, credits FROM users WHERE email = $1 LIMIT 1`,
        [customerEmail]
      );
    }

    let user: Record<string, unknown>;

    if (userRow.rows.length === 0) {
      // Create the user — they signed up via Stripe before ever opening the dashboard
      if (!customerEmail) {
        console.error("Cannot create user: no email available from Stripe customer");
        process.exit(1);
      }

      console.log(`User not found — creating new record for ${customerEmail} (${clerkUserId})`);

      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const isAdmin = adminEmail && customerEmail.toLowerCase() === adminEmail;

      const inserted = await pool.query(
        `INSERT INTO users (clerk_id, email, name, plan, credits, beta_access, created_at, updated_at)
         VALUES ($1, $2, $3, 'free', 0, false, NOW(), NOW())
         ON CONFLICT (clerk_id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
         RETURNING id, clerk_id, email, plan, credits`,
        [clerkUserId, customerEmail, customerName ?? null]
      );

      user = inserted.rows[0];
      console.log(`Created user: ${JSON.stringify(user)}`);
      void isAdmin;
    } else {
      user = userRow.rows[0];
      console.log(`Found user: ${user.email} (${user.clerk_id}), plan=${user.plan}, credits=${user.credits}`);
    }

    // 5. Apply subscription
    const newCredits = PLAN_CREDITS[planKey];
    const newCreativeCredits = PLAN_CREATIVE_CREDITS[planKey] ?? 0;
    const balanceBefore = Number(user.credits ?? 0);
    const balanceAfter = newCredits;

    await pool.query(
      `UPDATE users SET
        plan = $1,
        credits = $2,
        creative_credits = $3,
        stripe_customer_id = $4,
        stripe_subscription_id = $5,
        stripe_subscription_status = $6,
        help_messages_used = 0,
        help_used_reset_at = NOW(),
        updated_at = NOW()
       WHERE clerk_id = $7`,
      [planKey, newCredits, newCreativeCredits, customerId, sub.id, sub.status, clerkUserId]
    );

    if (balanceAfter !== balanceBefore) {
      await pool.query(
        `INSERT INTO credits_transactions
           (clerk_user_id, amount, type, description, balance_before, balance_after, created_at)
         VALUES ($1, $2, 'credit', $3, $4, $5, NOW())`,
        [
          clerkUserId,
          balanceAfter - balanceBefore,
          `${planKey.charAt(0).toUpperCase() + planKey.slice(1)} plan reconciled via session ${sessionId}`,
          balanceBefore,
          balanceAfter,
        ]
      );
    }

    // 6. Verify
    const verified = await pool.query(
      `SELECT plan, credits, creative_credits, stripe_customer_id, stripe_subscription_id, stripe_subscription_status
       FROM users WHERE clerk_id = $1`,
      [clerkUserId]
    );

    console.log(`\nSUCCESS — DB state after reconciliation:`);
    console.log(JSON.stringify(verified.rows[0], null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
