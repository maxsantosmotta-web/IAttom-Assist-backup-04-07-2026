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
    const annualCustomerIds = new Set<string>();
    for (const subscription of subscriptions) {
      if (subscription.status !== "active" && subscription.status !== "trialing") continue;
      const hasAnnualPrice = subscription.items.data.some((item) => item.price.recurring?.interval === "year");
      if (!hasAnnualPrice) continue;
      const customerId = customerIdOf(subscription.customer);
      if (!customerId || annualCustomerIds.has(customerId)) continue;
      const user = userByCustomer.get(customerId);
      if (!user || user.plan === "free") continue;
      annualCustomerIds.add(customerId);
      annualSubscriptions.total += 1;
      if (user.plan === "pro") annualSubscriptions.start += 1;
      if (user.plan === "business") annualSubscriptions.premium += 1;
      if (user.plan === "agency") annualSubscriptions.pro += 1;
    }

    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);`;
if (!source.includes("const annualCustomerIds = new Set<string>();")) {
  if (!source.includes(calculationAnchor)) throw new Error("Finance annual summary calculation anchor not found");
  source = source.replace(calculationAnchor, calculationReplacement);
}

const valueAnchor = `      mrrByPlan: {
        free: mrrByPlan.free / 100,
        pro: mrrByPlan.pro / 100,
        business: mrrByPlan.business / 100,
        agency: mrrByPlan.agency / 100,
      },
      recentMovements: movements`;
const valueReplacement = `      mrrByPlan: {
        free: mrrByPlan.free / 100,
        pro: mrrByPlan.pro / 100,
        business: mrrByPlan.business / 100,
        agency: mrrByPlan.agency / 100,
      },
      annualSubscriptions,
      recentMovements: movements`;
if (!source.includes("      annualSubscriptions,\n      recentMovements: movements")) {
  if (!source.includes(valueAnchor)) throw new Error("Finance annual summary response anchor not found");
  source = source.replace(valueAnchor, valueReplacement);
}

for (const marker of [
  "annualSubscriptions: { total: number; start: number; premium: number; pro: number };",
  "const annualSubscriptions = { total: 0, start: 0, premium: 0, pro: 0 };",
  "const annualCustomerIds = new Set<string>();",
  'subscription.status !== "active" && subscription.status !== "trialing"',
  'item.price.recurring?.interval === "year"',
  "annualCustomerIds.has(customerId)",
  "annualSubscriptions.start += 1",
  "annualSubscriptions.premium += 1",
  "annualSubscriptions.pro += 1",
  "      annualSubscriptions,",
]) {
  if (!source.includes(marker)) throw new Error(`Finance annual summary marker missing: ${marker}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance counts annual plans from all active Stripe subscriptions, once per customer, without changing billing operations.");
