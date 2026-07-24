import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db, users, savedItemsTable, historyTable, creditsTransactions } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const HELP_LIMITS: Record<string, number> = {
  free: 0,
  pro: 200,
  business: 350,
  agency: 700,
};

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const { search, plan, role, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const limitNum = Math.min(Number.parseInt(limit, 10) || 50, 100);
  const offsetNum = Number.parseInt(offset, 10) || 0;

  const conditions = [];
  if (search) conditions.push(or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)));
  if (plan && ["free", "pro", "business", "agency"].includes(plan)) {
    conditions.push(eq(users.plan, plan as "free" | "pro" | "business" | "agency"));
  }
  if (role && ["user", "admin"].includes(role)) {
    conditions.push(eq(users.role, role as "user" | "admin"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [allUsers, [totalRes]] = await Promise.all([
    db.select().from(users).where(whereClause).orderBy(desc(users.createdAt)).limit(limitNum).offset(offsetNum),
    db.select({ count: count() }).from(users).where(whereClause),
  ]);

  const clerkIds = allUsers.map((user) => user.clerkId);
  const clerkUsers = clerkIds.length > 0
    ? await clerkClient.users.getUserList({ userId: clerkIds, limit: clerkIds.length }).then((result) => result.data)
    : [];
  const bannedByClerkId = new Map(clerkUsers.map((user) => [user.id, user.banned ?? false]));

  const enrichedUsers = await Promise.all(allUsers.map(async (user) => {
    const [[projectCount], [actionCount], [packageCounts]] = await Promise.all([
      db.select({ count: count() })
        .from(savedItemsTable)
        .where(and(eq(savedItemsTable.clerkUserId, user.clerkId), isNull(savedItemsTable.deletedAt))),
      db.select({ count: count() })
        .from(historyTable)
        .where(and(eq(historyTable.clerkUserId, user.clerkId), isNull(historyTable.deletedAt))),
      db.select({
        creditPackages: sql<number>`count(*) filter (where ${creditsTransactions.stripeSessionId} is not null and ${creditsTransactions.amount} > 0 and coalesce(${creditsTransactions.balanceType}, 'general') <> 'creative')::int`,
        imagePackages: sql<number>`count(*) filter (where ${creditsTransactions.stripeSessionId} is not null and ${creditsTransactions.amount} > 0 and ${creditsTransactions.balanceType} = 'creative')::int`,
      })
        .from(creditsTransactions)
        .where(eq(creditsTransactions.clerkUserId, user.clerkId)),
    ]);

    const helpLimit = HELP_LIMITS[user.plan] ?? 0;
    const helpUsed = Math.max(user.helpMessagesUsed ?? 0, 0);
    const generalPlanCredits = user.credits ?? 0;
    const generalExtraCredits = user.extraCredits ?? 0;
    const imagePlanCredits = user.creativeCredits ?? 0;
    const imageExtraCredits = user.extraCreativeCredits ?? 0;

    return {
      ...user,
      projectCount: projectCount.count,
      actionCount: actionCount.count,
      banned: bannedByClerkId.get(user.clerkId) ?? false,
      generalPlanCredits,
      generalExtraCredits,
      totalCredits: generalPlanCredits + generalExtraCredits,
      imagePlanCredits,
      imageExtraCredits,
      totalImages: Math.floor((imagePlanCredits + imageExtraCredits) / 10),
      helpUsed,
      helpLimit,
      helpRemaining: Math.max(helpLimit - helpUsed, 0),
      creditPackageCount: packageCounts.creditPackages ?? 0,
      imagePackageCount: packageCounts.imagePackages ?? 0,
    };
  }));

  res.json({ users: enrichedUsers, total: totalRes.count });
});

export default router;
