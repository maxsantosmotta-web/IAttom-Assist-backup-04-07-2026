import { runMigrations } from "stripe-replit-sync";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { getStripeSync } from "./lib/stripeClient.js";

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe init");
    return;
  }

  // Step 1: Always run DB schema migrations (no Stripe key needed).
  try {
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");
  } catch (err: unknown) {
    logger.warn({ err }, "Stripe DB migrations failed — billing DB tables may be missing");
    return;
  }

  // Step 2: Connect to Stripe API (requires STRIPE_SECRET_KEY or connector).
  // If no key is available, billing features are gracefully disabled — app still starts.
  let stripeSync: Awaited<ReturnType<typeof getStripeSync>> | null = null;
  try {
    stripeSync = await getStripeSync();
  } catch (err: unknown) {
    logger.warn(
      { err },
      "Stripe API key not available — set STRIPE_SECRET_KEY to enable live billing. " +
      "Plans page and credit system will work; checkout/portal will return 503.",
    );
    return;
  }

  // Step 3: Register webhook and start background sync.
  try {
    const domains = process.env.REPLIT_DOMAINS ?? "";
    const primaryDomain = domains.split(",")[0];
    if (primaryDomain) {
      const webhookUrl = `https://${primaryDomain}/api/stripe/webhook`;
      await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ webhookUrl }, "Stripe webhook configured");
    }

    stripeSync.syncBackfill().catch((err: unknown) => {
      logger.warn({ err }, "Stripe backfill encountered an error");
    });
  } catch (err: unknown) {
    logger.warn({ err }, "Stripe webhook/sync setup failed — backfill skipped");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initStripe();

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
