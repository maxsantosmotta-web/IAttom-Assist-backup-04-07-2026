import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  creditsTransactions,
  db,
  historyTable,
  savedItemsTable,
  users,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();

function featureLabel(feature: string | null, description: string): string {
  const raw = `${feature ?? ""} ${description}`.toLowerCase();
  if (raw.includes("campaign")) return "campaign";
  if (raw.includes("prompt")) return "prompt_creation";
  if (raw.includes("product_discovery") || raw.includes("descoberta")) return "product_discovery";
  if (raw.includes("product_validation") || raw.includes("validação") || raw.includes("validacao")) return "product_validation";
  if (raw.includes("video_script") || raw.includes("script")) return "video_script";
  if (raw.includes("content") || raw.includes("conteúdo") || raw.includes("conteudo")) return "content";
  if (raw.includes("creative") || raw.includes("imagem")) return "creative";
  return "Consumo legado sem identificação";
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    [totalUsers],
    [totalProjects],
    [totalActions],
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
    db.select({ count: count() }).from(historyTable).where(isNull(historyTable.deletedAt)),
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
    totalActions: totalActions.count,
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

router.get("/admin/analytics", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [userRows, projectRows, moduleRows, planRows] = await Promise.all([
    db.select({
      month: sql<string>`date_trunc('month', ${users.createdAt})::text`,
      total: count(),
    }).from(users).where(gte(users.createdAt, firstMonth)).groupBy(sql`date_trunc('month', ${users.createdAt})`),
    db.select({
      month: sql<string>`date_trunc('month', ${savedItemsTable.createdAt})::text`,
      total: count(),
    }).from(savedItemsTable)
      .where(and(gte(savedItemsTable.createdAt, firstMonth), isNull(savedItemsTable.deletedAt)))
      .groupBy(sql`date_trunc('month', ${savedItemsTable.createdAt})`),
    db.select({ module: historyTable.module, count: count() })
      .from(historyTable)
      .where(isNull(historyTable.deletedAt))
      .groupBy(historyTable.module)
      .orderBy(desc(count())),
    db.select({ plan: users.plan, count: count() }).from(users).groupBy(users.plan),
  ]);

  const userMap = new Map(userRows.map((row) => [row.month.slice(0, 7), row.total]));
  const projectMap = new Map(projectRows.map((row) => [row.month.slice(0, 7), row.total]));
  const userGrowth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = monthKey(date);
    return {
      month: date.toLocaleString("pt-BR", { month: "short", year: "2-digit" }),
      users: userMap.get(key) ?? 0,
      projects: projectMap.get(key) ?? 0,
    };
  });

  const totalActions = moduleRows.reduce((sum, row) => sum + Number(row.count), 0) || 1;
  const featureUsage = moduleRows.map((row) => ({
    name: row.module.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    count: Number(row.count),
    percentage: Math.round((Number(row.count) / totalActions) * 100),
  }));
  const percentageTotal = featureUsage.reduce((sum, item) => sum + item.percentage, 0);
  if (featureUsage.length > 0 && percentageTotal !== 100) {
    featureUsage[0].percentage += 100 - percentageTotal;
  }

  const planCounts = new Map(planRows.map((row) => [row.plan, Number(row.count)]));
  const planRevenue = [
    { plan: "Start", users: planCounts.get("pro") ?? 0, mrr: (planCounts.get("pro") ?? 0) * 0.5 },
    { plan: "Premium", users: planCounts.get("business") ?? 0, mrr: (planCounts.get("business") ?? 0) * 0.5 },
    { plan: "Pro", users: planCounts.get("agency") ?? 0, mrr: (planCounts.get("agency") ?? 0) * 0.5 },
  ];

  res.json({ userGrowth, featureUsage, planRevenue });
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
    .where(isNull(historyTable.deletedAt))
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

router.get("/admin/credits-analytics", requireAdmin, async (req, res): Promise<void> => {
  const days = Math.min(Number.parseInt(String(req.query.days ?? "30"), 10) || 30, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      clerkUserId: creditsTransactions.clerkUserId,
      amount: creditsTransactions.amount,
      feature: creditsTransactions.feature,
      description: creditsTransactions.description,
      balanceType: creditsTransactions.balanceType,
      createdAt: creditsTransactions.createdAt,
      plan: users.plan,
    })
    .from(creditsTransactions)
    .innerJoin(users, eq(users.clerkId, creditsTransactions.clerkUserId))
    .where(and(gte(creditsTransactions.createdAt, since), sql`${creditsTransactions.amount} < 0`));

  const generalByFeature = new Map<string, { total: number; ops: number }>();
  const generalByDay = new Map<string, number>();
  const generalByPlan = new Map<string, { total: number; users: Set<string> }>();
  const imageByFeature = new Map<string, { total: number; ops: number }>();
  const imageByDay = new Map<string, number>();
  let imageTotal = 0;

  for (const row of rows) {
    const label = featureLabel(row.feature, row.description);
    const day = row.createdAt.toISOString().slice(0, 10);
    const absolute = Math.abs(row.amount);

    if (row.balanceType === "creative") {
      const images = absolute / 10;
      const feature = imageByFeature.get(label) ?? { total: 0, ops: 0 };
      feature.total += images;
      feature.ops += 1;
      imageByFeature.set(label, feature);
      imageByDay.set(day, (imageByDay.get(day) ?? 0) + images);
      imageTotal += images;
      continue;
    }

    const feature = generalByFeature.get(label) ?? { total: 0, ops: 0 };
    feature.total += absolute;
    feature.ops += 1;
    generalByFeature.set(label, feature);
    generalByDay.set(day, (generalByDay.get(day) ?? 0) + absolute);

    const plan = generalByPlan.get(row.plan) ?? { total: 0, users: new Set<string>() };
    plan.total += absolute;
    plan.users.add(row.clerkUserId);
    generalByPlan.set(row.plan, plan);
  }

  res.json({
    byFeature: [...generalByFeature.entries()]
      .map(([feature, value]) => ({ feature, ...value }))
      .sort((a, b) => b.total - a.total),
    byDay: [...generalByDay.entries()]
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    byPlan: [...generalByPlan.entries()]
      .map(([plan, value]) => ({ plan, total: value.total, userCount: value.users.size }))
      .sort((a, b) => b.total - a.total),
    imageByFeature: [...imageByFeature.entries()]
      .map(([feature, value]) => ({ feature, ...value }))
      .sort((a, b) => b.total - a.total),
    imageByDay: [...imageByDay.entries()]
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    imageTotal,
    days,
  });
});

export default router;
