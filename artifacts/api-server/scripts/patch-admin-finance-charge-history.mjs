import fs from "node:fs";

const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
let source = fs.readFileSync(growthPath, "utf8");

const promiseHeaderAnchor = `    const [subscriptions, invoices, checkoutSessions] = await Promise.all([`;
const promiseHeaderReplacement = `    const [subscriptions, invoices, checkoutSessions, charges] = await Promise.all([`;
if (!source.includes("checkoutSessions, charges")) {
  if (!source.includes(promiseHeaderAnchor)) throw new Error("Finance Stripe promise header anchor not found");
  source = source.replace(promiseHeaderAnchor, promiseHeaderReplacement);
}

const checkoutQueryAnchor = `      stripe.checkout.sessions.list({ created: { gte: createdGte }, limit: 100 }).autoPagingToArray({ limit: 1000 }),
    ]);`;
const checkoutQueryReplacement = `      stripe.checkout.sessions.list({ created: { gte: createdGte }, limit: 100 }).autoPagingToArray({ limit: 1000 }),
      stripe.charges.list({ created: { gte: createdGte }, limit: 100 }).autoPagingToArray({ limit: 1000 }),
    ]);`;
if (!source.includes("stripe.charges.list({ created: { gte: createdGte }")) {
  if (!source.includes(checkoutQueryAnchor)) throw new Error("Finance Stripe charges query anchor not found");
  source = source.replace(checkoutQueryAnchor, checkoutQueryReplacement);
}

const historyStart = source.indexOf("    const paidInvoices = invoices.filter(");
const historyEnd = source.indexOf("    const annualSubscriptions =", historyStart);
if (historyStart === -1 || historyEnd === -1 || historyEnd <= historyStart) {
  throw new Error("Finance historical movement block boundaries not found");
}

const chargeHistoryBlock = `    const successfulCharges = charges.filter((charge) =>
      charge.paid === true &&
      charge.captured === true &&
      (charge.amount_captured ?? charge.amount ?? 0) > 0,
    );

    const movements: FinancialMovement[] = successfulCharges.map((charge) => {
      const customerId = customerIdOf(charge.customer);
      const user = customerId ? userByCustomer.get(customerId) : undefined;
      const rawType = charge.metadata?.type;
      const type: FinancialMovement["type"] = rawType === "creative_pack"
        ? "creative_pack"
        : rawType === "video_pack"
          ? "video_pack"
          : rawType === "credit_pack" || rawType === "credit_purchase"
            ? "credit_pack"
            : "subscription";
      const planKey = user?.plan ?? charge.metadata?.planKey ?? charge.metadata?.plan ?? "free";
      const label = type === "creative_pack"
        ? "Pacote de imagens"
        : type === "video_pack"
          ? "Pacote de vídeos"
          : type === "credit_pack"
            ? "Pacote de créditos"
            : user
              ? \`Assinatura \${PLAN_NAMES[planKey] ?? planKey}\`
              : "Pagamento Stripe";

      return {
        id: charge.id,
        type,
        label,
        userName: user?.name ?? charge.billing_details.name ?? null,
        userEmail: user?.email ?? charge.billing_details.email ?? charge.receipt_email ?? "Cliente Stripe",
        plan: user ? (PLAN_NAMES[planKey] ?? planKey) : "—",
        amountCents: charge.amount_captured ?? charge.amount ?? 0,
        currency: charge.currency ?? "brl",
        status: "Pago",
        createdAt: new Date(charge.created * 1000).toISOString(),
      };
    });

`;
source = source.slice(0, historyStart) + chargeHistoryBlock + source.slice(historyEnd);

const revenueAnchor = `    const invoiceRevenueCents = paidInvoices.reduce((sum, invoice) => sum + (invoice.amount_paid ?? 0), 0);
    const packageRevenueCents = paidPackages.reduce((sum, session) => sum + (session.amount_total ?? 0), 0);`;
const revenueReplacement = `    const chargeRevenueCents = successfulCharges.reduce(
      (sum, charge) => sum + (charge.amount_captured ?? charge.amount ?? 0),
      0,
    );
    const packageRevenueCents = successfulCharges
      .filter((charge) => {
        const type = charge.metadata?.type;
        return type === "credit_pack" || type === "credit_purchase" || type === "creative_pack" || type === "video_pack";
      })
      .reduce((sum, charge) => sum + (charge.amount_captured ?? charge.amount ?? 0), 0);`;
if (!source.includes("const chargeRevenueCents = successfulCharges.reduce")) {
  if (!source.includes(revenueAnchor)) throw new Error("Finance revenue calculation anchor not found");
  source = source.replace(revenueAnchor, revenueReplacement);
}

const responseRevenueAnchor = `      revenueThisMonth: (invoiceRevenueCents + packageRevenueCents) / 100,`;
const responseRevenueReplacement = `      revenueThisMonth: chargeRevenueCents / 100,`;
if (!source.includes("revenueThisMonth: chargeRevenueCents / 100")) {
  if (!source.includes(responseRevenueAnchor)) throw new Error("Finance revenue response anchor not found");
  source = source.replace(responseRevenueAnchor, responseRevenueReplacement);
}

for (const marker of [
  "checkoutSessions, charges",
  "stripe.charges.list({ created: { gte: createdGte }",
  "charge.paid === true",
  "charge.captured === true",
  "const successfulCharges = charges.filter",
  "revenueThisMonth: chargeRevenueCents / 100",
  "recentMovements: movements",
]) {
  if (!source.includes(marker)) throw new Error(`Finance charge-history marker missing: ${marker}`);
}

for (const forbidden of [
  'charge.status === "succeeded"',
  "const paidInvoices = invoices.filter",
  "const paidPackages = checkoutSessions.filter",
  "invoiceRevenueCents",
]) {
  if (source.includes(forbidden)) throw new Error(`Invalid historical source still present: ${forbidden}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance historical revenue now uses paid and captured Stripe charges without current-customer dependency.");
