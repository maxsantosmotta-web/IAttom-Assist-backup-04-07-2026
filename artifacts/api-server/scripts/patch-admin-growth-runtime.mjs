import { readFileSync, writeFileSync } from "node:fs";

const adminRoutesUrl = new URL("../src/routes/admin.ts", import.meta.url);
let source = readFileSync(adminRoutesUrl, "utf8");

const routeMarker = 'router.get("/admin/growth-stats"';
const insertionMarker = 'router.get("/admin/launch-status"';

if (!source.includes(routeMarker)) {
  if (!source.includes(insertionMarker)) {
    throw new Error("Cannot add admin growth metrics: launch-status marker was not found");
  }

  const growthRoute = `router.get("/admin/growth-stats", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    [totalUsersRow],
    [freeUsersRow],
    [proUsersRow],
    [businessUsersRow],
    [agencyUsersRow],
    [newUsersWeekRow],
    [newUsersMonthRow],
    [activatedUsersRow],
    [creditsSpentRow],
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(users).where(eq(users.plan, "free")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "pro")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "business")),
    db.select({ count: count() }).from(users).where(eq(users.plan, "agency")),
    db.select({ count: count() }).from(users).where(gte(users.createdAt, weekStart)),
    db.select({ count: count() }).from(users).where(gte(users.createdAt, monthStart)),
    db.select({
      count: sql<number>\`count(distinct \${historyTable.clerkUserId})::int\`,
    }).from(historyTable).where(isNull(historyTable.deletedAt)),
    db.select({
      total: sql<number>\`coalesce(abs(sum(\${creditsTransactions.amount})), 0)::int\`,
    }).from(creditsTransactions).where(and(
      gte(creditsTransactions.createdAt, monthStart),
      sql\`\${creditsTransactions.amount} < 0\`,
    )),
  ]);

  const totalUsers = Number(totalUsersRow?.count) || 0;
  const freeUsers = Number(freeUsersRow?.count) || 0;
  const proUsers = Number(proUsersRow?.count) || 0;
  const businessUsers = Number(businessUsersRow?.count) || 0;
  const agencyUsers = Number(agencyUsersRow?.count) || 0;
  const activeSubscribers = proUsers + businessUsers + agencyUsers;
  const activatedUsers = Number(activatedUsersRow?.count) || 0;
  const creditsSpentThisMonth = Number(creditsSpentRow?.total) || 0;

  const conversionRate = totalUsers > 0
    ? Math.round((activeSubscribers / totalUsers) * 1000) / 10
    : 0;
  const activationRate = totalUsers > 0
    ? Math.round((activatedUsers / totalUsers) * 1000) / 10
    : 0;

  const monthlyPrices = { pro: 19.9, business: 197, agency: 497 };
  const mrr = Math.round((
    proUsers * monthlyPrices.pro +
    businessUsers * monthlyPrices.business +
    agencyUsers * monthlyPrices.agency
  ) * 100) / 100;

  res.json({
    mrr,
    activeSubscribers,
    totalUsers,
    conversionRate,
    activationRate,
    activatedCount: activatedUsers,
    newUsersThisWeek: Number(newUsersWeekRow?.count) || 0,
    newUsersThisMonth: Number(newUsersMonthRow?.count) || 0,
    creditsSpentThisMonth,
    churnRisk: [],
    totalReferralCodes: 0,
    totalReferralUses: 0,
    planBreakdown: {
      free: freeUsers,
      pro: proUsers,
      business: businessUsers,
      agency: agencyUsers,
    },
  });
});

`;

  source = source.replace(insertionMarker, growthRoute + insertionMarker);
  writeFileSync(adminRoutesUrl, source);
  console.log("Admin growth metrics route added for this build.");
} else {
  console.log("Admin growth metrics route already present.");
}
