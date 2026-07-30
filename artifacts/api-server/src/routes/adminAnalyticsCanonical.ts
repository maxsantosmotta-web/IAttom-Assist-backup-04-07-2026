import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  db,
  historyTable,
  projectsTable,
  savedItemsTable,
  users,
} from "@workspace/db";
import { GetAdminAnalyticsResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();

const BASELINE_CUTOFF = new Date("2026-07-30T07:15:00.000Z");
const BASELINE_COUNTS: Record<string, number> = {
  creative: 5,
  video_effect: 9,
  campaign: 4,
  product_discovery: 4,
  product_validation: 4,
  content: 3,
  video_script: 2,
  prompt: 4,
};

const MODULE_ORDER = [
  "creative",
  "video_effect",
  "campaign",
  "product_discovery",
  "product_validation",
  "content",
  "video_script",
  "prompt",
  "marketing",
] as const;

function moduleOrder(module: string): number {
  const index = MODULE_ORDER.indexOf(module as (typeof MODULE_ORDER)[number]);
  return index === -1 ? MODULE_ORDER.length : index;
}

function baselineTotal(): number {
  return Object.values(BASELINE_COUNTS).reduce((sum, value) => sum + value, 0);
}

async function postCutoffModuleRows(): Promise<Array<{ module: string; count: number }>> {
  const rows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .where(gte(historyTable.createdAt, BASELINE_CUTOFF))
    .groupBy(historyTable.module)
    .orderBy(desc(count()));

  return rows.map((row) => ({ module: row.module, count: Number(row.count) }));
}

function canonicalModuleRows(postCutoffRows: Array<{ module: string; count: number }>) {
  const counts = new Map<string, number>(Object.entries(BASELINE_COUNTS));
  for (const row of postCutoffRows) {
    counts.set(row.module, (counts.get(row.module) ?? 0) + Number(row.count));
  }

  return [...counts.entries()]
    .map(([module, countValue]) => ({ module, count: countValue }))
    .filter((row) => row.count > 0)
    .sort((left, right) => {
      const orderDifference = moduleOrder(left.module) - moduleOrder(right.module);
      return orderDifference !== 0 ? orderDifference : right.count - left.count;
    });
}

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    [totalUsers],
    [totalProjects],
    [newActions],
    [adminCount],
    [freeCount],
    [startCount],
    [premiumCount],
    [proCount],
    [newUsers],
    [newProjects],
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(savedItemsTable).where(isNull(savedItemsTable.deletedAt)),
    db.select({ count: count() }).from(historyTable).where(gte(historyTable.createdAt, BASELINE_CUTOFF)),
    db.select({ count: count() }).from(users).where(eq(users.role, "admin")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "free")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "pro")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "business")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "agency")),
    db.select({ count: count() }).from(users).where(gte(users.createdAt, monthStart)),
    db.select({ count: count() }).from(savedItemsTable).where(and(gte(savedItemsTable.createdAt, monthStart), isNull(savedItemsTable.deletedAt))),
  ]);

  res.json({
    totalUsers: totalUsers.count,
    totalProjects: totalProjects.count,
    totalActions: baselineTotal() + Number(newActions.count),
    adminCount: adminCount.count,
    planBreakdown: {
      free: freeCount.count,
      pro: startCount.count,
      business: premiumCount.count,
      agency: proCount.count,
    },
    newUsersThisMonth: newUsers.count,
    newProjectsThisMonth: newProjects.count,
  });
});

router.get("/admin/activity", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number.parseInt(String(req.query.limit ?? "100"), 10) || 100, 100);
  const items = await db
    .select({
      id: historyTable.id,
      action: historyTable.action,
      module: historyTable.module,
      projectName: historyTable.projectName,
      createdAt: historyTable.createdAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(historyTable)
    .leftJoin(users, eq(historyTable.clerkUserId, users.clerkId))
    .where(gte(historyTable.createdAt, BASELINE_CUTOFF))
    .orderBy(desc(historyTable.createdAt))
    .limit(limit);

  res.json(items.map((item) => ({
    id: item.id,
    action: item.action,
    module: item.module,
    projectName: item.projectName ?? undefined,
    userEmail: item.userEmail ?? undefined,
    userName: item.userName ?? undefined,
    createdAt: item.createdAt,
  })));
});

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
    postCutoffRows,
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
    postCutoffModuleRows(),
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

  const moduleRows = canonicalModuleRows(postCutoffRows);
  const totalModuleCount = moduleRows.reduce((total, row) => total + row.count, 0) || 1;
  const featureUsage = moduleRows.map((row) => ({
    name: row.module.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
    count: row.count,
    percentage: Math.round((row.count / totalModuleCount) * 100),
  }));

  const percentageTotal = featureUsage.reduce((total, item) => total + item.percentage, 0);
  if (featureUsage.length > 0 && percentageTotal !== 100) {
    featureUsage[0].percentage += 100 - percentageTotal;
  }

  const planRevenue = [
    { plan: "Free", users: freeRes.count, mrr: 0 },
    { plan: "Pro", users: proRes.count, mrr: proRes.count * 79 },
    { plan: "Business", users: businessRes.count, mrr: businessRes.count * 199 },
  ];

  res.json(GetAdminAnalyticsResponse.parse({ userGrowth, featureUsage, planRevenue }));
});

export default router;
