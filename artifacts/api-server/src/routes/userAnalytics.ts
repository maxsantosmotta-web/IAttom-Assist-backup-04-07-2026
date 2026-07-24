import { Router, type IRouter } from "express";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { creditsTransactions, db, historyTable, savedItemsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

router.get("/analytics/user", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const days = parseInt((req.query.days as string) || "30", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [activityByModule, creditsSpent, imagesSpent, recentHistory, projectStats] = await Promise.all([
    db
      .select({
        module: historyTable.module,
        count: sql<number>`count(*)::int`,
      })
      .from(historyTable)
      .where(and(
        eq(historyTable.clerkUserId, clerkUserId),
        gte(historyTable.createdAt, since),
        isNull(historyTable.deletedAt),
      ))
      .groupBy(historyTable.module),

    db
      .select({
        day: sql<string>`date_trunc('day', ${creditsTransactions.createdAt})::text`,
        spent: sql<number>`abs(sum(${creditsTransactions.amount}))::int`,
      })
      .from(creditsTransactions)
      .where(and(
        eq(creditsTransactions.clerkUserId, clerkUserId),
        gte(creditsTransactions.createdAt, since),
        sql`${creditsTransactions.amount} < 0`,
        sql`coalesce(${creditsTransactions.balanceType}, 'general') <> 'creative'`,
      ))
      .groupBy(sql`date_trunc('day', ${creditsTransactions.createdAt})`)
      .orderBy(sql`date_trunc('day', ${creditsTransactions.createdAt})`),

    db
      .select({
        day: sql<string>`date_trunc('day', ${creditsTransactions.createdAt})::text`,
        spent: sql<number>`(abs(sum(${creditsTransactions.amount})) / 10)::int`,
      })
      .from(creditsTransactions)
      .where(and(
        eq(creditsTransactions.clerkUserId, clerkUserId),
        gte(creditsTransactions.createdAt, since),
        sql`${creditsTransactions.amount} < 0`,
        eq(creditsTransactions.balanceType, "creative"),
      ))
      .groupBy(sql`date_trunc('day', ${creditsTransactions.createdAt})`)
      .orderBy(sql`date_trunc('day', ${creditsTransactions.createdAt})`),

    db
      .select()
      .from(historyTable)
      .where(and(eq(historyTable.clerkUserId, clerkUserId), isNull(historyTable.deletedAt)))
      .orderBy(desc(historyTable.createdAt))
      .limit(5),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(savedItemsTable)
      .where(and(eq(savedItemsTable.clerkUserId, clerkUserId), isNull(savedItemsTable.deletedAt))),
  ]);

  const totalProjects = projectStats[0]?.total ?? 0;

  res.json({
    activityByModule,
    creditsSpent,
    imagesSpent,
    recentHistory,
    projectStats: { total: totalProjects, completed: totalProjects, inProgress: 0 },
    days,
  });
});

export default router;
