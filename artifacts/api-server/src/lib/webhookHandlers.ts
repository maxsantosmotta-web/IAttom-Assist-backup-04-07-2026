import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, users, creditsTransactions, videoTransactions } from "@workspace/db";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient.js";
import { logger } from "./logger.js";

const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 400,
  business: 1000,
  agency: 2300,
};

const PLAN_CREATIVE_CREDITS: Record<string, number> = {
  free: 0,
  pro: 100,
  business: 150,
  agency: 250,
};

type ValidPlan = "free" | "pro" | "business" | "agency";

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    const clerkUserId = subscription.metadata?.clerkUserId;
    if (clerkUserId) {
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkUserId));
      if (user) {
        await db
          .update(users)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(users.clerkId, clerkUserId));
      }
    }
  }

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

    const planKey = (
      product.metadata?.plan ||
      subscription.metadata?.planKey
    ) as ValidPlan | undefined;

    if (!planKey || !Object.prototype.hasOwnProperty.call(PLAN_CREDITS, planKey)) {
      logger.warn(
        { productId, subMetadata: subscription.metadata },
        "Stripe product has no plan metadata and subscription has no planKey — cannot activate plan",
      );
      return;
    }

    const newCredits = PLAN_CREDITS[planKey];
    const newCreativeCredits = PLAN_CREATIVE_CREDITS[planKey] ?? 0;
    const balanceBefore = user.credits;
    const balanceAfter = newCredits;

    // Only reset plan credits; extraCredits and extraCreativeCredits are preserved
    await db
      .update(users)
      .set({
        plan: planKey,
        credits: newCredits,
        creativeCredits: newCreativeCredits,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: status,
        helpMessagesUsed: 0,
        helpUsedResetAt: new Date(),
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

    // Only reset plan credits; extraCredits and extraCreativeCredits are preserved
    await db
      .update(users)
      .set({
        plan: "free",
        credits: PLAN_CREDITS.free,
        creativeCredits: PLAN_CREATIVE_CREDITS.free,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: status,
        helpMessagesUsed: 0,
        helpUsedResetAt: new Date(),
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

  // Only reset plan credits; extraCredits and extraCreativeCredits are preserved
  await db
    .update(users)
    .set({
      plan: "free",
      credits: PLAN_CREDITS.free,
      creativeCredits: PLAN_CREATIVE_CREDITS.free,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: "canceled",
      helpMessagesUsed: 0,
      helpUsedResetAt: new Date(),
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

async function handlePackagePurchase(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = session.metadata ?? {};
  const { type, clerkUserId } = meta;

  const isCreditPack   = type === "credit_pack" || type === "credit_purchase";
  const isCreativePack = type === "creative_pack";
  const isVideoPack    = type === "video_pack";

  if (!isCreditPack && !isCreativePack && !isVideoPack) return;

  if (!clerkUserId) {
    logger.warn({ sessionId: session.id }, "Package purchase: missing clerkUserId in metadata");
    return;
  }

  // Idempotency — check per pack type
  if (isVideoPack) {
    const existing = await db
      .select({ id: videoTransactions.id })
      .from(videoTransactions)
      .where(eq(videoTransactions.stripeSessionId, session.id))
      .limit(1);
    if (existing.length > 0) {
      logger.info({ sessionId: session.id }, "Video pack purchase: already processed, skipping");
      return;
    }
  } else {
    const existing = await db
      .select({ id: creditsTransactions.id })
      .from(creditsTransactions)
      .where(eq(creditsTransactions.stripeSessionId, session.id))
      .limit(1);
    if (existing.length > 0) {
      logger.info({ sessionId: session.id }, "Package purchase: already processed, skipping");
      return;
    }
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId));

  if (!user) {
    logger.warn({ clerkUserId }, "Package purchase: user not found");
    return;
  }

  if (isVideoPack) {
    const videos = parseInt(meta.videos ?? "0", 10);
    if (!videos || videos <= 0) {
      logger.warn({ sessionId: session.id }, "Video pack purchase: invalid videos count in metadata");
      return;
    }

    const balanceBefore = user.videoBalance ?? 0;
    const balanceAfter  = balanceBefore + videos;

    await db
      .update(users)
      .set({ videoBalance: balanceAfter, updatedAt: new Date() })
      .where(eq(users.clerkId, clerkUserId));

    await db.insert(videoTransactions).values({
      clerkUserId,
      amount: videos,
      type: "purchase",
      packId: meta.packId ?? null,
      description: `Compra de pacote de vídeos — ${videos} vídeo${videos !== 1 ? "s" : ""}`,
      balanceBefore,
      balanceAfter,
      stripeSessionId: session.id,
    });

    logger.info(
      { clerkUserId, videos, balanceBefore, balanceAfter, sessionId: session.id },
      "Video pack processed — videoBalance updated",
    );
    return;
  }

  const amount = parseInt(meta.amount ?? meta.credits ?? "0", 10);
  if (!amount || amount <= 0) {
    logger.warn({ sessionId: session.id }, "Package purchase: invalid amount in metadata");
    return;
  }

  if (isCreativePack) {
    const balanceBefore = user.extraCreativeCredits ?? 0;
    const balanceAfter  = balanceBefore + amount;

    await db
      .update(users)
      .set({ extraCreativeCredits: balanceAfter, updatedAt: new Date() })
      .where(eq(users.clerkId, clerkUserId));

    await db.insert(creditsTransactions).values({
      clerkUserId,
      amount,
      type: "credit",
      balanceType: "creative",
      description: `Compra de criativos avulsos — ${amount} créditos criativos`,
      balanceBefore,
      balanceAfter,
      stripeSessionId: session.id,
    });

    logger.info(
      { clerkUserId, amount, balanceBefore, balanceAfter, sessionId: session.id },
      "Creative pack processed — extraCreativeCredits updated",
    );
  } else {
    const balanceBefore = user.extraCredits ?? 0;
    const balanceAfter  = balanceBefore + amount;

    await db
      .update(users)
      .set({ extraCredits: balanceAfter, updatedAt: new Date() })
      .where(eq(users.clerkId, clerkUserId));

    await db.insert(creditsTransactions).values({
      clerkUserId,
      amount,
      type: "credit",
      balanceType: "general",
      description: `Compra de créditos avulsos — ${amount.toLocaleString("pt-BR")} créditos`,
      balanceBefore,
      balanceAfter,
      stripeSessionId: session.id,
    });

    logger.info(
      { clerkUserId, amount, balanceBefore, balanceAfter, sessionId: session.id },
      "Credit pack processed — extraCredits updated",
    );
  }
}

export async function reconcileCheckoutSession(sessionId: string): Promise<{ ok: boolean; message: string }> {
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.status !== "complete") {
    return { ok: false, message: `Session status is ${session.status}, not complete` };
  }

  if (session.mode === "subscription" && session.subscription) {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    await handleSubscriptionChange(sub);
    return { ok: true, message: `Subscription ${subId} reconciled` };
  }

  if (session.mode === "payment") {
    await handlePackagePurchase(session);
    return { ok: true, message: `Payment session ${sessionId} reconciled` };
  }

  return { ok: false, message: `Session mode ${session.mode} not handled` };
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
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await handlePackagePurchase(session);
          if (session.mode === "subscription" && session.subscription) {
            const stripe = await getUncachableStripeClient();
            const subId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription.id;
            const sub = await stripe.subscriptions.retrieve(subId);
            await handleSubscriptionChange(sub);
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      logger.error({ err, eventType: event.type }, "Webhook business logic failed");
    }
  }
}
