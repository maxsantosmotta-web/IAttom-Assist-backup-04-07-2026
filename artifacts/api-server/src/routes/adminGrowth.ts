import { Router, type IRouter } from "express";
import { eq, gte, and, count, sql } from "drizzle-orm";
import { db, users, historyTable, creditsTransactions } from "@workspace/db";
import { referralsTable, referralUsesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();
const OWNER_EMAIL = "maxsantosmotta@gmail.com";

const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 400,
  business: 1000,
  agency: 2300,
};

const PLAN_MRR: Record<string, number> = {
  free: 0,
  pro: 69,
  business: 159,
  agency: 299,
};

const commercialUserCondition = and(
  eq(users.role, "user"),
  sql`lower(coalesce(${users.email}, '')) <> ${OWNER_EMAIL}`,
);

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
      db.select({
        clerkId: users.clerkId,
        plan: users.plan,
        credits: users.credits,
        stripeCustomerId: users.stripeCustomerId,
      }).from(users).where(commercialUserCondition),
      db.select({ count: count() }).from(users).where(and(commercialUserCondition, gte(users.createdAt, weekAgo))),
      db.select({ count: count() }).from(users).where(and(commercialUserCondition, gte(users.createdAt, monthAgo))),
      db.selectDistinct({ clerkUserId: historyTable.clerkUserId }).from(historyTable),
      db.select({ count: count() }).from(referralsTable),
      db.select({ count: count() }).from(referralUsesTable),
      db.select({
        amount: creditsTransactions.amount,
        clerkUserId: creditsTransactions.clerkUserId,
      }).from(creditsTransactions).where(gte(creditsTransactions.createdAt, monthAgo)).limit(500),
    ]);

    const activatedSet = new Set(activatedUserIds.map((row) => row.clerkUserId));
    const totalUsers = allUsers.length;
    const activatedCount = allUsers.filter((user) => activatedSet.has(user.clerkId)).length;
    const activationRate = totalUsers > 0 ? Math.round((activatedCount / totalUsers) * 100) : 0;

    // Revenue is fail-closed: only subscriptions confirmed by Stripe Sync as
    // active/trialing AND livemode=true are allowed into commercial metrics.
    // Test-mode subscriptions and stale status fields on users never count.
    const liveCustomerIds = new Set<string>();
    try {
      const liveSubscriptions = await db.execute(
        sql`SELECT DISTINCT customer
            FROM stripe.subscriptions
            WHERE status IN ('active', 'trialing')
              AND livemode = true
              AND customer IS NOT NULL`,
      );

      for (const row of liveSubscriptions.rows as Array<{ customer?: string | null }>) {
        if (typeof row.customer === "string" && row.customer.trim()) {
          liveCustomerIds.add(row.customer);
        }
      }
    } catch (error) {
      req.log.warn({ error }, "Commercial analytics could not confirm live Stripe subscriptions; returning zero paid revenue");
    }

    const paidUsers = allUsers.filter((user) =>
      user.plan !== "free" &&
      typeof user.stripeCustomerId === "string" &&
      liveCustomerIds.has(user.stripeCustomerId),
    );

    const conversionRate = totalUsers > 0 ? Math.round((paidUsers.length / totalUsers) * 100) : 0;
    const mrr = paidUsers.reduce((sum, user) => sum + (PLAN_MRR[user.plan] ?? 0), 0);

    const churnRisk = paidUsers
      .filter((user) => {
        const limit = PLAN_CREDITS[user.plan] ?? 0;
        return limit > 0 && user.credits / limit < 0.15;
      })
      .slice(0, 20)
      .map((user) => {
        const planLimit = PLAN_CREDITS[user.plan] ?? 0;
        return {
          clerkId: user.clerkId,
          plan: user.plan,
          credits: user.credits,
          planLimit,
          pct: planLimit > 0 ? Math.round((user.credits / planLimit) * 100) : 0,
        };
      });

    const customerIds = new Set(allUsers.map((user) => user.clerkId));
    const creditsSpentThisMonth = recentCredits
      .filter((transaction) => transaction.amount < 0 && customerIds.has(transaction.clerkUserId))
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

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
        free: allUsers.filter((user) => user.plan === "free").length,
        pro: paidUsers.filter((user) => user.plan === "pro").length,
        business: paidUsers.filter((user) => user.plan === "business").length,
        agency: paidUsers.filter((user) => user.plan === "agency").length,
      },
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to fetch growth stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
