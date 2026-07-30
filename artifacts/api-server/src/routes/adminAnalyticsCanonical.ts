import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  db,
  historyTable,
  projectsTable,
  savedItemsTable,
  users,
  videoTransactions,
} from "@workspace/db";
import { GetAdminAnalyticsResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();

router.get("/admin/analytics", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    [freeRes],
    [proRes],
    [businessRes],
    newUsersByMonth,
    newProjectsByMonth,
    moduleRows,
    completedVideoUses,
    persistedVideoAssets,
  ] = await Promise.all([
    db.select({ count: count() }).from(users).where(eq(users.plan, "free")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "pro")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "business")),
    db
      .select({
        month: sql<string>`date_trunc('month', ${users.createdAt})::text`,
        total: count(),
      })
      .from(users)
      .where(gte(users.createdAt, sixMonthsAgo))
      .groupBy(sql`date_trunc('month', ${users.createdAt})`)
      .orderBy(sql`date_trunc('month', ${users.createdAt})`),
    db
      .select({
        month: sql<string>`date_trunc('month', ${projectsTable.createdAt})::text`,
        total: count(),
      })
      .from(projectsTable)
      .where(gte(projectsTable.createdAt, sixMonthsAgo))
      .groupBy(sql`date_trunc('month', ${projectsTable.createdAt})`)
      .orderBy(sql`date_trunc('month', ${projectsTable.createdAt})`),
    db
      .select({ module: historyTable.module, count: count() })
      .from(historyTable)
      .where(isNull(historyTable.deletedAt))
      .groupBy(historyTable.module)
      .orderBy(desc(count())),
    db
      .select({ count: count() })
      .from(videoTransactions)
      .where(and(
        eq(videoTransactions.type, "use"),
        sql`${videoTransactions.amount} < 0`,
      )),
    db
      .select({
        count: sql<number>`coalesce(sum(jsonb_array_length(coalesce(nullif(${savedItemsTable.videosData}, ''), '[]')::jsonb)), 0)::int`,
      })
      .from(savedItemsTable)
      .where(isNull(savedItemsTable.deletedAt)),
  ]);

  const userMap = new Map(newUsersByMonth.map((row) => [row.month.slice(0, 7), row.total]));
  const projectMap = new Map(newProjectsByMonth.map((row) => [row.month.slice(0, 7), row.total]));
  const userGrowth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() - (5 - index));
    date.setDate(1);
    const key = date.toISOString().slice(0, 7);
    return {
      month: date.toLocaleString("pt-BR", { month: "short", year: "2-digit" }),
      users: userMap.get(key) ?? 0,
      projects: projectMap.get(key) ?? 0,
    };
  });

  const persistedVideoCount = Number(persistedVideoAssets[0]?.count ?? 0);
  const completedVideoCount = Number(completedVideoUses[0]?.count ?? 0);
  const trackedVideoCount = Number(
    moduleRows.find((row) => row.module === "video_effect")?.count ?? 0,
  );
  const videoEffectCount = Math.max(
    persistedVideoCount,
    completedVideoCount + trackedVideoCount,
  );

  const canonicalModuleRows = [
    ...moduleRows.filter((row) => row.module !== "video_effect"),
    { module: "video_effect", count: videoEffectCount },
  ];
  const totalModuleCount = canonicalModuleRows.reduce(
    (total, row) => total + Number(row.count),
    0,
  ) || 1;
  const featureUsage = canonicalModuleRows.map((row) => ({
    name: row.module.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
    count: Number(row.count),
    percentage: Math.round((Number(row.count) / totalModuleCount) * 100),
  }));

  const planRevenue = [
    { plan: "Free", users: freeRes.count, mrr: 0 },
    { plan: "Pro", users: proRes.count, mrr: proRes.count * 79 },
    { plan: "Business", users: businessRes.count, mrr: businessRes.count * 199 },
  ];

  res.json(GetAdminAnalyticsResponse.parse({ userGrowth, featureUsage, planRevenue }));
});

export default router;
