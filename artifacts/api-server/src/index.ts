import { runMigrations } from "stripe-replit-sync";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { getStripeSync } from "./lib/stripeClient.js";
import { rehydrateMLTokens } from "./lib/mlTokenStartup.js";

function resolvePublicOrigin(): string | null {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) return `https://${railwayDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  const replitDomains = process.env.REPLIT_DOMAINS?.trim();
  const replitDomain = replitDomains?.split(",")[0]?.trim();
  if (replitDomain) return `https://${replitDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return null;
}

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
  let stripeSync: Awaited<ReturnType<typeof getStripeSync>> | null = null;
  try {
    stripeSync = await getStripeSync();
  } catch (err: unknown) {
    logger.warn(
      { err },
      "Stripe API key not available — set STRIPE_SECRET_KEY to enable live billing. " +
      "Checkout and billing portal will remain unavailable until configured.",
    );
    return;
  }

  // Step 3: Register webhook against the real production origin and start backfill.
  try {
    const publicOrigin = resolvePublicOrigin();
    if (publicOrigin) {
      const webhookUrl = `${publicOrigin}/api/stripe/webhook`;
      await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ webhookUrl }, "Stripe webhook configured");
    } else {
      logger.warn("No public application URL found — Stripe webhook was not auto-registered");
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

// Wrap with timeout — refreshMLToken has no AbortController; if ML API hangs at startup
// the fetch pends indefinitely, blocking app.listen() and causing the port health check to fail.
await Promise.race([
  rehydrateMLTokens(),
  new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error("rehydrateMLTokens startup timeout (15s)")), 15_000),
  ),
]).catch((err: unknown) => {
  logger.warn({ err }, "ml startup: rehydration timed out or failed — ML integration may require re-auth");
});

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
