import { Router, type IRouter } from "express";
import { eq, gte, or, count } from "drizzle-orm";
import { db, users, historyTable, creditsTransactions } from "@workspace/db";
import { referralsTable, referralUsesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();

const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 400,
  business: 1000,
  agency: 2300,
};

const PLAN_MRR: Record<string, number> = {
  free: 0,
  pro: 79,
  business: 199,
  agency: 499,
};

router.get("/admin/growth-stats", requireAdmin, async (req, res): Promise<void> => {
  try {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    allUsers,
    [newUsersWeekRes],
    [newUsersMonthRes],
    activatedUserIds,
    [totalReferralsRes],
    [totalReferralUsesRes],
    recentCredits,
  ] = await Promise.all([
    db.select({ clerkId: users.clerkId, plan: users.plan, credits: users.credits, createdAt: users.createdAt }).from(users),
    db.select({ count: count() }).from(users).where(gte(users.createdAt, weekAgo)),
    db.select({ count: count() }).from(users).where(gte(users.createdAt, monthAgo)),
    db.selectDistinct({ clerkUserId: historyTable.clerkUserId }).from(historyTable),
    db.select({ count: count() }).from(referralsTable),
    db.select({ count: count() }).from(referralUsesTable),
    db.select({ amount: creditsTransactions.amount, createdAt: creditsTransactions.createdAt })
      .from(creditsTransactions)
      .where(gte(creditsTransactions.createdAt, monthAgo))
      .limit(500),
  ]);

  const activatedSet = new Set(activatedUserIds.map((r) => r.clerkUserId));
  const totalUsers = allUsers.length;
  const activatedCount = allUsers.filter((u) => activatedSet.has(u.clerkId)).length;
  const activationRate = totalUsers > 0 ? Math.round((activatedCount / totalUsers) * 100) : 0;

  const paidUsers = allUsers.filter((u) => u.plan !== "free");
  const conversionRate = totalUsers > 0 ? Math.round((paidUsers.length / totalUsers) * 100) : 0;

  const mrr = allUsers.reduce((sum, u) => sum + (PLAN_MRR[u.plan] ?? 0), 0);

  const churnRisk = paidUsers
    .filter((u) => {
      const limit = PLAN_CREDITS[u.plan] ?? 50;
      return (u.credits / limit) < 0.15;
    })
    .slice(0, 20)
    .map((u) => ({
      clerkId: u.clerkId,
      plan: u.plan,
      credits: u.credits,
      planLimit: PLAN_CREDITS[u.plan] ?? 50,
      pct: Math.round((u.credits / (PLAN_CREDITS[u.plan] ?? 50)) * 100),
    }));

  const creditsSpentThisMonth = recentCredits
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  res.json({
    mrr,
    activeSubscribers: paidUsers.length,
    totalUsers,
    conversionRate,
    activationRate,
    activatedCount,
    newUsersThisWeek: newUsersWeekRes.count,
    newUsersThisMonth: newUsersMonthRes.count,
    churnRisk,
    totalReferralCodes: totalReferralsRes.count,
    totalReferralUses: totalReferralUsesRes.count,
    creditsSpentThisMonth,
    planBreakdown: {
      free: allUsers.filter((u) => u.plan === "free").length,
      pro: allUsers.filter((u) => u.plan === "pro").length,
      business: allUsers.filter((u) => u.plan === "business").length,
      agency: allUsers.filter((u) => u.plan === "agency").length,
    },
  });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to fetch growth stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
