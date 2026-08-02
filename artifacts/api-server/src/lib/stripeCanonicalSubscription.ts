import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db, users, creditsTransactions } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient.js";
import { PLAN_CREDITS, type PlanKey } from "./credits.js";
import { logger } from "./logger.js";

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active"]);
const PLAN_ORDER: PlanKey[] = ["free", "pro", "business", "agency"];

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
    creativeAlreadyGranted: true,
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

function getCreditMultiplier(subscription: Stripe.Subscription): number {
  return subscription.items.data[0]?.price.recurring?.interval === "year" ? 12 : 1;
}

async function hasConfirmedPayment(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<boolean> {
  const latestInvoice = subscription.latest_invoice;
  if (!latestInvoice) return false;

  const invoice =
    typeof latestInvoice === "string"
      ? await stripe.invoices.retrieve(latestInvoice)
      : latestInvoice;

  return invoice.paid === true || invoice.status === "paid";
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
        stripeSubscriptionId: subscription.id,
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

  if (!(await hasConfirmedPayment(stripe, subscription))) {
    await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, clerkUserId));
    return failedResult(subscription, "Pagamento do período ainda não confirmado");
  }

  const { periodStart, periodEnd } = billingPeriod;
  const multiplier = getCreditMultiplier(subscription);
  const changeKey = `subscription:${subscription.id}:${itemPriceId}:${periodStart}:${periodEnd}:${targetPlan}`;

  const result = await db.transaction(async (tx): Promise<CanonicalSubscriptionResult> => {
    const lockedResult = await tx.execute(
      sql`SELECT clerk_id, plan, credits, stripe_subscription_id
          FROM users
          WHERE clerk_id = ${clerkUserId}
          FOR UPDATE`,
    );
    const locked = lockedResult.rows[0] as unknown as LockedUserBalances | undefined;
    if (!locked) {
      return failedResult(subscription, "Usuário não encontrado durante a reconciliação");
    }

    const previousPlan = locked.plan;

    const [existingGeneral] = await tx
      .select({ id: creditsTransactions.id })
      .from(creditsTransactions)
      .where(eq(creditsTransactions.stripeSessionId, `${changeKey}:general`))
      .limit(1);

    const generalDelta = existingGeneral ? 0 : PLAN_CREDITS[targetPlan] * multiplier;
    const generalBefore = Number(locked.credits);
    const generalAfter = generalBefore + generalDelta;

    await tx
      .update(users)
      .set({
        plan: targetPlan,
        credits: generalAfter,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: "active",
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
        description:
          multiplier === 12
            ? `Franquia anual do plano ${targetPlan.toUpperCase()} — 12 meses`
            : previousPlan === targetPlan
              ? `Renovação mensal do plano ${targetPlan.toUpperCase()}`
              : previousPlan === "free"
                ? `Assinatura ${targetPlan.toUpperCase()} ativada`
                : `Alteração ${previousPlan.toUpperCase()} → ${targetPlan.toUpperCase()}`,
        balanceBefore: generalBefore,
        balanceAfter: generalAfter,
        stripeSessionId: `${changeKey}:general`,
      });
    }

    return {
      ok: true,
      message:
        generalDelta > 0
          ? "Pagamento confirmado e franquia reconciliada"
          : "Franquia já reconciliada para este período",
      clerkUserId,
      targetPlan,
      subscriptionId: subscription.id,
      priceId: itemPriceId,
      periodStart,
      periodEnd,
      generalGranted: generalDelta,
      creativeGranted: 0,
      generalAlreadyGranted: Boolean(existingGeneral),
      creativeAlreadyGranted: true,
    };
  });

  logger.info(
    {
      clerkUserId,
      subscriptionId: subscription.id,
      targetPlan,
      periodStart,
      periodEnd,
      multiplier,
      generalGranted: result.generalGranted,
    },
    "Confirmed Stripe subscription period synchronized without touching extra balances",
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
    if (!(await hasConfirmedPayment(stripe, subscription))) continue;
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
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(users.clerkId, clerkUserId));

  logger.info(
    { clerkUserId, deletedSubscriptionId: deletedSubscription.id },
    "Last Stripe subscription deleted; access blocked while all balances were preserved",
  );
}
