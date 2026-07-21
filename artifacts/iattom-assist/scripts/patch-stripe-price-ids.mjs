import { readFileSync, writeFileSync } from "node:fs";

const modalUrl = new URL("../src/components/PlanComparisonModal.tsx", import.meta.url);
let source = readFileSync(modalUrl, "utf8");

const orderMarker = 'const PLAN_ORDER = ["free", "pro", "business", "agency"];';
const priceMap = `

const STRIPE_PLAN_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  pro: {
    monthly: "price_1TvgAOAYtu5nLhAZmgqhsTxJ",
    annual: "price_1TvgDBAYtu5nLhAZsgenq5SJ",
  },
  business: {
    monthly: "price_1TvgEwAYtu5nLhAZvWozumfH",
    annual: "price_1TvgFWAYtu5nLhAZuT001wT5",
  },
  agency: {
    monthly: "price_1TvgGHAYtu5nLhAZt4gYmBM5",
    annual: "price_1TvgGgAYtu5nLhAZO8FYa6nK",
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
console.log("Temporary monthly and annual Stripe price IDs applied to plan checkout");
