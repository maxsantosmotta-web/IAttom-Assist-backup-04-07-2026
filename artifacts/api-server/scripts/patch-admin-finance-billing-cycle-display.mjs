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
    const annualPlanByPriceId = new Map<string, "pro" | "business" | "agency">([
      ["price_1TvgDBAYtu5nLhAZsgenq5SJ", "pro"],
      ["price_1TvgFWAYtu5nLhAZuT001wT5", "business"],
      ["price_1TvgGgAYtu5nLhAZO8FYa6nK", "agency"],
    ]);
    const annualCustomerIds = new Set<string>();

    const registerAnnualCustomer = (
      customerId: string | null,
      planFromPrice: "pro" | "business" | "agency" | undefined,
    ): void => {
      if (!customerId || annualCustomerIds.has(customerId)) return;
      const user = userByCustomer.get(customerId);
      if (!user || user.plan === "free") return;
      const annualPlan = planFromPrice ?? user.plan;
      if (annualPlan !== "pro" && annualPlan !== "business" && annualPlan !== "agency") return;
      annualCustomerIds.add(customerId);
      annualSubscriptions.total += 1;
      if (annualPlan === "pro") annualSubscriptions.start += 1;
      if (annualPlan === "business") annualSubscriptions.premium += 1;
      if (annualPlan === "agency") annualSubscriptions.pro += 1;
    };

    for (const subscription of subscriptions) {
      if (subscription.status !== "active" && subscription.status !== "trialing") continue;
      const annualItem = subscription.items.data.find((item) =>
        annualPlanByPriceId.has(item.price.id) || item.price.recurring?.interval === "year",
      );
      if (!annualItem) continue;
      registerAnnualCustomer(
        customerIdOf(subscription.customer),
        annualPlanByPriceId.get(annualItem.price.id),
      );
    }

    for (const invoice of paidInvoices) {
      const annualPriceId = invoice.lines.data
        .map((line) => {
          const legacyPrice = (line as any).price;
          if (typeof legacyPrice === "string") return legacyPrice;
          if (legacyPrice && typeof legacyPrice.id === "string") return legacyPrice.id;
          const modernPrice = (line as any).pricing?.price_details?.price;
          if (typeof modernPrice === "string") return modernPrice;
          if (modernPrice && typeof modernPrice.id === "string") return modernPrice.id;
          return null;
        })
        .find((priceId): priceId is string => typeof priceId === "string" && annualPlanByPriceId.has(priceId));
      if (!annualPriceId) continue;
      registerAnnualCustomer(
        customerIdOf(invoice.customer),
        annualPlanByPriceId.get(annualPriceId),
      );
    }

    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);`;
if (!source.includes("const annualPlanByPriceId = new Map")) {
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
  "const annualPlanByPriceId = new Map",
  "const registerAnnualCustomer = (",
  "for (const subscription of subscriptions)",
  "for (const invoice of paidInvoices)",
  "pricing?.price_details?.price",
  "annualPlanByPriceId.has(priceId)",
  "annualSubscriptions.start += 1",
  "annualSubscriptions.premium += 1",
  "annualSubscriptions.pro += 1",
  "      annualSubscriptions,",
]) {
  if (!source.includes(marker)) throw new Error(`Finance annual summary marker missing: ${marker}`);
}

if (source.includes("item.price.unit_amount === 150")) {
  throw new Error("Finance annual summary must not classify plans by temporary test amount");
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance identifies annual plans from active subscriptions and paid invoice Price IDs only, without changing billing operations.");
