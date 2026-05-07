import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

// Stripe credentials come exclusively from the STRIPE_SECRET_KEY environment secret.
// No Replit connector proxy is used — this makes deployment independent of any
// Replit-managed Stripe integration. Set STRIPE_SECRET_KEY=sk_test_... (or sk_live_...)
// to enable billing. Leave it unset to run with billing gracefully disabled.
function resolveStripeKey(): string | null {
  return process.env.STRIPE_SECRET_KEY ?? null;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const key = resolveStripeKey();
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

  const key = resolveStripeKey();
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
