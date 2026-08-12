import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, users, creditsTransactions, googlePlayPurchases } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { logger } from "../lib/logger.js";
import {
  acknowledgeSubscriptionPurchase,
  getSubscriptionPurchase,
  isGoogleSubscriptionEntitled,
  verifySubscriptionPurchase,
} from "../lib/googlePlayBillingService.js";

const router: IRouter = Router();

type InternalPlan = "pro" | "business" | "agency";
type BillingPeriod = "monthly" | "annual";

type SubscriptionEntitlement = {
  internalPlan: InternalPlan;
  monthlyCredits: number;
  basePlanId: string;
  billingPeriod: BillingPeriod;
};

const SUBSCRIPTIONS: Record<string, SubscriptionEntitlement> = {
  iattom_start: {
    internalPlan: "pro",
    monthlyCredits: 200,
    basePlanId: "start-mensal",
    billingPeriod: "monthly",
  },
  iattom_start_anual: {
    internalPlan: "pro",
    monthlyCredits: 200,
    basePlanId: "start-anual",
    billingPeriod: "annual",
  },
  iattom_premium: {
    internalPlan: "business",
    monthlyCredits: 500,
    basePlanId: "premium-mensal",
    billingPeriod: "monthly",
  },
  iattom_premium_anual: {
    internalPlan: "business",
    monthlyCredits: 500,
    basePlanId: "premium-anual",
    billingPeriod: "annual",
  },
  iattom_pro: {
    internalPlan: "agency",
    monthlyCredits: 1000,
    basePlanId: "pro-mensal",
    billingPeriod: "monthly",
  },
  iattom_pro_anual: {
    internalPlan: "agency",
    monthlyCredits: 1000,
    basePlanId: "pro-anual",
    billingPeriod: "annual",
  },
};

function bodyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

router.get("/google-play/subscription/status", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

  try {
    const [latest] = await db
      .select({
        purchaseToken: googlePlayPurchases.purchaseToken,
        productId: googlePlayPurchases.productId,
        basePlanId: googlePlayPurchases.basePlanId,
        internalPlan: googlePlayPurchases.internalPlan,
        expiryTime: googlePlayPurchases.expiryTime,
      })
      .from(googlePlayPurchases)
      .where(
        and(
          eq(googlePlayPurchases.clerkUserId, clerkUserId),
          eq(googlePlayPurchases.productType, "subscription"),
        ),
      )
      .orderBy(desc(googlePlayPurchases.expiryTime), desc(googlePlayPurchases.updatedAt))
      .limit(1);

    if (!latest) {
      res.json({
        ok: true,
        provider: "google_play",
        hasSubscription: false,
        status: "none",
        expiryTime: null,
        productId: null,
        basePlanId: null,
        internalPlan: null,
      });
      return;
    }

    const purchase = await getSubscriptionPurchase(latest.purchaseToken);
    const lineItem = purchase.lineItems?.find(
      (item) =>
        item.productId === latest.productId &&
        (!latest.basePlanId || item.offerDetails?.basePlanId === latest.basePlanId),
    );
    const entitled = isGoogleSubscriptionEntitled(purchase, lineItem);
    const expiryTime = lineItem?.expiryTime ?? latest.expiryTime?.toISOString() ?? null;
    const state = purchase.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED";

    await db
      .update(googlePlayPurchases)
      .set({
        googleState: state,
        expiryTime: toDate(lineItem?.expiryTime) ?? latest.expiryTime,
        updatedAt: new Date(),
      })
      .where(eq(googlePlayPurchases.purchaseToken, latest.purchaseToken));

    res.json({
      ok: true,
      provider: "google_play",
      hasSubscription: entitled,
      status: state,
      expiryTime,
      productId: latest.productId,
      basePlanId: latest.basePlanId,
      internalPlan: latest.internalPlan,
    });
  } catch (error) {
    logger.error({ error, clerkUserId }, "Google Play subscription status failed");
    res.status(502).json({ ok: false, error: "Não foi possível consultar a assinatura no Google Play" });
  }
});

router.post("/google-play/subscription/confirm", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const productId = bodyString(req.body?.productId);
  const requestedBasePlanId = bodyString(req.body?.basePlanId);
  const purchaseToken = bodyString(req.body?.purchaseToken);

  if (!productId || !purchaseToken) {
    res.status(400).json({ ok: false, error: "productId e purchaseToken são obrigatórios" });
    return;
  }

  const entitlement = SUBSCRIPTIONS[productId];
  if (!entitlement) {
    res.status(400).json({ ok: false, error: "Assinatura Google Play não reconhecida" });
    return;
  }

  const basePlanId = entitlement.basePlanId;
  if (requestedBasePlanId && requestedBasePlanId !== basePlanId) {
    res.status(400).json({ ok: false, error: "Plano básico Google Play não corresponde ao produto" });
    return;
  }

  const isAnnual = entitlement.billingPeriod === "annual";

  try {
    const purchase = await verifySubscriptionPurchase(purchaseToken);
    const lineItem = purchase.lineItems?.find(
      (item) => item.productId === productId && item.offerDetails?.basePlanId === basePlanId,
    );

    if (!lineItem || !isGoogleSubscriptionEntitled(purchase, lineItem)) {
      res.status(409).json({ ok: false, error: "Produto, plano básico ou período da assinatura não está ativo" });
      return;
    }

    const periodIdentity = lineItem.latestSuccessfulOrderId ?? lineItem.expiryTime;
    if (!periodIdentity) {
      res.status(502).json({ ok: false, error: "Período da assinatura não pôde ser identificado" });
      return;
    }

    const multiplier = isAnnual ? 12 : 1;
    const grantAmount = entitlement.monthlyCredits * multiplier;
    const eventKey = `subscription:${purchaseToken}:${periodIdentity}`;
    const expiryTime = toDate(lineItem.expiryTime);

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${purchaseToken}))`);

      const [tokenOwner] = await tx
        .select({ clerkUserId: googlePlayPurchases.clerkUserId })
        .from(googlePlayPurchases)
        .where(eq(googlePlayPurchases.purchaseToken, purchaseToken))
        .limit(1);

      if (tokenOwner && tokenOwner.clerkUserId !== clerkUserId) {
        throw new Error("google_subscription_owned_by_another_user");
      }

      const [existing] = await tx
        .select({
          id: googlePlayPurchases.id,
          clerkUserId: googlePlayPurchases.clerkUserId,
          acknowledgedAt: googlePlayPurchases.acknowledgedAt,
        })
        .from(googlePlayPurchases)
        .where(eq(googlePlayPurchases.eventKey, eventKey))
        .limit(1);

      if (existing) {
        if (existing.clerkUserId !== clerkUserId) {
          throw new Error("google_subscription_owned_by_another_user");
        }
        return {
          granted: false,
          alreadyProcessed: true,
          acknowledgedAt: existing.acknowledgedAt,
        };
      }

      const lockedResult = await tx.execute(
        sql`SELECT clerk_id, plan, credits
            FROM users
            WHERE clerk_id = ${clerkUserId}
            FOR UPDATE`,
      );
      const locked = lockedResult.rows[0] as
        | { clerk_id: string; plan: string; credits: number }
        | undefined;
      if (!locked) throw new Error("user_not_found");

      const [inserted] = await tx
        .insert(googlePlayPurchases)
        .values({
          eventKey,
          purchaseToken,
          clerkUserId,
          productId,
          productType: "subscription",
          basePlanId,
          orderId: lineItem.latestSuccessfulOrderId ?? null,
          entitlementType: "plan_credits",
          entitlementAmount: grantAmount,
          internalPlan: entitlement.internalPlan,
          googleState: purchase.subscriptionState ?? "UNKNOWN",
          expiryTime,
        })
        .onConflictDoNothing({ target: googlePlayPurchases.eventKey })
        .returning({ id: googlePlayPurchases.id });

      if (!inserted) {
        const [conflict] = await tx
          .select({ clerkUserId: googlePlayPurchases.clerkUserId })
          .from(googlePlayPurchases)
          .where(eq(googlePlayPurchases.eventKey, eventKey))
          .limit(1);
        if (conflict && conflict.clerkUserId !== clerkUserId) {
          throw new Error("google_subscription_owned_by_another_user");
        }
        return { granted: false, alreadyProcessed: true, acknowledgedAt: null };
      }

      const balanceBefore = Number(locked.credits);
      const balanceAfter = balanceBefore + grantAmount;

      await tx
        .update(users)
        .set({
          plan: entitlement.internalPlan,
          credits: balanceAfter,
          planSelected: true,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, clerkUserId));

      await tx.insert(creditsTransactions).values({
        clerkUserId,
        amount: grantAmount,
        type: "credit",
        balanceType: "general",
        description: isAnnual
          ? `Google Play — franquia anual do plano ${productId} — 12 meses`
          : `Google Play — franquia mensal do plano ${productId}`,
        balanceBefore,
        balanceAfter,
      });

      return { granted: true, alreadyProcessed: false, acknowledgedAt: null };
    });

    let acknowledged = purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
    if (!acknowledged) {
      try {
        await acknowledgeSubscriptionPurchase(productId, purchaseToken);
        acknowledged = true;
        await db
          .update(googlePlayPurchases)
          .set({ acknowledgedAt: new Date(), updatedAt: new Date() })
          .where(eq(googlePlayPurchases.eventKey, eventKey));
      } catch (ackError) {
        logger.error(
          { ackError, clerkUserId, productId, basePlanId, eventKey },
          "Google Play subscription granted but acknowledgement is pending",
        );
      }
    } else if (!result.acknowledgedAt) {
      await db
        .update(googlePlayPurchases)
        .set({ acknowledgedAt: new Date(), updatedAt: new Date() })
        .where(eq(googlePlayPurchases.eventKey, eventKey));
    }

    res.json({
      ok: true,
      ...result,
      productId,
      basePlanId,
      billingPeriod: entitlement.billingPeriod,
      internalPlan: entitlement.internalPlan,
      grantedCredits: result.granted ? grantAmount : 0,
      multiplier,
      subscriptionState: purchase.subscriptionState,
      expiryTime: lineItem.expiryTime ?? null,
      acknowledged,
    });
  } catch (error) {
    logger.error(
      { error, clerkUserId, productId, basePlanId },
      "Google Play subscription confirmation failed",
    );
    const message = error instanceof Error ? error.message : "google_play_subscription_failed";
    if (message === "user_not_found") {
      res.status(404).json({ ok: false, error: "Usuário não encontrado" });
      return;
    }
    if (message === "google_subscription_owned_by_another_user") {
      res.status(409).json({ ok: false, error: "Esta assinatura já está vinculada a outro usuário" });
      return;
    }
    if (message.startsWith("google_subscription_not_entitled")) {
      res.status(409).json({ ok: false, error: "Assinatura não está ativa" });
      return;
    }
    res.status(502).json({ ok: false, error: "Não foi possível confirmar a assinatura no Google Play" });
  }
});

export default router;
