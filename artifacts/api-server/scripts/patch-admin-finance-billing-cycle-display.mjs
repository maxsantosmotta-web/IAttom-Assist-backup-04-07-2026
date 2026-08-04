import fs from "node:fs";

const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
let source = fs.readFileSync(growthPath, "utf8");

if (!source.includes('billingCycle: "monthly" | "annual" | null;')) {
  const typeAnchor = `  status: string;
  createdAt: string;
};`;
  const typeReplacement = `  status: string;
  billingCycle: "monthly" | "annual" | null;
  createdAt: string;
};`;
  if (!source.includes(typeAnchor)) throw new Error("Finance movement type anchor not found");
  source = source.replace(typeAnchor, typeReplacement);
}

if (!source.includes("const invoiceRecurringIntervals = invoice.lines.data")) {
  const invoiceUserAnchor = `      const customerId = customerIdOf(invoice.customer);
      const user = customerId ? userByCustomer.get(customerId) : undefined;
      if (!user) continue;
      movements.push({`;
  const invoiceUserReplacement = `      const customerId = customerIdOf(invoice.customer);
      const user = customerId ? userByCustomer.get(customerId) : undefined;
      if (!user) continue;
      const invoiceRecurringIntervals = invoice.lines.data
        .map((line) => {
          const legacyInterval = (line as any).price?.recurring?.interval;
          if (typeof legacyInterval === "string") return legacyInterval;
          const priceId = (line as any).pricing?.price_details?.price;
          if (typeof priceId !== "string") return null;
          for (const candidate of subscriptions) {
            const matchingItem = candidate.items.data.find((item) => item.price.id === priceId);
            const interval = matchingItem?.price.recurring?.interval;
            if (typeof interval === "string") return interval;
          }
          return null;
        })
        .filter((interval): interval is "day" | "week" | "month" | "year" => typeof interval === "string");
      const activeSubscription = customerId ? activeByCustomer.get(customerId) : undefined;
      const activeRecurringIntervals = activeSubscription?.items.data
        .map((item) => item.price.recurring?.interval)
        .filter((interval): interval is "day" | "week" | "month" | "year" => typeof interval === "string") ?? [];
      const recurringIntervals = invoiceRecurringIntervals.length > 0
        ? invoiceRecurringIntervals
        : activeRecurringIntervals;
      const billingCycle: FinancialMovement["billingCycle"] = recurringIntervals.includes("year")
        ? "annual"
        : recurringIntervals.includes("month")
          ? "monthly"
          : null;
      movements.push({`;
  if (!source.includes(invoiceUserAnchor)) throw new Error("Finance invoice movement anchor not found");
  source = source.replace(invoiceUserAnchor, invoiceUserReplacement);
}

if (!source.includes("        billingCycle,")) {
  const subscriptionMovementAnchor = `        currency: invoice.currency ?? "brl",
        status: "Pago",
        createdAt: new Date(invoice.created * 1000).toISOString(),`;
  const subscriptionMovementReplacement = `        currency: invoice.currency ?? "brl",
        status: "Pago",
        billingCycle,
        createdAt: new Date(invoice.created * 1000).toISOString(),`;
  if (!source.includes(subscriptionMovementAnchor)) throw new Error("Finance subscription cycle output anchor not found");
  source = source.replace(subscriptionMovementAnchor, subscriptionMovementReplacement);
}

const plainSubscriptionLabel = '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan}`,';
const cycleSubscriptionLabel = '        label: `Assinatura ${PLAN_NAMES[user.plan] ?? user.plan}${billingCycle === "annual" ? " · Anual" : billingCycle === "monthly" ? " · Mensal" : ""}`,';
if (source.includes(plainSubscriptionLabel)) {
  source = source.replace(plainSubscriptionLabel, cycleSubscriptionLabel);
} else if (!source.includes(cycleSubscriptionLabel)) {
  throw new Error("Finance subscription label anchor not found");
}

if (!source.includes("        billingCycle: null,")) {
  const packageMovementAnchor = `        currency: session.currency ?? "brl",
        status: "Pago",
        createdAt: new Date(session.created * 1000).toISOString(),`;
  const packageMovementReplacement = `        currency: session.currency ?? "brl",
        status: "Pago",
        billingCycle: null,
        createdAt: new Date(session.created * 1000).toISOString(),`;
  if (!source.includes(packageMovementAnchor)) throw new Error("Finance package cycle output anchor not found");
  source = source.replace(packageMovementAnchor, packageMovementReplacement);
}

for (const marker of [
  'billingCycle: "monthly" | "annual" | null;',
  "const invoiceRecurringIntervals = invoice.lines.data",
  "const activeRecurringIntervals = activeSubscription?.items.data",
  'const billingCycle: FinancialMovement["billingCycle"]',
  'billingCycle === "annual" ? " · Anual"',
  "billingCycle,",
  "billingCycle: null,",
]) {
  if (!source.includes(marker)) throw new Error(`Finance billing-cycle marker missing: ${marker}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance exposes the billing cycle directly in each subscription movement title without changing billing operations.");
