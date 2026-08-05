import fs from "node:fs";

const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
let source = fs.readFileSync(growthPath, "utf8");

const movementTypeAnchor = `  status: string;
  createdAt: string;
};`;
const movementTypeReplacement = `  status: string;
  createdAt: string;
  priceId?: string | null;
  interval?: string | null;
};`;
if (!source.includes("priceId?: string | null;")) {
  if (!source.includes(movementTypeAnchor)) throw new Error("Finance movement diagnostic type anchor not found");
  source = source.replace(movementTypeAnchor, movementTypeReplacement);
}

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

    const paidInvoicePriceIds = [...new Set(paidInvoices.flatMap((invoice) => invoicePriceIds(invoice)))];
    const priceById = new Map<string, Awaited<ReturnType<typeof stripe.prices.retrieve>>>();
    for (const priceId of paidInvoicePriceIds) {
      try {
        priceById.set(priceId, await stripe.prices.retrieve(priceId));
      } catch (error) {
        req.log.warn({ error, priceId }, "Finance invoice price lookup failed");
      }
    }

    const invoicePriceInfo = (invoice: (typeof invoices)[number]): {
      priceId: string | null;
      interval: string | null;
      annual: boolean;
    } => {
      const priceId = invoicePriceIds(invoice)[0] ?? null;
      const interval = priceId ? priceById.get(priceId)?.recurring?.interval ?? null : null;
      return {
        priceId,
        interval,
        annual: interval === "year" || (priceId ? ANNUAL_PRICE_IDS.has(priceId) : false),
      };
    };`;
if (!source.includes("const invoicePriceInfo = (invoice:")) {
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
      const priceInfo = invoicePriceInfo(invoice);
      if (priceInfo.annual && user.plan !== "free") annualUsersByClerkId.set(user.clerkId, user);
      movements.push({`;
if (!source.includes("const priceInfo = invoicePriceInfo(invoice);")) {
  if (!source.includes(movementUserAnchor)) throw new Error("Finance invoice movement user anchor not found");
  source = source.replace(movementUserAnchor, movementUserReplacement);
}

const movementCreatedAtAnchor = `        status: "Pago",
        createdAt: new Date(invoice.created * 1000).toISOString(),
      });`;
const movementCreatedAtReplacement = `        status: "Pago",
        createdAt: new Date(invoice.created * 1000).toISOString(),
        priceId: priceInfo.priceId,
        interval: priceInfo.interval,
      });`;
if (!source.includes("priceId: priceInfo.priceId,")) {
  if (!source.includes(movementCreatedAtAnchor)) throw new Error("Finance invoice movement payload anchor not found");
  source = source.replace(movementCreatedAtAnchor, movementCreatedAtReplacement);
}

source = source.replace(
  '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan} · ${annualInvoice ? "Anual" : "Mensal"}`,',
  '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan}`,',
);
source = source.replace(
  '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan} · ${subscriptionCycleLabel(customerId ? activeByCustomer.get(customerId) : undefined)}`,',
  '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan}`,',
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
  "priceId?: string | null;",
  "interval?: string | null;",
  "annualSubscriptions: { total: number; start: number; premium: number; pro: number };",
  "const invoicePriceIds = (invoice:",
  "const paidInvoicePriceIds = [...new Set",
  "stripe.prices.retrieve(priceId)",
  "const invoicePriceInfo = (invoice:",
  "const priceInfo = invoicePriceInfo(invoice);",
  "priceId: priceInfo.priceId,",
  "interval: priceInfo.interval,",
  "const annualUsers = [...annualUsersByClerkId.values()]",
  "      annualSubscriptions,",
]) {
  if (!source.includes(marker)) throw new Error(`Finance price diagnostic marker missing: ${marker}`);
}

for (const forbidden of [
  "const annualGrantRows = await db",
  "franquia anual do plano",
  "12 meses",
  "item.price.unit_amount === 150",
  "const annualUsers = [...activeByCustomer.entries()]",
  "const subscriptionCycleLabel",
  "const annualInvoice = isAnnualInvoice(invoice)",
]) {
  if (source.includes(forbidden)) throw new Error(`Obsolete annual classification remains: ${forbidden}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance movements now expose the real Stripe priceId and interval read from paid invoice prices.");
