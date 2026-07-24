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

// Mesmos Price IDs já validados no catálogo Stripe do faturamento.
// Este mapa é somente de identificação: não altera preços nem checkout.
const PLAN_BY_PRICE_ID = new Map<string, PlanKey>([
  ["price_1TvgAOAYtu5nLhAZmgqhsTxJ", "pro"],
  ["price_1TvgDBAYtu5nLhAZsgenq5SJ", "pro"],
  ["price_1TvgEwAYtu5nLhAZvWozumfH", "business"],
  ["price_1TvgFWAYtu5nLhAZuT001wT5", "business"],
  ["price_1TvgGHAYtu5nLhAZt4gYmBM5", "agency"],
  ["price_1TvgGgAYtu5nLhAZO8FYa6nK", "agency"],
]);

interface LockedUserBalances {
  clerk_id: string;
  plan: PlanKey;
  credits: number;
  creative_credits: number;
  stripe_subscription_id: string | null;
}

interface StripePeriodFields {
  current_period_start?: number;
  current_period_end?: number;
}

export interface CanonicalSubscriptionResult {
  ok: boolean;
  message: string;
  clerkUserId?: string;
  targetPlan?: PlanKey;
  subscriptionId: string;
  priceId?: string;
  periodStart?: number;
  periodEnd?: number;
  generalGranted: number;
  creativeGranted: number;
  generalAlreadyGranted: boolean;
  creativeAlreadyGranted: boolean;
}

function failedResult(
  subscription: Stripe.Subscription,
  message: string,
): CanonicalSubscriptionResult {
  return {
    ok: false,
    message,
    subscriptionId: subscription.id,
    generalGranted: 0,
    creativeGranted: 0,
    generalAlreadyGranted: false,
    creativeAlreadyGranted: false,
  };
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

  const pricePlan = PLAN_BY_PRICE_ID.get(item.price.id);
  if (pricePlan) return pricePlan;

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

function getBillingPeriod(subscription: Stripe.Subscription): {
  periodStart: number;
  periodEnd: number;
} | null {
  const subscriptionPeriod = subscription as Stripe.Subscription & StripePeriodFields;
  const itemPeriod = subscription.items.data[0] as
    | (Stripe.SubscriptionItem & StripePeriodFields)
    | undefined;

  const periodStart =
    itemPeriod?.current_period_start ?? subscriptionPeriod.current_period_start;
  const periodEnd =
    itemPeriod?.current_period_end ?? subscriptionPeriod.current_period_end;

  if (!periodStart || !periodEnd) return null;
  return { periodStart, periodEnd };
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
): Promise<CanonicalSubscriptionResult> {
  const clerkUserId = await findUserClerkId(subscription);
  if (!clerkUserId) {
    logger.warn({ subscriptionId: subscription.id }, "No user found for canonical Stripe subscription sync");
    return failedResult(subscription, "Usuário da assinatura não identificado");
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
    return failedResult(subscription, `Assinatura com status ${subscription.status}`);
  }

  const stripe = await getUncachableStripeClient();
  const targetPlan = await identifyPlan(stripe, subscription);
  if (!targetPlan) {
    logger.warn({ subscriptionId: subscription.id }, "Canonical subscription plan could not be identified");
    return failedResult(subscription, "Plano da assinatura não identificado");
  }

  const itemPriceId = subscription.items.data[0]?.price.id;
  if (!itemPriceId) {
    return failedResult(subscription, "Preço da assinatura não identificado");
  }

  const billingPeriod = getBillingPeriod(subscription);
  if (!billingPeriod) {
    logger.warn({ subscriptionId: subscription.id }, "Stripe subscription billing period could not be identified");
    return failedResult(subscription, "Período de cobrança da assinatura não identificado");
  }

  const { periodStart, periodEnd } = billingPeriod;
  const changeKey = `subscription:${subscription.id}:${itemPriceId}:${periodStart}:${periodEnd}:${targetPlan}`;
  const legacyChangeKey = `subscription:${subscription.id}:${itemPriceId}:${targetPlan}`;

  const result = await db.transaction(async (tx): Promise<CanonicalSubscriptionResult> => {
    const lockedResult = await tx.execute(
      sql`SELECT clerk_id, plan, credits, creative_credits, stripe_subscription_id
          FROM users
          WHERE clerk_id = ${clerkUserId}
          FOR UPDATE`,
    );
    const locked = lockedResult.rows[0] as unknown as LockedUserBalances | undefined;
    if (!locked) {
      return failedResult(subscription, "Usuário não encontrado durante a reconciliação");
    }

    const previousPlan = locked.plan;

    const [existingGeneralCurrent] = await tx
      .select({ id: creditsTransactions.id })
      .from(creditsTransactions)
      .where(eq(creditsTransactions.stripeSessionId, `${changeKey}:general`))
      .limit(1);
    const [existingGeneralLegacy] = existingGeneralCurrent
      ? [existingGeneralCurrent]
      : await tx
          .select({ id: creditsTransactions.id })
          .from(creditsTransactions)
          .where(eq(creditsTransactions.stripeSessionId, `${legacyChangeKey}:general`))
          .limit(1);

    const [existingCreativeCurrent] = await tx
      .select({ id: creditsTransactions.id })
      .from(creditsTransactions)
      .where(eq(creditsTransactions.stripeSessionId, `${changeKey}:creative`))
      .limit(1);
    const [existingCreativeLegacy] = existingCreativeCurrent
      ? [existingCreativeCurrent]
      : await tx
          .select({ id: creditsTransactions.id })
          .from(creditsTransactions)
          .where(eq(creditsTransactions.stripeSessionId, `${legacyChangeKey}:creative`))
          .limit(1);

    const existingGeneral = existingGeneralCurrent ?? existingGeneralLegacy;
    const existingCreative = existingCreativeCurrent ?? existingCreativeLegacy;
    const generalDelta = existingGeneral ? 0 : PLAN_CREDITS[targetPlan];
    const creativeDelta = existingCreative ? 0 : PLAN_CREATIVE_CREDITS[targetPlan];

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

    if (generalDelta > 0) {
      await tx.insert(creditsTransactions).values({
        clerkUserId,
        amount: generalDelta,
        type: "credit",
        balanceType: "general",
        description: previousPlan === targetPlan
          ? `Franquia geral do plano ${targetPlan.toUpperCase()}`
          : previousPlan === "free"
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
        description: previousPlan === targetPlan
          ? `Franquia de imagens do plano ${targetPlan.toUpperCase()}`
          : previousPlan === "free"
            ? `Franquia de imagens do plano ${targetPlan.toUpperCase()}`
            : `Upgrade de imagens ${previousPlan.toUpperCase()} → ${targetPlan.toUpperCase()}`,
        balanceBefore: creativeBefore,
        balanceAfter: creativeAfter,
        stripeSessionId: `${changeKey}:creative`,
      });
    }

    return {
      ok: true,
      message:
        generalDelta > 0 || creativeDelta > 0
          ? "Assinatura e franquias reconciliadas"
          : "Assinatura já reconciliada para este período",
      clerkUserId,
      targetPlan,
      subscriptionId: subscription.id,
      priceId: itemPriceId,
      periodStart,
      periodEnd,
      generalGranted: generalDelta,
      creativeGranted: creativeDelta,
      generalAlreadyGranted: Boolean(existingGeneral),
      creativeAlreadyGranted: Boolean(existingCreative),
    };
  });

  logger.info(
    {
      clerkUserId,
      subscriptionId: subscription.id,
      targetPlan,
      periodStart,
      periodEnd,
      generalGranted: result.generalGranted,
      creativeGranted: result.creativeGranted,
    },
    "Canonical Stripe subscription synchronized without touching extra balances or Help",
  );

  return result;
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
