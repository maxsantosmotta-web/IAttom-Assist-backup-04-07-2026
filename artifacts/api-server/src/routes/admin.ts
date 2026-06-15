import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { eq, ilike, count, desc, and, gte, or, isNull, ne, sql } from "drizzle-orm";
import { db, users, projectsTable, historyTable, creditsTransactions, waitlistTable, feedbackTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  GetAdminStatsResponse,
  ListAdminUsersResponse,
  UpdateAdminUserResponse,
  ListAdminActivityResponseItem,
  GetAdminAnalyticsResponse,
  UpdateAdminUserBody,
  AdminAdjustCreditsBody,
  AdminAdjustCreditsResponse,
} from "@workspace/api-zod";
import { adjustCredits } from "../lib/credits";
import { getPlansWithPrices } from "../lib/stripeStorage.js";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [[totalUsersRes], [totalProjectsRes], [totalActionsRes], [adminCountRes]] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(projectsTable),
    db.select({ count: count() }).from(historyTable),
    db.select({ count: count() }).from(users).where(eq(users.role, "admin")),
  ]);

  const [[freeRes], [proRes], [businessRes], [agencyRes]] = await Promise.all([
    db.select({ count: count() }).from(users).where(eq(users.plan, "free")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "pro")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "business")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "agency")),
  ]);

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [[newUsersRes], [newProjectsRes]] = await Promise.all([
    db.select({ count: count() }).from(users).where(gte(users.createdAt, monthStart)),
    db.select({ count: count() }).from(projectsTable).where(gte(projectsTable.createdAt, monthStart)),
  ]);

  res.json(GetAdminStatsResponse.parse({
    totalUsers: totalUsersRes.count,
    totalProjects: totalProjectsRes.count,
    totalActions: totalActionsRes.count,
    adminCount: adminCountRes.count,
    planBreakdown: { free: freeRes.count, pro: proRes.count, business: businessRes.count, agency: agencyRes.count },
    newUsersThisMonth: newUsersRes.count,
    newProjectsThisMonth: newProjectsRes.count,
  }));
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const { search, plan, role, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
  const offsetNum = parseInt(offset, 10) || 0;

  const conditions = [];
  if (search) conditions.push(or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)));
  if (plan && ["free", "pro", "business", "agency"].includes(plan)) {
    conditions.push(eq(users.plan, plan as "free" | "pro" | "business" | "agency"));
  }
  if (role && ["user", "admin"].includes(role)) conditions.push(eq(users.role, role as "user" | "admin"));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [allUsers, [totalRes]] = await Promise.all([
    db.select().from(users).where(whereClause).orderBy(desc(users.createdAt)).limit(limitNum).offset(offsetNum),
    db.select({ count: count() }).from(users).where(whereClause),
  ]);

  const clerkIds = allUsers.map((u) => u.clerkId);
  const clerkUsers = clerkIds.length > 0
    ? await clerkClient.users.getUserList({ userId: clerkIds, limit: clerkIds.length }).then((r) => r.data)
    : [];
  const clerkBannedMap = new Map(clerkUsers.map((cu) => [cu.id, cu.banned ?? false]));

  const usersWithCounts = await Promise.all(allUsers.map(async (u) => {
    const [[pc], [ac]] = await Promise.all([
      db.select({ count: count() }).from(projectsTable).where(eq(projectsTable.clerkUserId, u.clerkId)),
      db.select({ count: count() }).from(historyTable).where(eq(historyTable.clerkUserId, u.clerkId)),
    ]);
    return { ...u, projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };
  }));

  res.json(ListAdminUsersResponse.parse({ users: usersWithCounts, total: totalRes.count }));
});

router.patch("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const parsed = UpdateAdminUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.plan !== undefined) updateData.plan = parsed.data.plan;
  if (parsed.data.credits !== undefined) updateData.credits = parsed.data.credits;

  const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }

  const [[pc], [ac]] = await Promise.all([
    db.select({ count: count() }).from(projectsTable).where(eq(projectsTable.clerkUserId, updated.clerkId)),
    db.select({ count: count() }).from(historyTable).where(eq(historyTable.clerkUserId, updated.clerkId)),
  ]);

  res.json(UpdateAdminUserResponse.parse({ ...updated, projectCount: pc.count, actionCount: ac.count }));
});

router.post("/admin/users/:id/credits", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const parsed = AdminAdjustCreditsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [targetUser] = await db.select().from(users).where(eq(users.id, id));
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  const result = await adjustCredits(
    targetUser.clerkId,
    parsed.data.amount,
    parsed.data.description,
    parsed.data.amount >= 0 ? "credit" : "adjustment",
  );
  if (!result) { res.status(404).json({ error: "User not found" }); return; }

  const [[pc], [ac]] = await Promise.all([
    db.select({ count: count() }).from(projectsTable).where(eq(projectsTable.clerkUserId, result.user.clerkId)),
    db.select({ count: count() }).from(historyTable).where(eq(historyTable.clerkUserId, result.user.clerkId)),
  ]);

  res.json(AdminAdjustCreditsResponse.parse({ ...result.user, projectCount: pc.count, actionCount: ac.count }));
});

router.post("/admin/users/:id/ban", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const [targetUser] = await db.select({ clerkId: users.clerkId }).from(users).where(eq(users.id, id));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  try {
    await clerkClient.users.banUser(targetUser.clerkId);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to ban user");
    res.status(500).json({ error: "Falha ao bloquear usuário" });
  }
});

router.post("/admin/users/:id/unban", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const [targetUser] = await db.select({ clerkId: users.clerkId }).from(users).where(eq(users.id, id));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  try {
    await clerkClient.users.unbanUser(targetUser.clerkId);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to unban user");
    res.status(500).json({ error: "Falha ao desbloquear usuário" });
  }
});

router.get("/admin/activity", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 100);

  const items = await db
    .select({
      id: historyTable.id,
      action: historyTable.action,
      module: historyTable.module,
      projectName: historyTable.projectName,
      clerkUserId: historyTable.clerkUserId,
      createdAt: historyTable.createdAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(historyTable)
    .leftJoin(users, eq(historyTable.clerkUserId, users.clerkId))
    .where(isNull(historyTable.deletedAt))
    .orderBy(desc(historyTable.createdAt))
    .limit(limit);

  res.json(items.map((item) => ListAdminActivityResponseItem.parse({
    id: item.id,
    action: item.action,
    module: item.module,
    projectName: item.projectName ?? undefined,
    userEmail: item.userEmail ?? undefined,
    userName: item.userName ?? undefined,
    createdAt: item.createdAt,
  })));
});

/* ── DELETE /admin/activity/:id — soft-delete any user's entry ─────── */
router.delete("/admin/activity/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  await db
    .update(historyTable)
    .set({ deletedAt: now, expiresAt })
    .where(and(eq(historyTable.id, id), isNull(historyTable.deletedAt)));

  res.json({ ok: true });
});

/* ── POST /admin/activity/clear — soft-delete all active entries ────── */
router.post("/admin/activity/clear", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  await db
    .update(historyTable)
    .set({ deletedAt: now, expiresAt })
    .where(isNull(historyTable.deletedAt));

  res.json({ ok: true });
});

router.get("/admin/analytics", requireAdmin, async (_req, res): Promise<void> => {
  const [[totalUsersRes], [totalProjectsRes], [freeRes], [proRes], [businessRes]] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(projectsTable),
    db.select({ count: count() }).from(users).where(eq(users.plan, "free")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "pro")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "business")),
  ]);

  const totalU = totalUsersRes.count;
  const totalP = totalProjectsRes.count;
  const now = new Date();

  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [newUsersByMonth, newProjectsByMonth] = await Promise.all([
    db.select({
      month: sql<string>`date_trunc('month', ${users.createdAt})::text`,
      total: count(),
    })
    .from(users)
    .where(gte(users.createdAt, sixMonthsAgo))
    .groupBy(sql`date_trunc('month', ${users.createdAt})`)
    .orderBy(sql`date_trunc('month', ${users.createdAt})`),

    db.select({
      month: sql<string>`date_trunc('month', ${projectsTable.createdAt})::text`,
      total: count(),
    })
    .from(projectsTable)
    .where(gte(projectsTable.createdAt, sixMonthsAgo))
    .groupBy(sql`date_trunc('month', ${projectsTable.createdAt})`)
    .orderBy(sql`date_trunc('month', ${projectsTable.createdAt})`),
  ]);

  const uMap = new Map(newUsersByMonth.map((r) => [r.month.slice(0, 7), r.total]));
  const pMap = new Map(newProjectsByMonth.map((r) => [r.month.slice(0, 7), r.total]));

  const userGrowth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (5 - i));
    d.setDate(1);
    const key = d.toISOString().slice(0, 7);
    return {
      month: d.toLocaleString("pt-BR", { month: "short", year: "2-digit" }),
      users: uMap.get(key) ?? 0,
      projects: pMap.get(key) ?? 0,
    };
  });

  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .groupBy(historyTable.module)
    .orderBy(desc(count()));

  const totalModuleCount = moduleRows.reduce((s, r) => s + r.count, 0) || 1;
  const featureUsage = moduleRows.map((r) => ({
    name: r.module.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    count: r.count,
    percentage: Math.round((r.count / totalModuleCount) * 100),
  }));

  const planRevenue = [
    { plan: "Free", users: freeRes.count, mrr: 0 },
    { plan: "Pro", users: proRes.count, mrr: proRes.count * 79 },
    { plan: "Business", users: businessRes.count, mrr: businessRes.count * 199 },
  ];

  res.json(GetAdminAnalyticsResponse.parse({ userGrowth, featureUsage, planRevenue }));
});

router.get("/admin/launch-status", requireAdmin, async (_req, res): Promise<void> => {
  const requiredEnvVars = [
    "DATABASE_URL",
    "CLERK_SECRET_KEY",
    "CLERK_PUBLISHABLE_KEY",
    "AI_INTEGRATIONS_OPENAI_BASE_URL",
    "AI_INTEGRATIONS_OPENAI_API_KEY",
    "SESSION_SECRET",
  ];

  const envVars: Record<string, boolean> = {};
  for (const key of requiredEnvVars) {
    envVars[key] = !!(process.env[key]?.trim());
  }
  const allEnvVarsConfigured = Object.values(envVars).every(Boolean);

  let dbStatus: "ready" | "error" = "ready";
  let userCount = 0;
  let adminCount = 0;
  let transactionCount = 0;

  try {
    const [[uRes], [aRes], [tRes]] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(users).where(eq(users.role, "admin")),
      db.select({ count: count() }).from(creditsTransactions),
    ]);
    userCount = uRes.count;
    adminCount = aRes.count;
    transactionCount = tRes.count;
  } catch {
    dbStatus = "error";
  }

  let stripeProductCount = 0;
  try {
    const rows = await getPlansWithPrices();
    stripeProductCount = rows.filter((r) => r.product.metadata?.plan).length;
  } catch {
    stripeProductCount = 0;
  }

  res.json({
    database: {
      status: dbStatus,
      userCount,
      message:
        dbStatus === "ready"
          ? `Connected — ${userCount} user${userCount !== 1 ? "s" : ""} registered`
          : "Database connection failed",
    },
    adminUsers: {
      status: adminCount > 0 ? "ready" : "needs_attention",
      count: adminCount,
    },
    creditsSystem: {
      status: "ready",
      transactionCount,
    },
    stripeProducts: {
      status: stripeProductCount >= 3 ? "ready" : "not_configured",
      count: stripeProductCount,
    },
    aiConfig: {
      status:
        envVars["AI_INTEGRATIONS_OPENAI_BASE_URL"] &&
        envVars["AI_INTEGRATIONS_OPENAI_API_KEY"]
          ? "ready"
          : "not_configured",
    },
    envVars,
    allEnvVarsConfigured,
  });
});

const ReviewWaitlistBody = z.object({
  status: z.enum(["approved", "denied"]),
  adminNotes: z.string().max(500).optional(),
});

router.get("/admin/waitlist", requireAdmin, async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const entries = await db
    .select()
    .from(waitlistTable)
    .orderBy(desc(waitlistTable.createdAt))
    .limit(200);

  const filtered = status ? entries.filter((e) => e.status === status) : entries;
  res.json({ waitlist: filtered, total: filtered.length });
});

router.patch("/admin/waitlist/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = ReviewWaitlistBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const [entry] = await db
    .update(waitlistTable)
    .set({ status: parsed.data.status, adminNotes: parsed.data.adminNotes, reviewedAt: new Date() })
    .where(eq(waitlistTable.id, id))
    .returning();

  if (!entry) { res.status(404).json({ error: "Not found" }); return; }

  if (parsed.data.status === "approved") {
    await db
      .update(users)
      .set({ betaAccess: true, updatedAt: new Date() })
      .where(eq(users.email, entry.email));
  } else if (parsed.data.status === "denied") {
    await db
      .update(users)
      .set({ betaAccess: false, updatedAt: new Date() })
      .where(eq(users.email, entry.email));
  }

  res.json({ entry });
});

router.post("/admin/waitlist/grant", requireAdmin, async (req, res): Promise<void> => {
  const { email } = z.object({ email: z.email() }).parse(req.body);

  const [existing] = await db.select().from(waitlistTable).where(eq(waitlistTable.email, email));
  if (!existing) {
    await db.insert(waitlistTable).values({ email, status: "approved", reviewedAt: new Date() });
  } else {
    await db.update(waitlistTable).set({ status: "approved", reviewedAt: new Date() }).where(eq(waitlistTable.email, email));
  }
  await db.update(users).set({ betaAccess: true, updatedAt: new Date() }).where(eq(users.email, email));
  res.json({ granted: true });
});

const ReviewFeedbackBody = z.object({
  status: z.enum(["new", "reviewed", "resolved"]).optional(),
  adminNotes: z.string().max(1000).optional(),
  adminResponse: z.string().max(2000).optional().nullable(),
});

router.get("/admin/feedback", requireAdmin, async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;

  const entries = await db
    .select()
    .from(feedbackTable)
    .orderBy(desc(feedbackTable.createdAt))
    .limit(200);

  let filtered = entries;
  if (status) filtered = filtered.filter((e) => e.status === status);
  if (category) filtered = filtered.filter((e) => e.category === category);

  res.json({ feedback: filtered, total: filtered.length });
});

router.patch("/admin/feedback/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = ReviewFeedbackBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const now = new Date();
  const [entry] = await db
    .update(feedbackTable)
    .set({
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.adminNotes !== undefined ? { adminNotes: parsed.data.adminNotes } : {}),
      ...(parsed.data.adminResponse !== undefined ? {
        adminResponse: parsed.data.adminResponse,
        ...(parsed.data.adminResponse?.trim() ? { adminRespondedAt: now } : {}),
      } : {}),
      reviewedAt: now,
    })
    .where(eq(feedbackTable.id, id))
    .returning();

  if (!entry) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ entry });
});

/* ── GET /admin/users/:id — perfil expandido de um usuário ─────────────────── */
router.get("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const [[pc], [ac], recentCredits, recentActivity] = await Promise.all([
    db.select({ count: count() }).from(projectsTable).where(eq(projectsTable.clerkUserId, user.clerkId)),
    db.select({ count: count() }).from(historyTable).where(eq(historyTable.clerkUserId, user.clerkId)),
    db.select()
      .from(creditsTransactions)
      .where(eq(creditsTransactions.clerkUserId, user.clerkId))
      .orderBy(desc(creditsTransactions.createdAt))
      .limit(10),
    db.select()
      .from(historyTable)
      .where(and(eq(historyTable.clerkUserId, user.clerkId), isNull(historyTable.deletedAt)))
      .orderBy(desc(historyTable.createdAt))
      .limit(10),
  ]);

  let currentPeriodEnd: string | null = null;
  let cancelAtPeriodEnd = false;
  if (user.stripeCustomerId) {
    try {
      const result = await db.execute(
        sql`SELECT current_period_end, cancel_at_period_end
            FROM stripe.subscriptions
            WHERE customer = ${user.stripeCustomerId}
              AND status IN ('active','trialing')
            ORDER BY created DESC LIMIT 1`,
      );
      if (result.rows.length > 0) {
        const row = result.rows[0] as { current_period_end: number | null; cancel_at_period_end: boolean };
        currentPeriodEnd = row.current_period_end ? new Date(row.current_period_end * 1000).toISOString() : null;
        cancelAtPeriodEnd = !!row.cancel_at_period_end;
      }
    } catch { /* stripe schema indisponível */ }
  }

  res.json({ ...user, projectCount: pc.count, actionCount: ac.count, recentCredits, recentActivity, currentPeriodEnd, cancelAtPeriodEnd });
});

/* ── GET /admin/credits-analytics — consumo de créditos agregado ────────────── */
router.get("/admin/credits-analytics", requireAdmin, async (req, res): Promise<void> => {
  const days = Math.min(parseInt((req.query.days as string) || "30", 10), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [byFeature, byDay, byPlan] = await Promise.all([
    db.select({
      feature: creditsTransactions.feature,
      total:   sql<number>`abs(sum(${creditsTransactions.amount}))::int`,
      ops:     count(),
    })
    .from(creditsTransactions)
    .where(and(gte(creditsTransactions.createdAt, since), sql`${creditsTransactions.amount} < 0`))
    .groupBy(creditsTransactions.feature)
    .orderBy(sql`abs(sum(${creditsTransactions.amount})) desc`)
    .limit(12),

    db.select({
      day:   sql<string>`date_trunc('day', ${creditsTransactions.createdAt})::text`,
      total: sql<number>`abs(sum(${creditsTransactions.amount}))::int`,
    })
    .from(creditsTransactions)
    .where(and(gte(creditsTransactions.createdAt, since), sql`${creditsTransactions.amount} < 0`))
    .groupBy(sql`date_trunc('day', ${creditsTransactions.createdAt})`)
    .orderBy(sql`date_trunc('day', ${creditsTransactions.createdAt})`),

    db.select({
      plan:      users.plan,
      total:     sql<number>`abs(sum(${creditsTransactions.amount}))::int`,
      userCount: sql<number>`count(distinct ${creditsTransactions.clerkUserId})::int`,
    })
    .from(creditsTransactions)
    .innerJoin(users, eq(users.clerkId, creditsTransactions.clerkUserId))
    .where(and(gte(creditsTransactions.createdAt, since), sql`${creditsTransactions.amount} < 0`))
    .groupBy(users.plan)
    .orderBy(sql`abs(sum(${creditsTransactions.amount})) desc`),
  ]);

  res.json({ byFeature, byDay, byPlan, days });
});

/* ── GET /admin/subscriptions — lista usuários com planos pagos ─────────────── */
router.get("/admin/subscriptions", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "100", 10), 200);

  const paidUsers = await db.select({
    id:                      users.id,
    clerkId:                 users.clerkId,
    email:                   users.email,
    name:                    users.name,
    plan:                    users.plan,
    stripeCustomerId:        users.stripeCustomerId,
    stripeSubscriptionId:    users.stripeSubscriptionId,
    stripeSubscriptionStatus: users.stripeSubscriptionStatus,
    createdAt:               users.createdAt,
  })
  .from(users)
  .where(ne(users.plan, "free"))
  .orderBy(desc(users.createdAt))
  .limit(limit);

  type SubRow = (typeof paidUsers)[number] & {
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };

  let enriched: SubRow[] = paidUsers.map((u) => ({
    ...u,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  }));

  try {
    const customerIds = paidUsers
      .map((u) => u.stripeCustomerId)
      .filter((id): id is string => !!id);

    if (customerIds.length > 0) {
      const result = await db.execute(
        sql`SELECT customer, current_period_end, cancel_at_period_end
            FROM stripe.subscriptions
            WHERE customer IN (${sql.join(customerIds.map((id) => sql`${id}`), sql`, `)})
              AND status IN ('active', 'trialing')
            ORDER BY created DESC`,
      );

      type StripeRow = { customer: string; current_period_end: number | null; cancel_at_period_end: boolean };
      const stripeMap = new Map<string, { currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean }>();
      for (const row of result.rows as StripeRow[]) {
        if (!stripeMap.has(row.customer)) {
          stripeMap.set(row.customer, {
            currentPeriodEnd: row.current_period_end
              ? new Date(row.current_period_end * 1000).toISOString()
              : null,
            cancelAtPeriodEnd: !!row.cancel_at_period_end,
          });
        }
      }

      enriched = enriched.map((u) => {
        const s = u.stripeCustomerId ? stripeMap.get(u.stripeCustomerId) : undefined;
        return s ? { ...u, ...s } : u;
      });
    }
  } catch {
    // stripe schema not yet available — return DB-only data
  }

  res.json({ subscriptions: enriched, total: enriched.length });
});

// ─── Admin Health Check ────────────────────────────────────────────────────
router.get("/admin/health", requireAdmin, async (_req, res): Promise<void> => {
  const checks: { service: string; status: "ok" | "error"; latencyMs?: number; detail?: string }[] = [];

  // DB
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.push({ service: "Banco de Dados", status: "ok", latencyMs: Date.now() - dbStart });
  } catch {
    checks.push({ service: "Banco de Dados", status: "error", latencyMs: Date.now() - dbStart, detail: "Conexão falhou" });
  }

  // OpenAI
  const hasOpenAI = !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
  checks.push({ service: "OpenAI", status: hasOpenAI ? "ok" : "error", detail: hasOpenAI ? undefined : "Variáveis de ambiente ausentes" });

  // Stripe
  const hasStripe = !!process.env.STRIPE_SECRET_KEY;
  checks.push({ service: "Stripe", status: hasStripe ? "ok" : "error", detail: hasStripe ? undefined : "STRIPE_SECRET_KEY não configurado" });

  const allOk = checks.every((c) => c.status === "ok");
  res.status(allOk ? 200 : 207).json({
    overall: allOk ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    checks,
  });
});

// ─── CSV Export: Usuários ──────────────────────────────────────────────────
router.get("/admin/export/users", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      name: users.name,
      email: users.email,
      plan: users.plan,
      role: users.role,
      credits: users.credits,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(5000);

  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const PLAN_PT: Record<string, string> = { free: "Gratuito", pro: "Pro", business: "Completo", agency: "Agência" };
  const ROLE_PT: Record<string, string> = { user: "Usuário", admin: "Admin" };

  const header = "Nome,Email,Plano,Função,Créditos,Cadastro\n";
  const body = rows
    .map((r) =>
      [
        r.name,
        r.email,
        PLAN_PT[r.plan ?? ""] ?? r.plan,
        ROLE_PT[r.role ?? ""] ?? r.role,
        r.credits,
        r.createdAt?.toISOString() ?? "",
      ].map(esc).join(",")
    )
    .join("\n");

  const filename = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + header + body);
});

// ─── CSV Export: Atividade ─────────────────────────────────────────────────
router.get("/admin/export/activity", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      action: historyTable.action,
      module: historyTable.module,
      projectName: historyTable.projectName,
      userName: users.name,
      userEmail: users.email,
      createdAt: historyTable.createdAt,
    })
    .from(historyTable)
    .leftJoin(users, eq(historyTable.clerkUserId, users.clerkId))
    .where(isNull(historyTable.deletedAt))
    .orderBy(desc(historyTable.createdAt))
    .limit(5000);

  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const MODULE_PT: Record<string, string> = {
    campaign: "Campanha", content: "Conteúdo", creative: "Criativo",
    video_script: "Roteiro de Vídeo", product_discovery: "Descoberta de Produto",
    product_validation: "Validação de Produto", marketing: "Marketing",
    Campaign: "Campanha", Content: "Conteúdo", Creative: "Criativo",
    "Video Script": "Roteiro de Vídeo", "Product Discovery": "Descoberta de Produto",
    "Product Validation": "Validação de Produto",
  };
  const ACTION_PT: Record<string, string> = {
    "Campaign created": "Campanha criada",
    "Creative generated": "Criativo gerado",
    "Creatives generated": "Criativos gerados",
    "Content created": "Conteúdo criado",
    "Generated content": "Conteúdo gerado",
    "Content generated": "Conteúdo gerado",
    "Video script generated": "Roteiro de vídeo gerado",
    "Created campaign": "Campanha criada",
    "Project updated": "Projeto atualizado",
    "Project created": "Projeto criado",
    "Updated project": "Projeto atualizado",
    "Created project": "Projeto criado",
    "Completed project": "Projeto concluído",
    "Ran product validation": "Validação de produto executada",
    "Product discovery": "Descoberta de produto",
    "AI product discovery": "Descoberta de produto com inteligência",
  };
  const xlateAction = (a: string | null): string => {
    if (!a) return "";
    if (ACTION_PT[a]) return ACTION_PT[a];
    for (const [en, pt] of Object.entries(ACTION_PT)) {
      if (a.toLowerCase().startsWith(en.toLowerCase() + ":")) {
        return pt + a.slice(en.length);
      }
    }
    return a;
  };

  const header = "Usuário,Email,Ação,Módulo,Projeto,Data\n";
  const body = rows
    .map((r) =>
      [
        r.userName, r.userEmail,
        xlateAction(r.action),
        MODULE_PT[r.module ?? ""] ?? r.module,
        r.projectName, r.createdAt?.toISOString() ?? "",
      ].map(esc).join(",")
    )
    .join("\n");

  const filename = `atividade_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + header + body);
});

/* ── TEMPORARY: cleanup test users from production ─────────────────────────
   Remove this entire block after cleanup is confirmed.
   Protected by X-Cleanup-Secret header (CLEANUP_SECRET env var).          */
router.post("/admin/cleanup-test-users", async (req, res): Promise<void> => {
  const secret = req.headers["x-cleanup-secret"];
  if (!secret || secret !== process.env.CLEANUP_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const KEEP_EMAIL = "maxsantosmotta@gmail.com";
  const toDelete = await db
    .select({ id: users.id, email: users.email, clerkId: users.clerkId })
    .from(users)
    .where(ne(users.email, KEEP_EMAIL));

  if (toDelete.length === 0) {
    res.json({ deleted: [], count: 0, message: "Nothing to delete" });
    return;
  }
  const clerkIds = toDelete.map((u) => u.clerkId);
  await db.delete(feedbackTable).where(sql`${feedbackTable.clerkUserId} = ANY(${clerkIds})`);
  await db.delete(creditsTransactions).where(sql`${creditsTransactions.clerkUserId} = ANY(${clerkIds})`);
  const deleted = await db.delete(users).where(ne(users.email, KEEP_EMAIL)).returning({ id: users.id, email: users.email });
  res.json({ deleted, count: deleted.length });
});
/* ── END TEMPORARY ──────────────────────────────────────────────────────── */

export default router;
