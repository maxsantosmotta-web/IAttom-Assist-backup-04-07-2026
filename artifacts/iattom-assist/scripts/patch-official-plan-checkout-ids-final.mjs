import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
const modalUrl = new URL("../src/components/PlanComparisonModal.tsx", import.meta.url);

let billing = readFileSync(billingUrl, "utf8");
let modal = readFileSync(modalUrl, "utf8");

const priceMap = `const OFFICIAL_PLAN_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  pro: {
    monthly: "price_1TunJ2AYtu5nLhAZPd1Ai0hD",
    annual: "price_1TunNxAYtu5nLhAZw0frXi2Z",
  },
  business: {
    monthly: "price_1TunQhAYtu5nLhAZu5QXWW31",
    annual: "price_1TunROAYtu5nLhAZqhKUuslz",
  },
  agency: {
    monthly: "price_1TunTDAYtu5nLhAZDfzTn8Cm",
    annual: "price_1TunTgAYtu5nLhAZ5nRh52J8",
  },
};`;

if (!billing.includes("const OFFICIAL_PLAN_PRICE_IDS")) {
  const marker = "/* ─── plan visual tokens";
  if (!billing.includes(marker)) throw new Error("Billing plan visual marker not found");
  billing = billing.replace(marker, `${priceMap}\n\n${marker}`);
}

const officialCheckoutBlock = `    const officialPriceId = OFFICIAL_PLAN_PRICE_IDS[planKey]?.[billing];
    if (!officialPriceId) {
      toast({ title: "Preço indisponível", description: "O plano selecionado ainda não está disponível para compra.", variant: "destructive" });
      return;
    }
    checkout.mutate({ data: { priceId: officialPriceId, planKey } });`;

if (!billing.includes("OFFICIAL_PLAN_PRICE_IDS[planKey]?.[billing]")) {
  const billingCheckoutPattern = /^\s*checkout\.mutate\(\{ data: \{ priceId: [^\n]+, planKey \} \}\);$/m;
  const matches = billing.match(new RegExp(billingCheckoutPattern.source, "gm")) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Billing plan checkout call count invalid: ${matches.length}`);
  }
  billing = billing.replace(billingCheckoutPattern, officialCheckoutBlock);
}

if (!modal.includes("const OFFICIAL_PLAN_PRICE_IDS")) {
  const marker = 'const PLAN_ORDER = ["free", "pro", "business", "agency"];';
  if (!modal.includes(marker)) throw new Error("Plan modal order marker not found");
  modal = modal.replace(marker, `${marker}\n\n${priceMap}`);
}

if (!modal.includes("OFFICIAL_PLAN_PRICE_IDS[planKey]?.[billing]")) {
  const modalCheckoutPattern = /^\s*checkout\.mutate\(\{ data: \{ priceId: [^\n]+, planKey \} \}\);$/m;
  const matches = modal.match(new RegExp(modalCheckoutPattern.source, "gm")) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Plan modal checkout call count invalid: ${matches.length}`);
  }
  modal = modal.replace(modalCheckoutPattern, officialCheckoutBlock);
}

for (const id of [
  "price_1TunJ2AYtu5nLhAZPd1Ai0hD",
  "price_1TunNxAYtu5nLhAZw0frXi2Z",
  "price_1TunQhAYtu5nLhAZu5QXWW31",
  "price_1TunROAYtu5nLhAZqhKUuslz",
  "price_1TunTDAYtu5nLhAZDfzTn8Cm",
  "price_1TunTgAYtu5nLhAZ5nRh52J8",
]) {
  if (!billing.includes(id) || !modal.includes(id)) {
    throw new Error(`Official plan Price ID missing: ${id}`);
  }
}

for (const [name, source] of [["Billing", billing], ["PlanComparisonModal", modal]]) {
  const officialCalls = source.match(/checkout\.mutate\(\{ data: \{ priceId: officialPriceId, planKey \} \}\);/g) ?? [];
  if (officialCalls.length !== 1) {
    throw new Error(`${name} official checkout call count invalid: ${officialCalls.length}`);
  }
}

writeFileSync(billingUrl, billing);
writeFileSync(modalUrl, modal);
console.log("Official monthly and annual plan Price IDs applied to the real Billing and PlanComparisonModal checkout calls.");
