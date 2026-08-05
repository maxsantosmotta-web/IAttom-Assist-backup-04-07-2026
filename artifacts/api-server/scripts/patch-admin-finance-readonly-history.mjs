import fs from "node:fs";

const routePath = new URL("../src/routes/adminFinanceReadOnly.ts", import.meta.url);
let source = fs.readFileSync(routePath, "utf8");

const invoiceFilterOld = `    const paidInvoices = invoices.filter((invoice) => {
      const customerId = customerIdOf(invoice.customer);
      return invoice.status === "paid"
        && (invoice.amount_paid ?? 0) > 0
        && Boolean(customerId && userByCustomer.has(customerId));
    });`;
const invoiceFilterNew = `    const paidInvoices = invoices.filter((invoice) =>
      invoice.status === "paid" && (invoice.amount_paid ?? 0) > 0,
    );`;
if (!source.includes(invoiceFilterNew)) {
  if (!source.includes(invoiceFilterOld)) throw new Error("Readonly finance paid-invoice filter anchor not found");
  source = source.replace(invoiceFilterOld, invoiceFilterNew);
}

const packageFilterOld = `    const paidPackages = checkoutSessions.filter((session) => {
      const customerId = customerIdOf(session.customer);
      return session.mode === "payment"
        && session.status === "complete"
        && session.payment_status === "paid"
        && (session.amount_total ?? 0) > 0
        && Boolean(customerId && userByCustomer.has(customerId));
    });`;
const packageFilterNew = `    const paidPackages = checkoutSessions.filter((session) =>
      session.mode === "payment" &&
      session.status === "complete" &&
      session.payment_status === "paid" &&
      (session.amount_total ?? 0) > 0,
    );`;
if (!source.includes(packageFilterNew)) {
  if (!source.includes(packageFilterOld)) throw new Error("Readonly finance paid-package filter anchor not found");
  source = source.replace(packageFilterOld, packageFilterNew);
}

const invoiceLoopOld = `      const user = customerId ? userByCustomer.get(customerId) : undefined;
      if (!user) continue;
      const historicalPlan = invoicePlanName(invoice, user.plan);
      movements.push({
        id: invoice.id,
        type: "subscription",
        label: \`Assinatura \${historicalPlan}\`,
        userName: user.name,
        userEmail: user.email,
        plan: historicalPlan,`;
const invoiceLoopNew = `      const user = customerId ? userByCustomer.get(customerId) : undefined;
      const historicalPlan = invoicePlanName(invoice, user?.plan ?? "free");
      movements.push({
        id: invoice.id,
        type: "subscription",
        label: \`Assinatura \${historicalPlan}\`,
        userName: user?.name ?? invoice.customer_name ?? null,
        userEmail: user?.email ?? invoice.customer_email ?? "Cliente Stripe",
        plan: historicalPlan,`;
if (!source.includes("invoice.customer_email ?? \"Cliente Stripe\"")) {
  if (!source.includes(invoiceLoopOld)) throw new Error("Readonly finance invoice movement anchor not found");
  source = source.replace(invoiceLoopOld, invoiceLoopNew);
}

const packageLoopOld = `      const user = customerId ? userByCustomer.get(customerId) : undefined;
      if (!user) continue;
      const rawType = session.metadata?.type;`;
const packageLoopNew = `      const user = customerId ? userByCustomer.get(customerId) : undefined;
      const rawType = session.metadata?.type;`;
if (!source.includes(packageLoopNew)) {
  if (!source.includes(packageLoopOld)) throw new Error("Readonly finance package movement anchor not found");
  source = source.replace(packageLoopOld, packageLoopNew);
}

const packageMovementOld = `        userName: user.name,
        userEmail: user.email,
        plan: sessionPlanName(session, user.plan),`;
const packageMovementNew = `        userName: user?.name ?? session.customer_details?.name ?? null,
        userEmail: user?.email ?? session.customer_details?.email ?? session.customer_email ?? "Cliente Stripe",
        plan: sessionPlanName(session, user?.plan ?? "free"),`;
if (!source.includes("session.customer_details?.email")) {
  if (!source.includes(packageMovementOld)) throw new Error("Readonly finance package identity anchor not found");
  source = source.replace(packageMovementOld, packageMovementNew);
}

const emptyAnchor = `    mrrByPlan: { free: 0, pro: 0, business: 0, agency: 0 },
    recentMovements: [] as FinancialMovement[],`;
const emptyReplacement = `    mrrByPlan: { free: 0, pro: 0, business: 0, agency: 0 },
    annualSubscriptions: { total: 0, start: 0, premium: 0, pro: 0 },
    recentMovements: [] as FinancialMovement[],`;
if (!source.includes("annualSubscriptions: { total: 0, start: 0, premium: 0, pro: 0 },")) {
  if (!source.includes(emptyAnchor)) throw new Error("Readonly finance annual empty anchor not found");
  source = source.replace(emptyAnchor, emptyReplacement);
}

const annualAnchor = `    const mrrCents = Object.values(mrrByPlan).reduce((sum, value) => sum + value, 0);`;
const annualReplacement = `    const annualSubscriptions = { total: 0, start: 0, premium: 0, pro: 0 };
    for (const [customerId, subscription] of activeByCustomer) {
      const isAnnual = (subscription.items?.data ?? []).some((item: any) => item.price?.recurring?.interval === "year");
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
  if (!source.includes(annualAnchor)) throw new Error("Readonly finance annual calculation anchor not found");
  source = source.replace(annualAnchor, annualReplacement);
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
  if (!source.includes(responseAnchor)) throw new Error("Readonly finance annual response anchor not found");
  source = source.replace(responseAnchor, responseReplacement);
}

for (const marker of [
  "invoice.customer_email ?? \"Cliente Stripe\"",
  "session.customer_details?.email",
  "annualSubscriptions: { total: 0, start: 0, premium: 0, pro: 0 },",
  "const annualSubscriptions = { total: 0, start: 0, premium: 0, pro: 0 };",
  "      annualSubscriptions,",
]) {
  if (!source.includes(marker)) throw new Error(`Readonly finance final marker missing: ${marker}`);
}

for (const forbidden of [
  "Boolean(customerId && userByCustomer.has(customerId))",
  "if (!user) continue;",
]) {
  if (source.includes(forbidden)) throw new Error(`Readonly finance still deletes history through current-customer dependency: ${forbidden}`);
}

fs.writeFileSync(routePath, source);
console.log("Active readonly Finance route now preserves paid history and reports active annual subscriptions.");
