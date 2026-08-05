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

const paidInvoicesAnchor = `    const paidInvoices = invoices.filter((invoice) => invoice.status === "paid" && (invoice.amount_paid ?? 0) > 0);`;
const paidInvoicesReplacement = `${paidInvoicesAnchor}
    const ANNUAL_PRICE_IDS = new Set([
      "price_1TvgDBAYtu5nLhAZsgenq5SJ",
      "price_1TvgFWAYtu5nLhAZuT001wT5",
      "price_1TvgGgAYtu5nLhAZO8FYa6nK",
    ]);
    const invoicePriceIds = (invoice: (typeof invoices)[number]): string[] =>
      invoice.lines.data
        .map((line) => {
          const current = line as unknown as {
            price?: { id?: string } | null;
            pricing?: { price_details?: { price?: string | { id?: string } | null } | null } | null;
          };
          const modernPrice = current.pricing?.price_details?.price;
          if (typeof modernPrice === "string") return modernPrice;
          if (modernPrice && typeof modernPrice.id === "string") return modernPrice.id;
          return current.price?.id ?? null;
        })
        .filter((priceId): priceId is string => typeof priceId === "string" && priceId.length > 0);
    const isAnnualInvoice = (invoice: (typeof invoices)[number]): boolean =>
      invoicePriceIds(invoice).some((priceId) => ANNUAL_PRICE_IDS.has(priceId));`;
if (!source.includes("const invoicePriceIds = (invoice:")) {
  if (!source.includes(paidInvoicesAnchor)) throw new Error("Finance paid invoices anchor not found");
  source = source.replace(paidInvoicesAnchor, paidInvoicesReplacement);
}

const movementsAnchor = `    const movements: FinancialMovement[] = [];

    for (const invoice of paidInvoices) {`;
const movementsReplacement = `    const movements: FinancialMovement[] = [];
    const annualUsersByClerkId = new Map<string, CommercialUser>();

    for (const invoice of paidInvoices) {`;
if (!source.includes("const annualUsersByClerkId = new Map<string, CommercialUser>()")) {
  if (!source.includes(movementsAnchor)) throw new Error("Finance movements anchor not found");
  source = source.replace(movementsAnchor, movementsReplacement);
}

const movementUserAnchor = `      const user = customerId ? userByCustomer.get(customerId) : undefined;
      if (!user) continue;
      movements.push({`;
const movementUserReplacement = `      const user = customerId ? userByCustomer.get(customerId) : undefined;
      if (!user) continue;
      const annualInvoice = isAnnualInvoice(invoice);
      if (annualInvoice && user.plan !== "free") annualUsersByClerkId.set(user.clerkId, user);
      movements.push({`;
if (!source.includes("const annualInvoice = isAnnualInvoice(invoice);")) {
  if (!source.includes(movementUserAnchor)) throw new Error("Finance invoice movement user anchor not found");
  source = source.replace(movementUserAnchor, movementUserReplacement);
}

source = source.replace(
  '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan} · ${subscriptionCycleLabel(customerId ? activeByCustomer.get(customerId) : undefined)}`,',
  '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan} · ${annualInvoice ? "Anual" : "Mensal"}`,',
);
source = source.replace(
  '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan}`,',
  '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan} · ${annualInvoice ? "Anual" : "Mensal"}`,',
);

const mrrAnchor = `    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);`;
const mrrReplacement = `    const annualUsers = [...annualUsersByClerkId.values()];
    const annualSubscriptions = {
      total: annualUsers.length,
      start: annualUsers.filter((user) => user.plan === "pro").length,
      premium: annualUsers.filter((user) => user.plan === "business").length,
      pro: annualUsers.filter((user) => user.plan === "agency").length,
    };

    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);`;
if (!source.includes("const annualUsers = [...annualUsersByClerkId.values()]")) {
  if (!source.includes(mrrAnchor)) throw new Error("Finance annual invoice summary anchor not found");
  source = source.replace(mrrAnchor, mrrReplacement);
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
  "const invoicePriceIds = (invoice:",
  "const isAnnualInvoice = (invoice:",
  "const annualUsersByClerkId = new Map<string, CommercialUser>()",
  "const annualInvoice = isAnnualInvoice(invoice);",
  'annualInvoice ? "Anual" : "Mensal"',
  "const annualUsers = [...annualUsersByClerkId.values()]",
  "      annualSubscriptions,",
]) {
  if (!source.includes(marker)) throw new Error(`Finance annual paid-invoice marker missing: ${marker}`);
}

for (const forbidden of [
  "const annualGrantRows = await db",
  "franquia anual do plano",
  "12 meses",
  "item.price.unit_amount === 150",
  "const annualUsers = [...activeByCustomer.entries()]",
  "const subscriptionCycleLabel",
]) {
  if (source.includes(forbidden)) throw new Error(`Obsolete annual classification remains: ${forbidden}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance annual plans now derive directly from the same paid invoices that generate recent financial movements.");
