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
const calculationReplacement = `    const annualGrantRows = await db
      .select({ clerkUserId: creditsTransactions.clerkUserId })
      .from(creditsTransactions)
      .where(and(
        sql\`${creditsTransactions.amount} > 0\`,
        sql\`lower(coalesce(${creditsTransactions.description}, '')) like '%franquia anual do plano%'\`,
        sql\`lower(coalesce(${creditsTransactions.description}, '')) like '%12 meses%'\`,
      ))
      .limit(5000);

    const activePaidClerkIds = new Set(paidUsers.map((user) => user.clerkId));
    const annualClerkIds = new Set(
      annualGrantRows
        .map((row) => row.clerkUserId)
        .filter((clerkUserId) => activePaidClerkIds.has(clerkUserId)),
    );
    const annualUsers = allUsers.filter((user) => annualClerkIds.has(user.clerkId));
    const annualSubscriptions = {
      total: annualUsers.length,
      start: annualUsers.filter((user) => user.plan === "pro").length,
      premium: annualUsers.filter((user) => user.plan === "business").length,
      pro: annualUsers.filter((user) => user.plan === "agency").length,
    };

    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);`;
if (!source.includes("const annualGrantRows = await db")) {
  if (!source.includes(calculationAnchor)) throw new Error("Finance annual activity calculation anchor not found");
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
  "const annualGrantRows = await db",
  "franquia anual do plano",
  "12 meses",
  "const activePaidClerkIds = new Set",
  "const annualClerkIds = new Set",
  "const annualUsers = allUsers.filter",
  "annualUsers.filter((user) => user.plan === \"pro\")",
  "annualUsers.filter((user) => user.plan === \"business\")",
  "annualUsers.filter((user) => user.plan === \"agency\")",
  "      annualSubscriptions,",
]) {
  if (!source.includes(marker)) throw new Error(`Finance annual activity marker missing: ${marker}`);
}

if (source.includes("item.price.unit_amount === 150")) {
  throw new Error("Finance annual summary must not classify plans by temporary test amount");
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance annual plans now use confirmed internal annual activity records intersected with currently active subscribers.");
