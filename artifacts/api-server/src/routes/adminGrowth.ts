import { Router, type IRouter } from "express";
import { eq, gte, and, count, sql } from "drizzle-orm";
import { db, users, historyTable, creditsTransactions } from "@workspace/db";
import { referralsTable, referralUsesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";

const router: IRouter = Router();
const OWNER_EMAIL = "maxsantosmotta@gmail.com";

const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 20,
  business: 20,
  agency: 20,
};

const PLAN_NAMES: Record<string, string> = {
  free: "FREE",
  pro: "START",
  business: "PREMIUM",
  agency: "PRO",
};

type CommercialUser = {
  clerkId: string;
  email: string;
  name: string | null;
  plan: string;
  credits: number;
  stripeCustomerId: string | null;
};

type FinancialMovement = {
  id: string;
  type: "subscription" | "credit_pack" | "creative_pack" | "video_pack";
  label: string;
  userName: string | null;
  userEmail: string;
  plan: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

type FinancialSnapshot = {
  mrr: number;
  revenueThisMonth: number;
  packageRevenueThisMonth: number;
  activeSubscribers: number;
  totalUsers: number;
  conversionRate: number;
  planBreakdown: { free: number; pro: number; business: number; agency: number };
  mrrByPlan: { free: number; pro: number; business: number; agency: number };
  recentMovements: FinancialMovement[];
};

let financialCache: { expiresAt: number; value: FinancialSnapshot } | null = null;

const commercialUserCondition = and(
  eq(users.role, "user"),
  sql`lower(coalesce(${users.email}, '')) <> ${OWNER_EMAIL}`,
);

function customerIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function monthlyEquivalentCents(subscription: Awaited<ReturnType<ReturnType<typeof getUncachableStripeClient>["subscriptions"]["list"]>>["data"][number]): number {
  return subscription.items.data.reduce((sum, item) => {
    const unitAmount = item.price.unit_amount ?? 0;
    const quantity = item.quantity ?? 1;
    const recurring = item.price.recurring;
    if (!recurring) return sum;
    const intervalCount = recurring.interval_count || 1;
    let divisor = 1;
    if (recurring.interval === "year") divisor = 12 * intervalCount;
    if (recurring.interval === "month") divisor = intervalCount;
    if (recurring.interval === "week") divisor = (52 / 12) * intervalCount;
    if (recurring.interval === "day") divisor = (365 / 12) * intervalCount;
    return sum + Math.round((unitAmount * quantity) / divisor);
  }, 0);
}

async function getCommercialUsers(): Promise<CommercialUser[]> {
  return db
    .select({
      clerkId: users.clerkId,
      email: users.email,
      name: users.name,
      plan: users.plan,
      credits: users.credits,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(commercialUserCondition);
}

async function getFinancialSnapshot(req: Parameters<IRouter["get"]>[1] extends never ? never : any): Promise<FinancialSnapshot> {
  if (financialCache && financialCache.expiresAt > Date.now()) return financialCache.value;

  const allUsers = await getCommercialUsers();
  const userByCustomer = new Map(
    allUsers
      .filter((user): user is CommercialUser & { stripeCustomerId: string } => typeof user.stripeCustomerId === "string" && user.stripeCustomerId.length > 0)
      .map((user) => [user.stripeCustomerId, user]),
  );

  const empty: FinancialSnapshot = {
    mrr: 0,
    revenueThisMonth: 0,
    packageRevenueThisMonth: 0,
    activeSubscribers: 0,
    totalUsers: allUsers.length,
    conversionRate: 0,
    planBreakdown: {
      free: allUsers.filter((user) => user.plan === "free").length,
      pro: 0,
      business: 0,
      agency: 0,
    },
    mrrByPlan: { free: 0, pro: 0, business: 0, agency: 0 },
    recentMovements: [],
  };

  try {
    const stripe = await getUncachableStripeClient();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const createdGte = Math.floor(monthStart.getTime() / 1000);

    const [subscriptions, invoices, checkoutSessions] = await Promise.all([
      stripe.subscriptions.list({ status: "all", limit: 100 }).autoPagingToArray({ limit: 1000 }),
      stripe.invoices.list({ created: { gte: createdGte }, limit: 100 }).autoPagingToArray({ limit: 1000 }),
      stripe.checkout.sessions.list({ created: { gte: createdGte }, limit: 100 }).autoPagingToArray({ limit: 1000 }),
    ]);

    const activeByCustomer = new Map<string, (typeof subscriptions)[number]>();
    for (const subscription of subscriptions) {
      if (subscription.status !== "active" && subscription.status !== "trialing") continue;
      const customerId = customerIdOf(subscription.customer);
      if (!customerId || !userByCustomer.has(customerId) || activeByCustomer.has(customerId)) continue;
      activeByCustomer.set(customerId, subscription);
    }

    const paidUsers = [...activeByCustomer.keys()]
      .map((customerId) => userByCustomer.get(customerId))
      .filter((user): user is CommercialUser & { stripeCustomerId: string } => !!user && user.plan !== "free");

    const planBreakdown = {
      free: allUsers.filter((user) => user.plan === "free").length,
      pro: paidUsers.filter((user) => user.plan === "pro").length,
      business: paidUsers.filter((user) => user.plan === "business").length,
      agency: paidUsers.filter((user) => user.plan === "agency").length,
    };

    const mrrByPlan = { free: 0, pro: 0, business: 0, agency: 0 };
    for (const [customerId, subscription] of activeByCustomer) {
      const user = userByCustomer.get(customerId);
      if (!user || user.plan === "free" || !(user.plan in mrrByPlan)) continue;
      mrrByPlan[user.plan as keyof typeof mrrByPlan] += monthlyEquivalentCents(subscription);
    }

    const paidInvoices = invoices.filter((invoice) => invoice.status === "paid" && (invoice.amount_paid ?? 0) > 0);
    const paidPackages = checkoutSessions.filter((session) =>
      session.mode === "payment" &&
      session.status === "complete" &&
      session.payment_status === "paid" &&
      (session.amount_total ?? 0) > 0,
    );

    const movements: FinancialMovement[] = [];

    for (const invoice of paidInvoices) {
      const customerId = customerIdOf(invoice.customer);
      const user = customerId ? userByCustomer.get(customerId) : undefined;
      if (!user) continue;
      movements.push({
        id: invoice.id,
        type: "subscription",
        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan}`,
        userName: user.name,
        userEmail: user.email,
        plan: PLAN_NAMES[user.plan] ?? user.plan,
        amountCents: invoice.amount_paid ?? 0,
        currency: invoice.currency ?? "brl",
        status: "Pago",
        createdAt: new Date(invoice.created * 1000).toISOString(),
      });
    }

    for (const session of paidPackages) {
      const customerId = customerIdOf(session.customer);
      const user = customerId ? userByCustomer.get(customerId) : undefined;
      if (!user) continue;
      const rawType = session.metadata?.type;
      const type: FinancialMovement["type"] = rawType === "creative_pack"
        ? "creative_pack"
        : rawType === "video_pack"
          ? "video_pack"
          : "credit_pack";
      const label = type === "creative_pack"
        ? "Pacote de imagens"
        : type === "video_pack"
          ? "Pacote de vídeos"
          : "Pacote de créditos";
      movements.push({
        id: session.id,
        type,
        label,
        userName: user.name,
        userEmail: user.email,
        plan: PLAN_NAMES[user.plan] ?? user.plan,
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "brl",
        status: "Pago",
        createdAt: new Date(session.created * 1000).toISOString(),
      });
    }

    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);
    const invoiceRevenueCents = paidInvoices.reduce((sum, invoice) => sum + (invoice.amount_paid ?? 0), 0);
    const packageRevenueCents = paidPackages.reduce((sum, session) => sum + (session.amount_total ?? 0), 0);

    const value: FinancialSnapshot = {
      mrr: mrrCents / 100,
      revenueThisMonth: (invoiceRevenueCents + packageRevenueCents) / 100,
      packageRevenueThisMonth: packageRevenueCents / 100,
      activeSubscribers: paidUsers.length,
      totalUsers: allUsers.length,
      conversionRate: allUsers.length > 0 ? Math.round((paidUsers.length / allUsers.length) * 1000) / 10 : 0,
      planBreakdown,
      mrrByPlan: {
        free: mrrByPlan.free / 100,
        pro: mrrByPlan.pro / 100,
        business: mrrByPlan.business / 100,
        agency: mrrByPlan.agency / 100,
      },
      recentMovements: movements
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20),
    };

    financialCache = { expiresAt: Date.now() + 15_000, value };
    return value;
  } catch (error) {
    req.log.warn({ error }, "Admin financial snapshot unavailable; returning fail-closed values");
    return empty;
  }
}

router.get("/admin/financial-summary", requireAdmin, async (req, res): Promise<void> => {
  try {
    res.json(await getFinancialSnapshot(req));
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to fetch financial summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/growth-stats", requireAdmin, async (req, res): Promise<void> => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      financial,
      [newUsersWeekRes],
      [newUsersMonthRes],
      activatedUserIds,
      [totalReferralsRes],
      [totalReferralUsesRes],
      recentCredits,
    ] = await Promise.all([
      getFinancialSnapshot(req),
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

    const allUsers = await getCommercialUsers();
    const activatedSet = new Set(activatedUserIds.map((row) => row.clerkUserId));
    const activatedCount = allUsers.filter((user) => activatedSet.has(user.clerkId)).length;
    const activationRate = allUsers.length > 0 ? Math.round((activatedCount / allUsers.length) * 100) : 0;

    const paidPlans = new Set(["pro", "business", "agency"]);
    const paidUsers = allUsers.filter((user) => paidPlans.has(user.plan) && user.stripeCustomerId);
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
      ...financial,
      activationRate,
      activatedCount,
      newUsersThisWeek: newUsersWeekRes.count,
      newUsersThisMonth: newUsersMonthRes.count,
      churnRisk,
      totalReferralCodes: totalReferralsRes.count,
      totalReferralUses: totalReferralUsesRes.count,
      creditsSpentThisMonth,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to fetch growth stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
