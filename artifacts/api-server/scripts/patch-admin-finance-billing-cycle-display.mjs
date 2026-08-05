import fs from "node:fs";

const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
let source = fs.readFileSync(growthPath, "utf8");

source = source.replace(
  'import { eq, gte, and, count, sql } from "drizzle-orm";',
  'import { eq, gte, lt, and, count, sql, isNull } from "drizzle-orm";',
);

const snapshotTypeAnchor = `  mrrByPlan: { free: number; pro: number; business: number; agency: number };
  recentMovements: FinancialMovement[];`;
const snapshotTypeReplacement = `  mrrByPlan: { free: number; pro: number; business: number; agency: number };
  annualSubscriptions: { total: number; start: number; premium: number; pro: number };
  recentMovements: FinancialMovement[];`;
if (!source.includes("annualSubscriptions: { total: number; start: number; premium: number; pro: number };")) {
  if (!source.includes(snapshotTypeAnchor)) throw new Error("Finance annual summary type anchor not found");
  source = source.replace(snapshotTypeAnchor, snapshotTypeReplacement);
}

const emptyAnchor = `    mrrByPlan: { free: 0, pro: 0, business: 0, agency: 0 },
    recentMovements: [],`;
const emptyReplacement = `    mrrByPlan: { free: 0, pro: 0, business: 0, agency: 0 },
    annualSubscriptions: { total: 0, start: 0, premium: 0, pro: 0 },
    recentMovements: [],`;
if (!source.includes("annualSubscriptions: { total: 0, start: 0, premium: 0, pro: 0 },")) {
  if (!source.includes(emptyAnchor)) throw new Error("Finance annual empty summary anchor not found");
  source = source.replace(emptyAnchor, emptyReplacement);
}

const annualCalculationAnchor = `    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);`;
const annualCalculationReplacement = `    const annualSubscriptions = { total: 0, start: 0, premium: 0, pro: 0 };
    for (const [customerId, subscription] of activeByCustomer) {
      const isAnnual = subscription.items.data.some((item) => item.price.recurring?.interval === "year");
      if (!isAnnual) continue;
      const user = userByCustomer.get(customerId);
      if (!user || user.plan === "free") continue;
      annualSubscriptions.total += 1;
      if (user.plan === "pro") annualSubscriptions.start += 1;
      if (user.plan === "business") annualSubscriptions.premium += 1;
      if (user.plan === "agency") annualSubscriptions.pro += 1;
    }

    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);`;
if (!source.includes("const annualSubscriptions = { total: 0, start: 0, premium: 0, pro: 0 };")) {
  if (!source.includes(annualCalculationAnchor)) throw new Error("Finance annual calculation anchor not found");
  source = source.replace(annualCalculationAnchor, annualCalculationReplacement);
}

const annualResponseAnchor = `      mrrByPlan: {
        free: mrrByPlan.free / 100,
        pro: mrrByPlan.pro / 100,
        business: mrrByPlan.business / 100,
        agency: mrrByPlan.agency / 100,
      },
      recentMovements: movements`;
const annualResponseReplacement = `      mrrByPlan: {
        free: mrrByPlan.free / 100,
        pro: mrrByPlan.pro / 100,
        business: mrrByPlan.business / 100,
        agency: mrrByPlan.agency / 100,
      },
      annualSubscriptions,
      recentMovements: movements`;
if (!source.includes("      annualSubscriptions,\n      recentMovements: movements")) {
  if (!source.includes(annualResponseAnchor)) throw new Error("Finance annual response anchor not found");
  source = source.replace(annualResponseAnchor, annualResponseReplacement);
}

const growthPromiseAnchor = `      recentCredits,
    ] = await Promise.all([`;
const growthPromiseReplacement = `      recentCredits,
      [todayActionsRes],
    ] = await Promise.all([`;
if (!source.includes("[todayActionsRes],")) {
  if (!source.includes(growthPromiseAnchor)) throw new Error("Admin growth Promise result anchor not found");
  source = source.replace(growthPromiseAnchor, growthPromiseReplacement);
}

const recentCreditsQueryAnchor = `      db.select({
        amount: creditsTransactions.amount,
        clerkUserId: creditsTransactions.clerkUserId,
      }).from(creditsTransactions).where(gte(creditsTransactions.createdAt, monthAgo)).limit(500),
    ]);`;
const recentCreditsQueryReplacement = `      db.select({
        amount: creditsTransactions.amount,
        clerkUserId: creditsTransactions.clerkUserId,
      }).from(creditsTransactions).where(gte(creditsTransactions.createdAt, monthAgo)).limit(500),
      (() => {
        const formatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const todayInSaoPaulo = formatter.format(new Date());
        const start = new Date(\`\${todayInSaoPaulo}T00:00:00-03:00\`);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        return db
          .select({ count: count() })
          .from(historyTable)
          .where(and(
            gte(historyTable.createdAt, start),
            lt(historyTable.createdAt, end),
            isNull(historyTable.deletedAt),
          ));
      })(),
    ]);`;
if (!source.includes("todayInSaoPaulo")) {
  if (!source.includes(recentCreditsQueryAnchor)) throw new Error("Admin growth today-actions query anchor not found");
  source = source.replace(recentCreditsQueryAnchor, recentCreditsQueryReplacement);
}

const growthResponseAnchor = `      activationRate,
      activatedCount,`;
const growthResponseReplacement = `      activationRate,
      activatedCount,
      activeUsers: activatedCount,
      todayActions: todayActionsRes.count,`;
if (!source.includes("todayActions: todayActionsRes.count")) {
  if (!source.includes(growthResponseAnchor)) throw new Error("Admin growth live metrics response anchor not found");
  source = source.replace(growthResponseAnchor, growthResponseReplacement);
}

for (const marker of [
  "annualSubscriptions: { total: number; start: number; premium: number; pro: number };",
  'item.price.recurring?.interval === "year"',
  "      annualSubscriptions,",
  "activeUsers: activatedCount",
  "todayActions: todayActionsRes.count",
  'timeZone: "America/Sao_Paulo"',
  "isNull(historyTable.deletedAt)",
]) {
  if (!source.includes(marker)) throw new Error(`Final Admin metric marker missing: ${marker}`);
}

for (const forbidden of [
  "ANNUAL_PRICE_IDS",
  "stripe.prices.retrieve",
  "invoicePriceInfo",
  "priceId?: string | null",
  "interval?: string | null",
]) {
  if (source.includes(forbidden)) throw new Error(`Parallel or diagnostic annual source detected: ${forbidden}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance annual plans and real active/today metrics now use canonical backend data.");
