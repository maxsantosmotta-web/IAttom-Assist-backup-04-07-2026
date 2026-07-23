import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db, users, creditsTransactions } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient.js";
import { PLAN_CREDITS, PLAN_CREATIVE_CREDITS, type PlanKey } from "./credits.js";
import { logger } from "./logger.js";

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);
const PLAN_ORDER: PlanKey[] = ["free", "pro", "business", "agency"];

interface LockedUserBalances {
  clerk_id: string;
  plan: PlanKey;
  credits: number;
  creative_credits: number;
  stripe_subscription_id: string | null;
}

async function identifyPlan(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<PlanKey | null> {
  const metadataPlan = subscription.metadata?.planKey;
  if (metadataPlan && PLAN_ORDER.includes(metadataPlan as PlanKey)) {
    return metadataPlan as PlanKey;
  }

  const item = subscription.items.data[0];
  if (!item) return null;
  const productId =
    typeof item.price.product === "string"
      ? item.price.product
      : item.price.product.id;
  const product = await stripe.products.retrieve(productId);
  const productPlan = product.metadata?.plan;
  return productPlan && PLAN_ORDER.includes(productPlan as PlanKey)
    ? (productPlan as PlanKey)
    : null;
}

async function findUserClerkId(subscription: Stripe.Subscription): Promise<string | null> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [byCustomer] = await db
    .select({ clerkId: users.clerkId })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));
  if (byCustomer) return byCustomer.clerkId;

  const clerkUserId = subscription.metadata?.clerkUserId;
  if (!clerkUserId) return null;

  const [byClerk] = await db
    .select({ clerkId: users.clerkId })
    .from(users)
    .where(eq(users.clerkId, clerkUserId));
  return byClerk?.clerkId ?? null;
}

export async function handleCanonicalSubscriptionChange(
  subscription: Stripe.Subscription,
): Promise<void> {
  const clerkUserId = await findUserClerkId(subscription);
  if (!clerkUserId) {
    logger.warn({ subscriptionId: subscription.id }, "No user found for canonical Stripe subscription sync");
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  if (!ACTIVE_STATUSES.has(subscription.status)) {
    await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionStatus: subscription.status,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, clerkUserId));
    return;
  }

  const stripe = await getUncachableStripeClient();
  const targetPlan = await identifyPlan(stripe, subscription);
  if (!targetPlan) {
    logger.warn({ subscriptionId: subscription.id }, "Canonical subscription plan could not be identified");
    return;
  }

  await db.transaction(async (tx) => {
    const lockedResult = await tx.execute(
      sql`SELECT clerk_id, plan, credits, creative_credits, stripe_subscription_id
          FROM users
          WHERE clerk_id = ${clerkUserId}
          FOR UPDATE`,
    );
    const locked = lockedResult.rows[0] as LockedUserBalances | undefined;
    if (!locked) return;

    const previousPlan = locked.plan;
    const planChanged = previousPlan !== targetPlan;
    const generalDelta = planChanged
      ? Math.max(0, PLAN_CREDITS[targetPlan] - PLAN_CREDITS[previousPlan])
      : 0;
    const creativeDelta = planChanged
      ? Math.max(0, PLAN_CREATIVE_CREDITS[targetPlan] - PLAN_CREATIVE_CREDITS[previousPlan])
      : 0;

    const generalBefore = Number(locked.credits);
    const creativeBefore = Number(locked.creative_credits);
    const generalAfter = generalBefore + generalDelta;
    const creativeAfter = creativeBefore + creativeDelta;

    await tx
      .update(users)
      .set({
        plan: targetPlan,
        credits: generalAfter,
        creativeCredits: creativeAfter,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
        planSelected: true,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, clerkUserId));

    const itemPriceId = subscription.items.data[0]?.price.id ?? "unknown";
    const changeKey = `subscription:${subscription.id}:${itemPriceId}:${targetPlan}`;

    if (generalDelta > 0) {
      await tx.insert(creditsTransactions).values({
        clerkUserId,
        amount: generalDelta,
        type: "credit",
        balanceType: "general",
        description: previousPlan === "free"
          ? `Assinatura ${targetPlan.toUpperCase()} ativada`
          : `Upgrade ${previousPlan.toUpperCase()} → ${targetPlan.toUpperCase()}`,
        balanceBefore: generalBefore,
        balanceAfter: generalAfter,
        stripeSessionId: `${changeKey}:general`,
      });
    }

    if (creativeDelta > 0) {
      await tx.insert(creditsTransactions).values({
        clerkUserId,
        amount: creativeDelta,
        type: "credit",
        balanceType: "creative",
        description: previousPlan === "free"
          ? `Franquia de imagens do plano ${targetPlan.toUpperCase()}`
          : `Upgrade de imagens ${previousPlan.toUpperCase()} → ${targetPlan.toUpperCase()}`,
        balanceBefore: creativeBefore,
        balanceAfter: creativeAfter,
        stripeSessionId: `${changeKey}:creative`,
      });
    }
  });

  logger.info(
    { clerkUserId, subscriptionId: subscription.id, targetPlan },
    "Canonical Stripe subscription synchronized without touching extra balances",
  );
}

export async function handleCanonicalSubscriptionDeleted(
  deletedSubscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof deletedSubscription.customer === "string"
      ? deletedSubscription.customer
      : deletedSubscription.customer.id;
  const clerkUserId = await findUserClerkId(deletedSubscription);
  if (!clerkUserId) return;

  const stripe = await getUncachableStripeClient();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  const remaining: Array<{ subscription: Stripe.Subscription; plan: PlanKey }> = [];
  for (const subscription of subscriptions.data) {
    if (subscription.id === deletedSubscription.id || !ACTIVE_STATUSES.has(subscription.status)) continue;
    const plan = await identifyPlan(stripe, subscription);
    if (plan) remaining.push({ subscription, plan });
  }

  remaining.sort(
    (a, b) => PLAN_ORDER.indexOf(b.plan) - PLAN_ORDER.indexOf(a.plan),
  );

  if (remaining[0]) {
    await handleCanonicalSubscriptionChange(remaining[0].subscription);
    logger.info(
      {
        clerkUserId,
        deletedSubscriptionId: deletedSubscription.id,
        preservedSubscriptionId: remaining[0].subscription.id,
        preservedPlan: remaining[0].plan,
      },
      "Deleted duplicate subscription without reverting user to FREE",
    );
    return;
  }

  await db
    .update(users)
    .set({
      plan: "free",
      credits: PLAN_CREDITS.free,
      creativeCredits: PLAN_CREATIVE_CREDITS.free,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(users.clerkId, clerkUserId));

  logger.info(
    { clerkUserId, deletedSubscriptionId: deletedSubscription.id },
    "Last Stripe subscription deleted; user reverted to FREE while extra balances were preserved",
  );
}
