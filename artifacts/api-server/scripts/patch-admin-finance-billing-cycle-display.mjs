import fs from "node:fs";

const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
let source = fs.readFileSync(growthPath, "utf8");

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
  if (!source.includes(emptyAnchor)) throw new Error("Finance annual summary empty anchor not found");
  source = source.replace(emptyAnchor, emptyReplacement);
}

const calculationAnchor = `    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);`;
const calculationReplacement = `    const annualSubscriptions = { total: 0, start: 0, premium: 0, pro: 0 };
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
  if (!source.includes(calculationAnchor)) throw new Error("Finance annual summary calculation anchor not found");
  source = source.replace(calculationAnchor, calculationReplacement);
}

const responseAnchor = `      mrrByPlan: {
        free: mrrByPlan.free / 100,
        pro: mrrByPlan.pro / 100,
        business: mrrByPlan.business / 100,
        agency: mrrByPlan.agency / 100,
      },
      recentMovements: movements`;
const responseReplacement = `      mrrByPlan: {
        free: mrrByPlan.free / 100,
        pro: mrrByPlan.pro / 100,
        business: mrrByPlan.business / 100,
        agency: mrrByPlan.agency / 100,
      },
      annualSubscriptions,
      recentMovements: movements`;
if (!source.includes("      annualSubscriptions,\n      recentMovements: movements")) {
  if (!source.includes(responseAnchor)) throw new Error("Finance annual summary response anchor not found");
  source = source.replace(responseAnchor, responseReplacement);
}

for (const marker of [
  "annualSubscriptions: { total: number; start: number; premium: number; pro: number };",
  "annualSubscriptions: { total: 0, start: 0, premium: 0, pro: 0 },",
  "const annualSubscriptions = { total: 0, start: 0, premium: 0, pro: 0 };",
  'item.price.recurring?.interval === "year"',
  "      annualSubscriptions,",
]) {
  if (!source.includes(marker)) throw new Error(`Finance annual summary marker missing: ${marker}`);
}

for (const forbidden of [
  "ANNUAL_PRICE_IDS",
  "stripe.prices.retrieve",
  "priceId?: string | null",
  "interval?: string | null",
  "invoicePriceInfo",
]) {
  if (source.includes(forbidden)) throw new Error(`Parallel or diagnostic annual source detected: ${forbidden}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance annual summary now derives only from active Stripe subscriptions already used by the financial snapshot.");
