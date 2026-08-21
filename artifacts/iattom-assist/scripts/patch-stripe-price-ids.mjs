import { readFileSync, writeFileSync } from "node:fs";

const modalUrl = new URL("../src/components/PlanComparisonModal.tsx", import.meta.url);
let source = readFileSync(modalUrl, "utf8");

const orderMarker = 'const PLAN_ORDER = ["free", "pro", "business", "agency"];';
const priceMap = `

const STRIPE_PLAN_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
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

if (!source.includes("STRIPE_PLAN_PRICE_IDS")) {
  if (!source.includes(orderMarker)) throw new Error("Plan order marker not found");
  source = source.replace(orderMarker, orderMarker + priceMap);
}

const oldHandler = `  const handleUpgrade = (priceId: string | null | undefined, planKey: string) => {
    checkout.mutate({ data: { priceId: priceId ?? "free", planKey } });
  };`;
const newHandler = `  const handleUpgrade = (fallbackPriceId: string | null | undefined, planKey: string) => {
    const officialPriceId = STRIPE_PLAN_PRICE_IDS[planKey]?.[billing];
    const priceId = officialPriceId ?? fallbackPriceId;
    if (!priceId) {
      toast({ title: "Preço indisponível", description: "O plano selecionado ainda não está disponível para compra.", variant: "destructive" });
      return;
    }
    checkout.mutate({ data: { priceId, planKey } });
  };`;

if (source.includes(oldHandler)) {
  source = source.replace(oldHandler, newHandler);
} else if (!source.includes("const officialPriceId = STRIPE_PLAN_PRICE_IDS")) {
  throw new Error("Plan checkout handler marker not found");
}

writeFileSync(modalUrl, source);
console.log("Official monthly and annual Stripe price IDs applied to plan checkout");
