import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, users, creditsTransactions } from "@workspace/db";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient.js";
import { logger } from "./logger.js";

const PLAN_CREDITS: Record<string, number> = {
  free: 50,
  pro: 500,
  business: 2000,
  agency: 10000,
};

type ValidPlan = "free" | "pro" | "business" | "agency";

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    logger.warn({ customerId }, "No user found for Stripe customer on webhook");
    return;
  }

  const status = subscription.status;

  if (status === "active" || status === "trialing") {
    const item = subscription.items.data[0];
    if (!item) return;

    const productId =
      typeof item.price.product === "string"
        ? item.price.product
        : item.price.product.id;

    const stripe = await getUncachableStripeClient();
    const product = await stripe.products.retrieve(productId);

    const planKey = product.metadata?.plan as ValidPlan | undefined;
    if (!planKey || !PLAN_CREDITS[planKey]) {
      logger.warn(
        { productId },
        "Stripe product has no plan metadata — cannot activate plan",
      );
      return;
    }

    const newCredits = PLAN_CREDITS[planKey];
    const balanceBefore = user.credits;
    const balanceAfter = newCredits;

    await db
      .update(users)
      .set({
        plan: planKey,
        credits: newCredits,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, user.clerkId));

    if (balanceAfter !== balanceBefore) {
      await db.insert(creditsTransactions).values({
        clerkUserId: user.clerkId,
        amount: balanceAfter - balanceBefore,
        type: "credit",
        description: `${planKey.charAt(0).toUpperCase() + planKey.slice(1)} plan subscription activated`,
        balanceBefore,
        balanceAfter,
      });
    }

    logger.info(
      { userId: user.id, plan: planKey, credits: newCredits },
      "Subscription activated — plan and credits updated",
    );
  } else if (
    status === "canceled" ||
    status === "unpaid" ||
    status === "past_due"
  ) {
    const balanceBefore = user.credits;
    const balanceAfter = PLAN_CREDITS.free;

    await db
      .update(users)
      .set({
        plan: "free",
        credits: PLAN_CREDITS.free,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, user.clerkId));

    if (balanceAfter !== balanceBefore) {
      await db.insert(creditsTransactions).values({
        clerkUserId: user.clerkId,
        amount: balanceAfter - balanceBefore,
        type: "adjustment",
        description: `Subscription ${status} — reverted to free plan`,
        balanceBefore,
        balanceAfter,
      });
    }

    logger.info(
      { userId: user.id, status },
      "Subscription ended — reverted to free plan",
    );
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) return;

  const balanceBefore = user.credits;
  const balanceAfter = PLAN_CREDITS.free;

  await db
    .update(users)
    .set({
      plan: "free",
      credits: PLAN_CREDITS.free,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(users.clerkId, user.clerkId));

  if (balanceAfter !== balanceBefore) {
    await db.insert(creditsTransactions).values({
      clerkUserId: user.clerkId,
      amount: balanceAfter - balanceBefore,
      type: "adjustment",
      description: "Subscription canceled — reverted to free plan",
      balanceBefore,
      balanceAfter,
    });
  }

  logger.info({ userId: user.id }, "Subscription deleted — reverted to free");
}

export class WebhookHandlers {
  static async processWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "Payload must be a Buffer. Ensure webhook route is registered BEFORE express.json().",
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    let event: { type: string; data: { object: unknown } };
    try {
      event = JSON.parse(payload.toString()) as typeof event;
    } catch {
      logger.warn("Could not parse webhook payload for business logic");
      return;
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionChange(
            event.data.object as Stripe.Subscription,
          );
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;
        default:
          break;
      }
    } catch (err) {
      logger.error({ err, eventType: event.type }, "Webhook business logic failed");
    }
  }
}
