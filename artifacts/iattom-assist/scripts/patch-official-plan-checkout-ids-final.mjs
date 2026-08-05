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

const billingLegacy = '    checkout.mutate({ data: { priceId: priceId ?? "free", planKey } });';
const billingOfficial = `    const officialPriceId = OFFICIAL_PLAN_PRICE_IDS[planKey]?.[billing];
    if (!officialPriceId) {
      toast({ title: "Preço indisponível", description: "O plano selecionado ainda não está disponível para compra.", variant: "destructive" });
      return;
    }
    checkout.mutate({ data: { priceId: officialPriceId, planKey } });`;
if (billing.includes(billingLegacy)) {
  billing = billing.replace(billingLegacy, billingOfficial);
} else if (!billing.includes("OFFICIAL_PLAN_PRICE_IDS[planKey]?.[billing]")) {
  throw new Error("Billing checkout handler marker not found");
}

if (!modal.includes("const OFFICIAL_PLAN_PRICE_IDS")) {
  const marker = 'const PLAN_ORDER = ["free", "pro", "business", "agency"];';
  if (!modal.includes(marker)) throw new Error("Plan modal order marker not found");
  modal = modal.replace(marker, `${marker}\n\n${priceMap}`);
}

const modalLegacy = `  const handleUpgrade = (priceId: string | null | undefined, planKey: string) => {
    checkout.mutate({ data: { priceId: priceId ?? "free", planKey } });
  };`;
const modalOfficial = `  const handleUpgrade = (_priceId: string | null | undefined, planKey: string) => {
    const officialPriceId = OFFICIAL_PLAN_PRICE_IDS[planKey]?.[billing];
    if (!officialPriceId) {
      toast({ title: "Preço indisponível", description: "O plano selecionado ainda não está disponível para compra.", variant: "destructive" });
      return;
    }
    checkout.mutate({ data: { priceId: officialPriceId, planKey } });
  };`;
if (modal.includes(modalLegacy)) {
  modal = modal.replace(modalLegacy, modalOfficial);
} else if (!modal.includes("OFFICIAL_PLAN_PRICE_IDS[planKey]?.[billing]")) {
  throw new Error("Plan modal checkout handler marker not found");
}

for (const id of [
  "price_1TunJ2AYtu5nLhAZPd1Ai0hD",
  "price_1TunNxAYtu5nLhAZw0frXi2Z",
  "price_1TunQhAYtu5nLhAZu5QXWW31",
  "price_1TunROAYtu5nLhAZqhKUuslz",
  "price_1TunTDAYtu5nLhAZDfzTn8Cm",
  "price_1TunTgAYtu5nLhAZ5nRh52J8",
]) {
  if (!billing.includes(id) || !modal.includes(id)) throw new Error(`Official plan Price ID missing: ${id}`);
}

writeFileSync(billingUrl, billing);
writeFileSync(modalUrl, modal);
console.log("Official monthly and annual plan Price IDs applied to Billing and PlanComparisonModal.");
