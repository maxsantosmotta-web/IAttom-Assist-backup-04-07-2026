import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, users, creditsTransactions } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import {
  GetCreditsBalanceResponse,
  ListCreditTransactionsResponse,
  UseCreditsBody,
  UseCreditsResponse,
} from "@workspace/api-zod";
import { deductCredits, FEATURE_COSTS, PLAN_CREDITS, type FeatureKey, getTransactionCount } from "../lib/credits";

const router: IRouter = Router();

router.get("/credits/balance", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const plan = user.plan as keyof typeof PLAN_CREDITS;
  const planLimit = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;

  const percentage = planLimit > 0 ? Math.min(100, Math.round((user.credits / planLimit) * 100)) : 0;
  const lowCredit = percentage < 20;

  res.json(GetCreditsBalanceResponse.parse({
    balance: user.credits,
    plan: user.plan,
    planLimit,
    percentage,
    lowCredit,
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
    db.select({ credits: users.credits }).from(users).where(eq(users.clerkId, clerkUserId)),
  ]);

  res.json(ListCreditTransactionsResponse.parse({
    transactions: txList,
    total,
    balance: userRow?.credits ?? 0,
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

export default router;
