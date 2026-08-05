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

const paidUsersAnchor = `    const paidUsers = [...activeByCustomer.keys()]
      .map((customerId) => userByCustomer.get(customerId))
      .filter((user): user is CommercialUser & { stripeCustomerId: string } => !!user && user.plan !== "free");`;
const paidUsersReplacement = `${paidUsersAnchor}

    const annualUsers = [...activeByCustomer.entries()]
      .filter(([, subscription]) =>
        subscription.items.data.some((item) => item.price.recurring?.interval === "year"),
      )
      .map(([customerId]) => userByCustomer.get(customerId))
      .filter((user): user is CommercialUser & { stripeCustomerId: string } => !!user && user.plan !== "free");

    const annualSubscriptions = {
      total: annualUsers.length,
      start: annualUsers.filter((user) => user.plan === "pro").length,
      premium: annualUsers.filter((user) => user.plan === "business").length,
      pro: annualUsers.filter((user) => user.plan === "agency").length,
    };`;
if (!source.includes("const annualUsers = [...activeByCustomer.entries()]")) {
  if (!source.includes(paidUsersAnchor)) throw new Error("Finance paid users anchor not found");
  source = source.replace(paidUsersAnchor, paidUsersReplacement);
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
  "const annualUsers = [...activeByCustomer.entries()]",
  'item.price.recurring?.interval === "year"',
  'annualUsers.filter((user) => user.plan === "pro")',
  'annualUsers.filter((user) => user.plan === "business")',
  'annualUsers.filter((user) => user.plan === "agency")',
  "      annualSubscriptions,",
]) {
  if (!source.includes(marker)) throw new Error(`Finance annual active-subscription marker missing: ${marker}`);
}

for (const forbidden of [
  "const annualGrantRows = await db",
  "franquia anual do plano",
  "12 meses",
  "item.price.unit_amount === 150",
]) {
  if (source.includes(forbidden)) throw new Error(`Obsolete annual classification remains: ${forbidden}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance annual plans now derive from the same active subscription map used by paid subscribers and financial movements.");
