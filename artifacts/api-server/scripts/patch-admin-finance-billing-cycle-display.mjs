import fs from "node:fs";

const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
let source = fs.readFileSync(growthPath, "utf8");

source = source
  .replace(/\n\s*priceId\?: string \| null;\n\s*interval\?: string \| null;/g, "")
  .replace(/\n\s*annualSubscriptions: \{ total: number; start: number; premium: number; pro: number \};/g, "")
  .replace(/\n\s*annualSubscriptions: \{ total: 0, start: 0, premium: 0, pro: 0 \},/g, "")
  .replace(/\n\s*const ANNUAL_PRICE_IDS = new Set\([\s\S]*?\n\s*const paidPackages =/m, "\n    const paidPackages =")
  .replace(/\n\s*const annualUsersByClerkId = new Map<string, CommercialUser>\(\);/g, "")
  .replace(/\n\s*const priceInfo = invoicePriceInfo\(invoice\);\n\s*if \(priceInfo\.annual && user\.plan !== "free"\) annualUsersByClerkId\.set\(user\.clerkId, user\);/g, "")
  .replace(/\n\s*priceId: priceInfo\.priceId,\n\s*interval: priceInfo\.interval,/g, "")
  .replace(/\n\s*const annualUsers = \[\.\.\.annualUsersByClerkId\.values\(\)\];[\s\S]*?\n\s*const mrrCents =/m, "\n    const mrrCents =")
  .replace(/\n\s*annualSubscriptions,\n\s*recentMovements:/g, "\n      recentMovements:");

source = source
  .replace(/ · \$\{annualInvoice \? "Anual" : "Mensal"\}/g, "")
  .replace(/ · \$\{subscriptionCycleLabel\([^}]+\)\}/g, "");

for (const forbidden of [
  "annualSubscriptions:",
  "ANNUAL_PRICE_IDS",
  "invoicePriceInfo",
  "annualUsersByClerkId",
  "priceId: priceInfo.priceId",
  "interval: priceInfo.interval",
  "stripe.prices.retrieve(priceId)",
]) {
  if (source.includes(forbidden)) throw new Error(`Annual Finance API cleanup failed: ${forbidden}`);
}

fs.writeFileSync(growthPath, source);
console.log("Failed annual Finance API logic and diagnostics removed; existing financial summary preserved.");
