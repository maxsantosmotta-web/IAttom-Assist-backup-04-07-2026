import fs from "node:fs";

const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
let source = fs.readFileSync(growthPath, "utf8");

const historyStart = source.indexOf("    const paidInvoices = invoices.filter(");
const historyEnd = source.indexOf("    const annualSubscriptions =", historyStart);
if (historyStart === -1 || historyEnd === -1 || historyEnd <= historyStart) {
  throw new Error("Finance historical movement block boundaries not found");
}

const persistentHistoryBlock = `    const paidInvoices = invoices.filter(
      (invoice) => invoice.status === "paid" && (invoice.amount_paid ?? 0) > 0,
    );
    const paidPackages = checkoutSessions.filter((session) =>
      session.mode === "payment" &&
      session.status === "complete" &&
      session.payment_status === "paid" &&
      (session.amount_total ?? 0) > 0,
    );

    const movements: FinancialMovement[] = [];

    for (const invoice of paidInvoices) {
      const customerId = customerIdOf(invoice.customer);
      const user = customerId ? userByCustomer.get(customerId) : undefined;
      const planKey = user?.plan ?? "free";
      movements.push({
        id: invoice.id,
        type: "subscription",
        label: user ? \`Assinatura \${PLAN_NAMES[planKey] ?? planKey}\` : "Assinatura",
        userName: user?.name ?? invoice.customer_name ?? null,
        userEmail: user?.email ?? invoice.customer_email ?? "Cliente Stripe",
        plan: user ? (PLAN_NAMES[planKey] ?? planKey) : "—",
        amountCents: invoice.amount_paid ?? 0,
        currency: invoice.currency ?? "brl",
        status: "Pago",
        createdAt: new Date(invoice.created * 1000).toISOString(),
      });
    }

    for (const session of paidPackages) {
      const customerId = customerIdOf(session.customer);
      const user = customerId ? userByCustomer.get(customerId) : undefined;
      const rawType = session.metadata?.type;
      const type: FinancialMovement["type"] = rawType === "creative_pack"
        ? "creative_pack"
        : rawType === "video_pack"
          ? "video_pack"
          : "credit_pack";
      const label = type === "creative_pack"
        ? "Pacote de imagens"
        : type === "video_pack"
          ? "Pacote de vídeos"
          : "Pacote de créditos";
      const planKey = user?.plan ?? session.metadata?.planKey ?? session.metadata?.plan ?? "free";
      movements.push({
        id: session.id,
        type,
        label,
        userName: user?.name ?? session.customer_details?.name ?? null,
        userEmail: user?.email ?? session.customer_details?.email ?? session.customer_email ?? "Cliente Stripe",
        plan: user ? (PLAN_NAMES[planKey] ?? planKey) : "—",
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "brl",
        status: "Pago",
        createdAt: new Date(session.created * 1000).toISOString(),
      });
    }

`;

source = source.slice(0, historyStart) + persistentHistoryBlock + source.slice(historyEnd);

for (const marker of [
  "invoice.customer_email",
  "session.customer_details?.email",
  "const paidInvoices = invoices.filter",
  "const paidPackages = checkoutSessions.filter",
  "recentMovements: movements",
]) {
  if (!source.includes(marker)) throw new Error(`Finance persistent-history marker missing: ${marker}`);
}

for (const forbidden of [
  "checkoutSessions, charges",
  "stripe.charges.list(",
  "const successfulCharges = charges.filter",
  "chargeRevenueCents",
]) {
  if (source.includes(forbidden)) throw new Error(`Parallel charge history still present: ${forbidden}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance preserves paid invoice and package history independently of current customer records.");
