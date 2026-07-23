import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient.js";
import { createCheckoutSession, ensureStripeCustomer } from "./stripeService.js";
import { handleCanonicalSubscriptionChange } from "./stripeCanonicalSubscription.js";

const PRODUCTION_ORIGIN = "https://www.iattomassist.com.br";
const BASE_PATH = (process.env.BASE_PATH ?? "/").replace(/\/$/, "");
const BILLING_URL = `${PRODUCTION_ORIGIN}${BASE_PATH}/dashboard/billing`;

const PLAN_ORDER = ["free", "pro", "business", "agency"] as const;
type PaidPlan = Exclude<(typeof PLAN_ORDER)[number], "free">;

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

export class StripeSubscriptionUpgradeError extends Error {
  constructor(
    public readonly code:
      | "MULTIPLE_ACTIVE_SUBSCRIPTIONS"
      | "SUBSCRIPTION_ITEM_NOT_FOUND"
      | "CURRENT_PLAN_NOT_IDENTIFIED"
      | "INVALID_UPGRADE_DIRECTION"
      | "USER_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "StripeSubscriptionUpgradeError";
  }
}

export interface StripeSubscriptionActionResult {
  action: "checkout" | "upgrade";
  url: string;
  subscriptionId?: string;
  previousPlan?: string;
  targetPlan: string;
}

async function identifySubscriptionPlan(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  if (subscription.metadata?.planKey) return subscription.metadata.planKey;

  const item = subscription.items.data[0];
  if (!item) return null;

  const productId =
    typeof item.price.product === "string"
      ? item.price.product
      : item.price.product.id;
  const product = await stripe.products.retrieve(productId);
  return product.metadata?.plan ?? null;
}

export async function createOrUpgradeStripeSubscription(
  clerkUserId: string,
  priceId: string,
  targetPlan: PaidPlan,
): Promise<StripeSubscriptionActionResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId));

  if (!user) {
    throw new StripeSubscriptionUpgradeError(
      "USER_NOT_FOUND",
      "Usuário não encontrado.",
    );
  }

  const customerId = await ensureStripeCustomer(clerkUserId);
  const stripe = await getUncachableStripeClient();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  const activeSubscriptions = subscriptions.data.filter((subscription) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status),
  );

  if (activeSubscriptions.length === 0) {
    const url = await createCheckoutSession(clerkUserId, priceId, targetPlan);
    return { action: "checkout", url, targetPlan };
  }

  if (activeSubscriptions.length > 1) {
    throw new StripeSubscriptionUpgradeError(
      "MULTIPLE_ACTIVE_SUBSCRIPTIONS",
      "Foram encontradas várias assinaturas ativas. Nenhuma nova assinatura foi criada.",
    );
  }

  const subscription = activeSubscriptions[0];
  const item = subscription.items.data[0];
  if (!item) {
    throw new StripeSubscriptionUpgradeError(
      "SUBSCRIPTION_ITEM_NOT_FOUND",
      "A assinatura ativa não possui item de preço.",
    );
  }

  const currentPlan =
    (await identifySubscriptionPlan(stripe, subscription)) ?? user.plan;
  const currentIndex = PLAN_ORDER.indexOf(
    currentPlan as (typeof PLAN_ORDER)[number],
  );
  const targetIndex = PLAN_ORDER.indexOf(targetPlan);

  if (currentIndex < 0) {
    throw new StripeSubscriptionUpgradeError(
      "CURRENT_PLAN_NOT_IDENTIFIED",
      "Não foi possível identificar o plano atual da assinatura.",
    );
  }

  if (targetIndex <= currentIndex) {
    throw new StripeSubscriptionUpgradeError(
      "INVALID_UPGRADE_DIRECTION",
      "O plano selecionado não é superior ao plano atual.",
    );
  }

  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: priceId, quantity: 1 }],
    metadata: {
      ...subscription.metadata,
      clerkUserId,
      planKey: targetPlan,
      previousPlan: currentPlan,
      changeType: "upgrade",
    },
    billing_cycle_anchor: "now",
    proration_behavior: "none",
    payment_behavior: "error_if_incomplete",
  });

  await handleCanonicalSubscriptionChange(updated);

  const returnUrl = new URL(`${BILLING_URL}?payment=upgrade_success`);
  returnUrl.searchParams.set("subscription_id", updated.id);
  returnUrl.searchParams.set("from_plan", currentPlan);
  returnUrl.searchParams.set("to_plan", targetPlan);

  return {
    action: "upgrade",
    url: returnUrl.toString(),
    subscriptionId: updated.id,
    previousPlan: currentPlan,
    targetPlan,
  };
}
