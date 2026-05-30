import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient.js";
import { getPrimaryOrigin } from "./appDomain.js";

const APP_ORIGIN = getPrimaryOrigin();

const BASE_PATH = (process.env.BASE_PATH ?? "/").replace(/\/$/, "");

export async function ensureStripeCustomer(
  clerkUserId: string,
): Promise<string> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId));
  if (!user) throw new Error("User not found");

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { clerkUserId },
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkUserId));

  return customer.id;
}

export async function createCheckoutSession(
  clerkUserId: string,
  priceId: string,
  planKey: string,
): Promise<string> {
  const customerId = await ensureStripeCustomer(clerkUserId);
  const stripe = await getUncachableStripeClient();

  const billingUrl = `${APP_ORIGIN}${BASE_PATH}/dashboard/billing`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${billingUrl}?payment=success`,
    cancel_url: `${billingUrl}?payment=canceled`,
    client_reference_id: clerkUserId,
    subscription_data: {
      metadata: { clerkUserId, planKey },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error("Stripe checkout session URL is null");
  return session.url;
}

export async function createCreditPurchaseCheckoutSession(
  clerkUserId: string,
  packageId: string,
  credits: number,
  unitAmountBrl: number,
  packageName: string,
): Promise<string> {
  const customerId = await ensureStripeCustomer(clerkUserId);
  const stripe = await getUncachableStripeClient();

  const billingUrl = `${APP_ORIGIN}${BASE_PATH}/dashboard/billing`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: unitAmountBrl,
          product_data: {
            name: packageName,
            description: `${credits.toLocaleString("pt-BR")} créditos — compra avulsa`,
          },
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${billingUrl}?payment=credits_success`,
    cancel_url: `${billingUrl}?payment=canceled`,
    client_reference_id: clerkUserId,
    metadata: {
      clerkUserId,
      type: "credit_purchase",
      packageId,
      credits: String(credits),
    },
    payment_intent_data: {
      metadata: {
        clerkUserId,
        type: "credit_purchase",
        packageId,
        credits: String(credits),
      },
    },
  });

  if (!session.url) throw new Error("Stripe checkout session URL is null");
  return session.url;
}

export async function createFreeStartCheckoutSession(
  clerkUserId: string,
): Promise<string> {
  const customerId = await ensureStripeCustomer(clerkUserId);
  const stripe = await getUncachableStripeClient();

  const billingUrl = `${APP_ORIGIN}${BASE_PATH}/dashboard/billing`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_collection: "if_required",
    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: 0,
          recurring: { interval: "month" },
          product_data: { name: "IAttom Assist START" },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${billingUrl}?payment=success`,
    cancel_url:  `${billingUrl}?payment=canceled`,
    client_reference_id: clerkUserId,
    subscription_data: {
      metadata: { clerkUserId, planKey: "free" },
    },
  });

  if (!session.url) throw new Error("Stripe checkout session URL is null");
  return session.url;
}

export async function createBillingPortalSession(
  clerkUserId: string,
): Promise<string> {
  const customerId = await ensureStripeCustomer(clerkUserId);
  const stripe = await getUncachableStripeClient();

  const billingUrl = `${APP_ORIGIN}${BASE_PATH}/dashboard/billing`;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: billingUrl,
  });

  return session.url;
}
