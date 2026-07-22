import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, users, creditsTransactions } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { getOrCreateUserFromClerk } from "../lib/userSync";
import {
  GetCreditsBalanceResponse,
  ListCreditTransactionsResponse,
  UseCreditsBody,
  UseCreditsResponse,
} from "@workspace/api-zod";
import {
  deductCredits,
  FEATURE_COSTS,
  PLAN_CREDITS,
  PLAN_CREATIVE_CREDITS,
  CREATIVE_FEATURES,
  type FeatureKey,
  getTransactionCount,
} from "../lib/credits";

const router: IRouter = Router();

const LEGACY_CREATIVE_PLAN_GRANTS: Record<string, number> = {
  pro: 100,
  business: 150,
  agency: 250,
};

async function normalizeLegacyCreativeBalance(
  clerkUserId: string,
  user: typeof users.$inferSelect,
): Promise<typeof users.$inferSelect> {
  const plan = user.plan as keyof typeof PLAN_CREATIVE_CREDITS;
  const intendedGrant = PLAN_CREATIVE_CREDITS[plan] ?? 0;
  const legacyGrant = LEGACY_CREATIVE_PLAN_GRANTS[plan] ?? intendedGrant;
  const legacyExcess = Math.max(0, legacyGrant - intendedGrant);

  if (legacyExcess <= 0 || user.creativeCredits <= intendedGrant) return user;

  const balanceBefore = user.creativeCredits;
  const balanceAfter = Math.max(0, balanceBefore - legacyExcess);

  const [updated] = await db
    .update(users)
    .set({ creativeCredits: balanceAfter, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkUserId))
    .returning();

  await db.insert(creditsTransactions).values({
    clerkUserId,
    amount: balanceAfter - balanceBefore,
    type: "adjustment",
    balanceType: "creative",
    description: "Correção única de franquia criativa antiga, preservando o consumo realizado",
    balanceBefore,
    balanceAfter,
  });

  return updated ?? { ...user, creativeCredits: balanceAfter };
}

router.get("/credits/balance", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  let [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));

  if (!user) {
    const created = await getOrCreateUserFromClerk(clerkUserId);
    if (!created) { res.status(500).json({ error: "Failed to resolve user from Clerk" }); return; }
    user = created;
  }

  user = await normalizeLegacyCreativeBalance(clerkUserId, user);

  const plan = user.plan as keyof typeof PLAN_CREDITS;
  const planLimit = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;
  const creativePlanLimit = PLAN_CREATIVE_CREDITS[plan] ?? PLAN_CREATIVE_CREDITS.free;

  const percentage = planLimit > 0 ? Math.min(100, Math.round((user.credits / planLimit) * 100)) : 0;
  const creativePercentage = creativePlanLimit > 0
    ? Math.min(100, Math.round((user.creativeCredits / creativePlanLimit) * 100))
    : 0;
  const lowCredit = percentage < 20;
  const lowCreativeCredit = creativePercentage < 20;

  res.json(GetCreditsBalanceResponse.parse({
    balance: user.credits + (user.extraCredits ?? 0),
    creativeBalance: user.creativeCredits + (user.extraCreativeCredits ?? 0),
    plan: user.plan,
    planLimit,
    creativePlanLimit,
    percentage,
    creativePercentage,
    lowCredit,
    lowCreativeCredit,
    featureCosts: FEATURE_COSTS,
  }));
});

router.get("/credits/transactions", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 100);
  const offset = parseInt((req.query.offset as string) || "0", 10);

  const [txList, total, [userRow]] = await Promise.all([
    db.select()
      .from(creditsTransactions)
      .where(eq(creditsTransactions.clerkUserId, clerkUserId))
      .orderBy(desc(creditsTransactions.createdAt))
      .limit(limit)
      .offset(offset),
    getTransactionCount(clerkUserId),
    db.select({ credits: users.credits, extraCredits: users.extraCredits }).from(users).where(eq(users.clerkId, clerkUserId)),
  ]);

  res.json(ListCreditTransactionsResponse.parse({
    transactions: txList,
    total,
    balance: (userRow?.credits ?? 0) + (userRow?.extraCredits ?? 0),
  }));
});

router.post("/credits/use", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;

  const parsed = UseCreditsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const feature = parsed.data.feature as FeatureKey;
  const result = await deductCredits(clerkUserId, feature);

  if (!result.success) {
    if (result.error === "user_not_found") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (process.env.GLOBAL_BETA_MODE === "true") {
      req.log.info({ clerkUserId, feature }, "credits/use: global beta bypass — insufficient credits ignored");
      res.json(UseCreditsResponse.parse({ creditsUsed: 0, newBalance: result.balance ?? 0, transactionId: 0 }));
      return;
    }
    res.status(402).json({
      error: "insufficient_credits",
      balance: result.balance,
      required: result.required,
    });
    return;
  }

  res.json(UseCreditsResponse.parse({
    creditsUsed: result.creditsUsed,
    newBalance: result.newBalance,
    transactionId: result.transactionId,
  }));
});

router.post("/credits/refund", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const { feature } = req.body as { feature?: string };
  const featureKey = (feature ?? "") as FeatureKey;
  const cost = FEATURE_COSTS[featureKey] ?? 0;
  if (cost <= 0) {
    res.json({ ok: true, refunded: 0 });
    return;
  }
  const isCreative = CREATIVE_FEATURES.has(featureKey);
  try {
    if (isCreative) {
      await db
        .update(users)
        .set({ creativeCredits: sql`${users.creativeCredits} + ${cost}` })
        .where(eq(users.clerkId, clerkUserId));
    } else {
      await db
        .update(users)
        .set({ credits: sql`${users.credits} + ${cost}` })
        .where(eq(users.clerkId, clerkUserId));
    }
    req.log.info({ clerkUserId, feature: featureKey, cost, isCreative }, "credits: reembolso por falha técnica");
    res.json({ ok: true, refunded: cost });
  } catch (err) {
    req.log.error({ err }, "credits: falha ao processar reembolso");
    res.status(500).json({ error: "Erro ao processar reembolso" });
  }
});

export default router;
