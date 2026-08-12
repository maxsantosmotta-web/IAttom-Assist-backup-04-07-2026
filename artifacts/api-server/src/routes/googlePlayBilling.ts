import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  users,
  creditsTransactions,
  videoTransactions,
  googlePlayPurchases,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { logger } from "../lib/logger.js";
import {
  verifyOneTimePurchase,
  consumeOneTimePurchase,
  verifySubscriptionPurchase,
} from "../lib/googlePlayBillingService.js";

const router: IRouter = Router();

type OneTimeEntitlement = {
  type: "credits" | "images" | "videos";
  quantity: number;
  grantAmount: number;
};

// IDs oficiais já cadastrados no Google Play Console.
const ONE_TIME_PRODUCTS: Record<string, OneTimeEntitlement> = {
  creditos_100: { type: "credits", quantity: 100, grantAmount: 100 },
  creditos_200: { type: "credits", quantity: 200, grantAmount: 200 },
  creditos_500: { type: "credits", quantity: 500, grantAmount: 500 },
  imagens_10: { type: "images", quantity: 10, grantAmount: 100 },
  imagens_20: { type: "images", quantity: 20, grantAmount: 200 },
  imagens_30: { type: "images", quantity: 30, grantAmount: 300 },
  videos_10: { type: "videos", quantity: 10, grantAmount: 10 },
  videos_20: { type: "videos", quantity: 20, grantAmount: 20 },
  videos_30: { type: "videos", quantity: 30, grantAmount: 30 },
};

const SUBSCRIPTION_PRODUCTS = new Set(["iattom_start", "iattom_premium", "iattom_pro"]);
const SUBSCRIPTION_BASE_PLANS = new Set([
  "start-mensal",
  "start-anual",
  "premium-mensal",
  "premium-anual",
  "pro-mensal",
  "pro-anual",
]);

function bodyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function markConsumed(eventKey: string): Promise<void> {
  await db
    .update(googlePlayPurchases)
    .set({ consumedAt: new Date(), updatedAt: new Date() })
    .where(eq(googlePlayPurchases.eventKey, eventKey));
}

router.post("/google-play/one-time/confirm", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const productId = bodyString(req.body?.productId);
  const purchaseToken = bodyString(req.body?.purchaseToken);

  if (!productId || !purchaseToken) {
    res.status(400).json({ ok: false, error: "productId e purchaseToken são obrigatórios" });
    return;
  }

  const entitlement = ONE_TIME_PRODUCTS[productId];
  if (!entitlement) {
    res.status(400).json({ ok: false, error: "Produto Google Play não reconhecido" });
    return;
  }

  const eventKey = `one-time:${purchaseToken}`;

  try {
    const [alreadyProcessed] = await db
      .select({ id: googlePlayPurchases.id, consumedAt: googlePlayPurchases.consumedAt })
      .from(googlePlayPurchases)
      .where(eq(googlePlayPurchases.eventKey, eventKey))
      .limit(1);

    if (alreadyProcessed) {
      if (!alreadyProcessed.consumedAt) {
        const current = await verifyOneTimePurchase(productId, purchaseToken);
        if (current.consumptionState === 1) {
          await markConsumed(eventKey);
        } else {
          await consumeOneTimePurchase(productId, purchaseToken);
          await markConsumed(eventKey);
        }
      }
      res.json({ ok: true, alreadyProcessed: true });
      return;
    }

    const purchase = await verifyOneTimePurchase(productId, purchaseToken);

    const result = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(googlePlayPurchases)
        .values({
          eventKey,
          purchaseToken,
          clerkUserId,
          productId,
          productType: "one_time",
          orderId: purchase.orderId ?? null,
          entitlementType: entitlement.type,
          entitlementAmount: entitlement.grantAmount,
          googleState: "PURCHASED",
        })
        .onConflictDoNothing({ target: googlePlayPurchases.eventKey })
        .returning({ id: googlePlayPurchases.id });

      if (!inserted) {
        return { granted: false, alreadyProcessed: true };
      }

      if (entitlement.type === "credits") {
        const [updated] = await tx
          .update(users)
          .set({
            extraCredits: sql`${users.extraCredits} + ${entitlement.grantAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkUserId))
          .returning({ balanceAfter: users.extraCredits });

        if (!updated) throw new Error("user_not_found");
        const balanceAfter = updated.balanceAfter;
        const balanceBefore = balanceAfter - entitlement.grantAmount;

        await tx.insert(creditsTransactions).values({
          clerkUserId,
          amount: entitlement.grantAmount,
          type: "credit",
          balanceType: "general",
          description: `Google Play — compra de ${entitlement.quantity} créditos`,
          balanceBefore,
          balanceAfter,
        });
      } else if (entitlement.type === "images") {
        const [updated] = await tx
          .update(users)
          .set({
            extraCreativeCredits: sql`${users.extraCreativeCredits} + ${entitlement.grantAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkUserId))
          .returning({ balanceAfter: users.extraCreativeCredits });

        if (!updated) throw new Error("user_not_found");
        const balanceAfter = updated.balanceAfter;
        const balanceBefore = balanceAfter - entitlement.grantAmount;

        await tx.insert(creditsTransactions).values({
          clerkUserId,
          amount: entitlement.grantAmount,
          type: "credit",
          balanceType: "creative",
          description: `Google Play — compra de ${entitlement.quantity} imagens`,
          balanceBefore,
          balanceAfter,
        });
      } else {
        const [updated] = await tx
          .update(users)
          .set({
            videoBalance: sql`${users.videoBalance} + ${entitlement.grantAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkUserId))
          .returning({ balanceAfter: users.videoBalance });

        if (!updated) throw new Error("user_not_found");
        const balanceAfter = updated.balanceAfter;
        const balanceBefore = balanceAfter - entitlement.grantAmount;

        await tx.insert(videoTransactions).values({
          clerkUserId,
          amount: entitlement.grantAmount,
          type: "purchase",
          packId: productId,
          description: `Google Play — compra de ${entitlement.quantity} vídeos`,
          balanceBefore,
          balanceAfter,
        });
      }

      return { granted: true, alreadyProcessed: false };
    });

    if (result.granted) {
      // Os produtos avulsos do IAttom são consumíveis. A concessão no banco vem antes do consume.
      // Se o consume falhar, a ledger impede nova concessão e uma repetição pode finalizar o consume.
      try {
        await consumeOneTimePurchase(productId, purchaseToken);
        await markConsumed(eventKey);
      } catch (consumeError) {
        logger.error(
          { consumeError, clerkUserId, productId, eventKey },
          "Google Play entitlement granted but consume is pending",
        );
      }
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ error, clerkUserId, productId }, "Google Play one-time confirmation failed");
    const message = error instanceof Error ? error.message : "google_play_confirmation_failed";
    if (message === "user_not_found") {
      res.status(404).json({ ok: false, error: "Usuário não encontrado" });
      return;
    }
    if (message.startsWith("google_purchase_not_completed")) {
      res.status(409).json({ ok: false, error: "Compra ainda não está concluída" });
      return;
    }
    res.status(502).json({ ok: false, error: "Não foi possível validar a compra no Google Play" });
  }
});

// Nesta primeira etapa, assinatura é somente validada. Nenhuma franquia é concedida aqui ainda.
router.post("/google-play/subscription/verify", requireAuth, async (req, res): Promise<void> => {
  const productId = bodyString(req.body?.productId);
  const basePlanId = bodyString(req.body?.basePlanId);
  const purchaseToken = bodyString(req.body?.purchaseToken);

  if (!productId || !basePlanId || !purchaseToken) {
    res.status(400).json({ ok: false, error: "productId, basePlanId e purchaseToken são obrigatórios" });
    return;
  }
  if (!SUBSCRIPTION_PRODUCTS.has(productId) || !SUBSCRIPTION_BASE_PLANS.has(basePlanId)) {
    res.status(400).json({ ok: false, error: "Assinatura Google Play não reconhecida" });
    return;
  }

  try {
    const purchase = await verifySubscriptionPurchase(purchaseToken);
    const lineItem = purchase.lineItems?.find(
      (item) => item.productId === productId && item.offerDetails?.basePlanId === basePlanId,
    );

    if (!lineItem) {
      res.status(409).json({ ok: false, error: "Produto ou plano básico não corresponde à compra" });
      return;
    }

    res.json({
      ok: true,
      productId: lineItem.productId,
      basePlanId: lineItem.offerDetails?.basePlanId,
      subscriptionState: purchase.subscriptionState,
      acknowledgementState: purchase.acknowledgementState,
      latestSuccessfulOrderId: lineItem.latestSuccessfulOrderId ?? null,
      expiryTime: lineItem.expiryTime ?? null,
    });
  } catch (error) {
    logger.error({ error, productId, basePlanId }, "Google Play subscription verification failed");
    res.status(502).json({ ok: false, error: "Não foi possível validar a assinatura no Google Play" });
  }
});

export default router;
