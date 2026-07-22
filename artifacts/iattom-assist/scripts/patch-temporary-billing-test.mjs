import { readFileSync, writeFileSync } from "node:fs";

function read(url) {
  return readFileSync(url, "utf8");
}

function write(url, source) {
  writeFileSync(url, source);
}

const frontendCreditsUrl = new URL("../src/lib/credits.ts", import.meta.url);
let frontendCredits = read(frontendCreditsUrl);
frontendCredits = frontendCredits
  .replace(/export const PLAN_CREDITS = \{[\s\S]*?\} as const;/, `export const PLAN_CREDITS = {
  free: 0,
  pro: 20,
  business: 20,
  agency: 20,
} as const;`)
  .replace(/export const PLAN_CREATIVE_CREDITS = \{[\s\S]*?\} as const;/, `export const PLAN_CREATIVE_CREDITS = {
  free: 0,
  pro: 40,
  business: 40,
  agency: 40,
} as const;`)
  .replace(/monthly: 69,[\s\S]*?yearlyMonthlyDisplay: "R\$58,08\/mês",/, `monthly: 0.5,
    yearly: 1.5,
    monthlyDisplay: "R$0,50/mês",
    yearlyDisplay: "R$1,50/ano",
    yearlyMonthlyDisplay: "R$0,13/mês",`)
  .replace(/monthly: 159,[\s\S]*?yearlyMonthlyDisplay: "R\$130,42\/mês",/, `monthly: 0.5,
    yearly: 1.5,
    monthlyDisplay: "R$0,50/mês",
    yearlyDisplay: "R$1,50/ano",
    yearlyMonthlyDisplay: "R$0,13/mês",`)
  .replace(/monthly: 299,[\s\S]*?yearlyMonthlyDisplay: "R\$239,20\/mês",/, `monthly: 0.5,
    yearly: 1.5,
    monthlyDisplay: "R$0,50/mês",
    yearlyDisplay: "R$1,50/ano",
    yearlyMonthlyDisplay: "R$0,13/mês",`);
write(frontendCreditsUrl, frontendCredits);

const backendCreditsUrl = new URL("../../api-server/src/lib/credits.ts", import.meta.url);
let backendCredits = read(backendCreditsUrl);
backendCredits = backendCredits
  .replace(/export const PLAN_CREDITS = \{[\s\S]*?\} as const;/, `export const PLAN_CREDITS = {
  free: 0,
  pro: 20,
  business: 20,
  agency: 20,
} as const;`)
  .replace(/export const PLAN_CREATIVE_CREDITS = \{[\s\S]*?\} as const;/, `export const PLAN_CREATIVE_CREDITS = {
  free: 0,
  pro: 40,
  business: 40,
  agency: 40,
} as const;`);
write(backendCreditsUrl, backendCredits);

const webhookUrl = new URL("../../api-server/src/lib/webhookHandlers.ts", import.meta.url);
let webhook = read(webhookUrl);
webhook = webhook
  .replace(/const PLAN_CREDITS: Record<string, number> = \{[\s\S]*?\};/, `const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 20,
  business: 20,
  agency: 20,
};`)
  .replace(/const PLAN_CREATIVE_CREDITS: Record<string, number> = \{[\s\S]*?\};/, `const PLAN_CREATIVE_CREDITS: Record<string, number> = {
  free: 0,
  pro: 40,
  business: 40,
  agency: 40,
};`);
write(webhookUrl, webhook);

const stripeRoutesUrl = new URL("../../api-server/src/routes/stripe.ts", import.meta.url);
let stripeRoutes = read(stripeRoutesUrl);
stripeRoutes = stripeRoutes
  .replace(/const CREDIT_PACKAGES = \[[\s\S]*?\] as const;/, `const CREDIT_PACKAGES = [
  { id: "credits_300", credits: 300, priceId: "price_1TvgKKAYtu5nLhAZXhkAJgGT", name: "Pacote 300 Créditos", displayPrice: "R$ 0,50" },
  { id: "credits_700", credits: 700, priceId: "price_1TvgLCAYtu5nLhAZhTyBuMoY", name: "Pacote 700 Créditos", displayPrice: "R$ 0,55" },
  { id: "credits_1500", credits: 1500, priceId: "price_1TvgLvAYtu5nLhAZuz4Ee5Kf", name: "Pacote 1.500 Créditos", displayPrice: "R$ 0,60" },
] as const;`)
  .replace(/const CREATIVE_PACKAGES = \[[\s\S]*?\] as const;/, `const CREATIVE_PACKAGES = [
  { id: "creative_20", creativeCredits: 200, priceId: "price_1TvgMnAYtu5nLhAZBK6h9T5g", name: "Criativo 20", displayPrice: "R$ 0,50" },
  { id: "creative_35", creativeCredits: 350, priceId: "price_1TvgNFAYtu5nLhAZyxIhYqRC", name: "Criativo 35", displayPrice: "R$ 0,55" },
  { id: "creative_50", creativeCredits: 500, priceId: "price_1TvgNkAYtu5nLhAZAz3wtyBX", name: "Criativo 50", displayPrice: "R$ 0,60" },
] as const;`)
  .replace(/const PLAN_CREDITS: Record<string, number> = \{[\s\S]*?\};/, `const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 20,
  business: 20,
  agency: 20,
};`)
  .replace(/pkg\.unitAmountBrl,/g, "pkg.priceId,")
  .replace(/"50 créditos\/mês"/g, '"0 créditos"')
  .replace(/"500 créditos\/mês"/g, '"20 créditos gerais + 40 de imagem"')
  .replace(/"2\.000 créditos\/mês"/g, '"20 créditos gerais + 40 de imagem"')
  .replace(/"10\.000 créditos\/mês"/g, '"20 créditos gerais + 40 de imagem"');
write(stripeRoutesUrl, stripeRoutes);

const stripeServiceUrl = new URL("../../api-server/src/lib/stripeService.ts", import.meta.url);
let stripeService = read(stripeServiceUrl);
stripeService = stripeService
  .replace(`  unitAmountBrl: number,\n  packageName: string,`, `  priceId: string,\n  packageName: string,`)
  .replace(`  unitAmountBrl: number,\n  packageName: string,`, `  priceId: string,\n  packageName: string,`)
  .replace(/line_items: \[\n      \{\n        price_data: \{\n          currency: "brl",\n          unit_amount: unitAmountBrl,\n          product_data: \{\n            name: packageName,\n            description: `\$\{credits\.toLocaleString\("pt-BR"\)\} créditos — compra avulsa \(não expiram\)`,\n          \},\n        \},\n        quantity: 1,\n      \},\n    \],/, `line_items: [{ price: priceId, quantity: 1 }],`)
  .replace(/line_items: \[\n      \{\n        price_data: \{\n          currency: "brl",\n          unit_amount: unitAmountBrl,\n          product_data: \{\n            name: packageName,\n            description: `\$\{creativeCredits\} créditos criativos — compra avulsa \(não expiram\)`,\n          \},\n        \},\n        quantity: 1,\n      \},\n    \],/, `line_items: [{ price: priceId, quantity: 1 }],`);
write(stripeServiceUrl, stripeService);

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let billing = read(billingUrl);
billing = billing
  .replace('price: "R$ 39,90"', 'price: "R$ 0,50"')
  .replace('price: "R$ 79,90"', 'price: "R$ 0,55"')
  .replace('price: "R$ 149,90"', 'price: "R$ 0,60"')
  .replace('images: 20, price: "R$ 47,00"', 'images: 20, price: "R$ 0,50"')
  .replace('images: 35, price: "R$ 79,00"', 'images: 35, price: "R$ 0,55"')
  .replace('images: 50, price: "R$ 89,00"', 'images: 50, price: "R$ 0,60"');
write(billingUrl, billing);

const creditsPageUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
let creditsPage = read(creditsPageUrl);
creditsPage = creditsPage
  .replace(
    `  const upgradePlans = balance
    ? (Object.keys(PLAN_CREDITS) as Array<keyof typeof PLAN_CREDITS>).filter(
        (p) => PLAN_CREDITS[p] > (PLAN_CREDITS[balance.plan as keyof typeof PLAN_CREDITS] ?? 0),
      )
    : [];`,
    `  const PLAN_HIERARCHY = ["free", "pro", "business", "agency"] as const;
  const currentPlanKey = (balance?.plan && PLAN_HIERARCHY.includes(balance.plan as typeof PLAN_HIERARCHY[number]))
    ? balance.plan as typeof PLAN_HIERARCHY[number]
    : "free";
  const currentPlanIndex = PLAN_HIERARCHY.indexOf(currentPlanKey);
  const upgradePlans = PLAN_HIERARCHY.slice(currentPlanIndex + 1);`,
  )
  .replace(
    `  const PLAN_DISPLAY_NAMES: Record<string, string> = { free: "START", pro: "COMPLETO", business: "PREMIUM", agency: "PRO" };
  const currentPlanDisplay = balance?.plan ? (PLAN_DISPLAY_NAMES[balance.plan] ?? balance.plan) : "START";`,
    `  const PLAN_DISPLAY_NAMES: Record<string, string> = { free: "FREE", pro: "START", business: "PREMIUM", agency: "PRO" };
  const currentPlanDisplay = PLAN_DISPLAY_NAMES[currentPlanKey];`,
  );
write(creditsPageUrl, creditsPage);

console.log("Temporary billing test configuration applied with correct plan labels and upgrade hierarchy");
