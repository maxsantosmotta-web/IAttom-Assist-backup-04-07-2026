import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";

const router: IRouter = Router();
const OWNER_EMAIL = "maxsantosmotta@gmail.com";

const PLAN_NAMES: Record<string, string> = {
  free: "FREE",
  pro: "START",
  business: "PREMIUM",
  agency: "PRO",
  start: "START",
  premium: "PREMIUM",
};

type CommercialUser = {
  email: string;
  name: string | null;
  plan: string;
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

function customerIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function planFromMetadata(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PLAN_NAMES[normalized] ?? null;
}

function planFromText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (/\bpremium\b/.test(normalized)) return "PREMIUM";
  if (/\bstart\b/.test(normalized)) return "START";
  if (/\bpro\b/.test(normalized)) return "PRO";
  return null;
}

function invoicePlanName(invoice: any, fallbackPlan: string): string {
  const metadataCandidates = [
    invoice.metadata?.plan,
    invoice.subscription_details?.metadata?.plan,
    ...((invoice.lines?.data ?? []).flatMap((line: any) => [
      line.metadata?.plan,
      line.price?.metadata?.plan,
    ])),
  ];

  for (const candidate of metadataCandidates) {
    const resolved = planFromMetadata(candidate);
    if (resolved) return resolved;
  }

  const textCandidates = (invoice.lines?.data ?? []).flatMap((line: any) => [
    line.description,
    line.price?.nickname,
    line.price?.lookup_key,
  ]);

  for (const candidate of textCandidates) {
    const resolved = planFromText(candidate);
    if (resolved) return resolved;
  }

  return PLAN_NAMES[fallbackPlan] ?? fallbackPlan.toUpperCase();
}

function sessionPlanName(session: any, fallbackPlan: string): string {
  return planFromMetadata(session.metadata?.plan)
    ?? planFromText(session.metadata?.plan_name)
    ?? PLAN_NAMES[fallbackPlan]
    ?? fallbackPlan.toUpperCase();
}

function monthlyEquivalentCents(subscription: any): number {
  return (subscription.items?.data ?? []).reduce((sum: number, item: any) => {
    const unitAmount = item.price?.unit_amount ?? 0;
    const quantity = item.quantity ?? 1;
    const recurring = item.price?.recurring;
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

router.get("/admin/financial-summary", requireAdmin, async (req, res): Promise<void> => {
  const commercialUsers = await db
    .select({
      email: users.email,
      name: users.name,
      plan: users.plan,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(and(
      eq(users.role, "user"),
      sql`lower(coalesce(${users.email}, '')) <> ${OWNER_EMAIL}`,
    ));

  const userByCustomer = new Map(
    commercialUsers
      .filter((user): user is CommercialUser & { stripeCustomerId: string } => Boolean(user.stripeCustomerId))
      .map((user) => [user.stripeCustomerId, user]),
  );

  const empty = {
    mrr: 0,
    revenueThisMonth: 0,
    subscriptionRevenueThisMonth: 0,
    packageRevenueThisMonth: 0,
    activeSubscribers: 0,
    totalUsers: commercialUsers.length,
    conversionRate: 0,
    planBreakdown: {
      free: commercialUsers.filter((user) => user.plan === "free").length,
      pro: 0,
      business: 0,
      agency: 0,
    },
    mrrByPlan: { free: 0, pro: 0, business: 0, agency: 0 },
    recentMovements: [] as FinancialMovement[],
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

    const activeByCustomer = new Map<string, any>();
    for (const subscription of subscriptions) {
      if (subscription.status !== "active" && subscription.status !== "trialing") continue;
      const customerId = customerIdOf(subscription.customer);
      if (!customerId || !userByCustomer.has(customerId) || activeByCustomer.has(customerId)) continue;
      activeByCustomer.set(customerId, subscription);
    }

    const paidUsers = [...activeByCustomer.keys()]
      .map((customerId) => userByCustomer.get(customerId))
      .filter((user): user is CommercialUser & { stripeCustomerId: string } => Boolean(user) && user!.plan !== "free");

    const planBreakdown = {
      free: commercialUsers.filter((user) => user.plan === "free").length,
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

    const paidInvoices = invoices.filter((invoice) => {
      const customerId = customerIdOf(invoice.customer);
      return invoice.status === "paid"
        && (invoice.amount_paid ?? 0) > 0
        && Boolean(customerId && userByCustomer.has(customerId));
    });

    const paidPackages = checkoutSessions.filter((session) => {
      const customerId = customerIdOf(session.customer);
      return session.mode === "payment"
        && session.status === "complete"
        && session.payment_status === "paid"
        && (session.amount_total ?? 0) > 0
        && Boolean(customerId && userByCustomer.has(customerId));
    });

    const movements: FinancialMovement[] = [];

    for (const invoice of paidInvoices) {
      const customerId = customerIdOf(invoice.customer);
      const user = customerId ? userByCustomer.get(customerId) : undefined;
      if (!user) continue;
      const historicalPlan = invoicePlanName(invoice, user.plan);
      movements.push({
        id: invoice.id,
        type: "subscription",
        label: `Assinatura ${historicalPlan}`,
        userName: user.name,
        userEmail: user.email,
        plan: historicalPlan,
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
        plan: sessionPlanName(session, user.plan),
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "brl",
        status: "Pago",
        createdAt: new Date(session.created * 1000).toISOString(),
      });
    }

    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);
    const subscriptionRevenueCents = paidInvoices.reduce((sum, invoice) => sum + (invoice.amount_paid ?? 0), 0);
    const packageRevenueCents = paidPackages.reduce((sum, session) => sum + (session.amount_total ?? 0), 0);

    res.json({
      mrr: mrrCents / 100,
      revenueThisMonth: (subscriptionRevenueCents + packageRevenueCents) / 100,
      subscriptionRevenueThisMonth: subscriptionRevenueCents / 100,
      packageRevenueThisMonth: packageRevenueCents / 100,
      activeSubscribers: paidUsers.length,
      totalUsers: commercialUsers.length,
      conversionRate: commercialUsers.length > 0 ? Math.round((paidUsers.length / commercialUsers.length) * 1000) / 10 : 0,
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
    });
  } catch (error) {
    req.log.warn({ error }, "Admin financial read model unavailable; returning fail-closed values");
    res.json(empty);
  }
});

export default router;
