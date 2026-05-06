import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

// Resolve the Stripe secret key from available sources:
//   1. STRIPE_SECRET_KEY env secret (primary — works everywhere, no Replit connector needed)
//   2. Replit connector proxy (fallback — used when the connector integration is active in dev)
// Returns null if neither source is available — Stripe features will be gracefully disabled.
async function resolveStripeKey(): Promise<string | null> {
  // 1. Direct env secret — preferred for all environments
  const directKey = process.env.STRIPE_SECRET_KEY;
  if (directKey) return directKey;

  // 2. Replit connector proxy fallback
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) return null;

  try {
    // Always use test/sandbox keys. Set STRIPE_USE_LIVE_KEYS=true only for live payments.
    const targetEnvironment =
      process.env.STRIPE_USE_LIVE_KEYS === "true" ? "production" : "development";

    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set("include_secrets", "true");
    url.searchParams.set("connector_names", "stripe");
    url.searchParams.set("environment", targetEnvironment);

    const resp = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!resp.ok) return null;

    const data = await resp.json() as {
      items?: Array<{ settings?: { secret?: string } }>;
    };

    return data.items?.[0]?.settings?.secret ?? null;
  } catch {
    return null;
  }
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const key = await resolveStripeKey();
  if (!key) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY to enable billing features.",
    );
  }
  return new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2025-08-27.basil" as any,
  });
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const key = await resolveStripeKey();
  if (!key) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY to enable billing features.",
    );
  }

  return new StripeSync({
    poolConfig: { connectionString: databaseUrl, max: 2 },
    stripeSecretKey: key,
  });
}
