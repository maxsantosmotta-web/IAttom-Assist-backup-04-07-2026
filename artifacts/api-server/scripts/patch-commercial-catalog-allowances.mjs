import fs from "node:fs";

function read(url) {
  return fs.readFileSync(url, "utf8");
}
function write(url, value) {
  fs.writeFileSync(url, value);
}

const planAllowanceExpression = 'planKey === "pro" ? 200 : planKey === "business" ? 500 : 1000';

const creditsPath = new URL("../src/lib/credits.ts", import.meta.url);
let credits = read(creditsPath).replace(
  /export const PLAN_CREDITS = \{[\s\S]*?\} as const;/,
  `export const PLAN_CREDITS = {
  free: 0,
  pro: 200,
  business: 500,
  agency: 1000,
} as const;`,
);
write(creditsPath, credits);

const webhookPath = new URL("../src/lib/webhookHandlers.ts", import.meta.url);
let webhook = read(webhookPath).replace(
  /const PLAN_CREDITS: Record<string, number> = \{[\s\S]*?\};/,
  `const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 200,
  business: 500,
  agency: 1000,
};`,
);
write(webhookPath, webhook);

const stripeRoutePath = new URL("../src/routes/stripe.ts", import.meta.url);
let route = read(stripeRoutePath);

route = route
  .replace(
    /const CREDIT_PACKAGES = \[[\s\S]*?\] as const;/,
    `const CREDIT_PACKAGES = [
  { id: "credits_300", credits: 100, unitAmountBrl: 1990, name: "Pacote 100 Créditos", displayPrice: "R$ 19,90" },
  { id: "credits_700", credits: 200, unitAmountBrl: 3990, name: "Pacote 200 Créditos", displayPrice: "R$ 39,90" },
  { id: "credits_1500", credits: 500, unitAmountBrl: 6990, name: "Pacote 500 Créditos", displayPrice: "R$ 69,90" },
] as const;`,
  )
  .replace(
    /const CREATIVE_PACKAGES = \[[\s\S]*?\] as const;/,
    `const CREATIVE_PACKAGES = [
  { id: "creative_20", creativeCredits: 100, unitAmountBrl: 3990, name: "Pacote 10 Imagens Premium", displayPrice: "R$ 39,90" },
  { id: "creative_35", creativeCredits: 200, unitAmountBrl: 6990, name: "Pacote 20 Imagens Premium", displayPrice: "R$ 69,90" },
  { id: "creative_50", creativeCredits: 300, unitAmountBrl: 9990, name: "Pacote 30 Imagens Premium", displayPrice: "R$ 99,90" },
] as const;`,
  )
  .replace(/planKey: "pro", name: "START",([\s\S]*?)credits: (?:20|200),/,
    'planKey: "pro", name: "START",$1credits: 200,')
  .replace(/planKey: "business", name: "PREMIUM",([\s\S]*?)credits: (?:20|500),/,
    'planKey: "business", name: "PREMIUM",$1credits: 500,')
  .replace(/planKey: "agency", name: "PRO",([\s\S]*?)credits: (?:20|1000),/,
    'planKey: "agency", name: "PRO",$1credits: 1000,')
  .replaceAll('"20 créditos gerais + 40 de imagem"', '"Créditos gerais conforme o plano"');

const reconcileStart = route.indexOf('router.post(\n  "/stripe/reconcile-latest"');
const reconcileEnd = route.indexOf('router.post(\n  "/stripe/reconcile-session"', reconcileStart);
if (reconcileStart >= 0 && reconcileEnd > reconcileStart) {
  let block = route.slice(reconcileStart, reconcileEnd);

  block = block
    .replace(/credits:\s*(?:20|planCredits),/g, `credits: ${planAllowanceExpression},`)
    .replace(/if \(balanceBefore !== (?:20|planCredits)\)/g, `if (balanceBefore !== (${planAllowanceExpression}))`)
    .replace(/amount:\s*(?:20|planCredits) - balanceBefore,/g, `amount: (${planAllowanceExpression}) - balanceBefore,`)
    .replace(/balanceAfter:\s*(?:20|planCredits),/g, `balanceAfter: ${planAllowanceExpression},`)
    .replace(/\n\s*const planCredits\s*=\s*[^;]+;/g, "");

  route = route.slice(0, reconcileStart) + block + route.slice(reconcileEnd);
}

for (const marker of [
  'credits: 100, unitAmountBrl: 1990, name: "Pacote 100 Créditos"',
  'credits: 200, unitAmountBrl: 3990, name: "Pacote 200 Créditos"',
  'credits: 500, unitAmountBrl: 6990, name: "Pacote 500 Créditos"',
  'creativeCredits: 100, unitAmountBrl: 3990, name: "Pacote 10 Imagens Premium"',
  'creativeCredits: 200, unitAmountBrl: 6990, name: "Pacote 20 Imagens Premium"',
  'creativeCredits: 300, unitAmountBrl: 9990, name: "Pacote 30 Imagens Premium"',
  'planKey: "pro", name: "START"',
  'planKey: "business", name: "PREMIUM"',
  'planKey: "agency", name: "PRO"',
]) {
  if (!route.includes(marker)) throw new Error(`Commercial catalog marker missing: ${marker}`);
}

write(stripeRoutePath, route);
console.log("Commercial catalog consolidated with official package prices and plan allowances.");
