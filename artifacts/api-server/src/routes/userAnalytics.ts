import { Router, type IRouter } from "express";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { db, historyTable, creditsTransactions, projectsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

router.get("/analytics/user", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const days = parseInt((req.query.days as string) || "30", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [activityByModule, creditsSpent, recentHistory, projectStats] = await Promise.all([
    db
      .select({
        module: historyTable.module,
        count: sql<number>`count(*)::int`,
      })
      .from(historyTable)
      .where(and(eq(historyTable.clerkUserId, clerkUserId), gte(historyTable.createdAt, since)))
      .groupBy(historyTable.module),

    db
      .select({
        day: sql<string>`date_trunc('day', ${creditsTransactions.createdAt})::text`,
        spent: sql<number>`abs(sum(${creditsTransactions.amount}))::int`,
      })
      .from(creditsTransactions)
      .where(
        and(
          eq(creditsTransactions.clerkUserId, clerkUserId),
          gte(creditsTransactions.createdAt, since),
          sql`${creditsTransactions.amount} < 0`,
        ),
      )
      .groupBy(sql`date_trunc('day', ${creditsTransactions.createdAt})`)
      .orderBy(sql`date_trunc('day', ${creditsTransactions.createdAt})`),

    db
      .select()
      .from(historyTable)
      .where(eq(historyTable.clerkUserId, clerkUserId))
      .orderBy(desc(historyTable.createdAt))
      .limit(5),

    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${projectsTable.status} = 'completed')::int`,
        inProgress: sql<number>`count(*) filter (where ${projectsTable.status} = 'in_progress')::int`,
      })
      .from(projectsTable)
      .where(eq(projectsTable.clerkUserId, clerkUserId)),
  ]);

  res.json({
    activityByModule,
    creditsSpent,
    recentHistory,
    projectStats: projectStats[0] ?? { total: 0, completed: 0, inProgress: 0 },
    days,
  });
});

export default router;
