import fs from "node:fs";

function read(url) {
  return fs.readFileSync(url, "utf8");
}
function write(url, value) {
  fs.writeFileSync(url, value);
}

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
  { id: "credits_300", credits: 100, unitAmountBrl: 50, name: "Pacote 100 Créditos", displayPrice: "R$ 0,50" },
  { id: "credits_700", credits: 200, unitAmountBrl: 55, name: "Pacote 200 Créditos", displayPrice: "R$ 0,55" },
  { id: "credits_1500", credits: 500, unitAmountBrl: 60, name: "Pacote 500 Créditos", displayPrice: "R$ 0,60" },
] as const;`,
  )
  .replace(
    /const CREATIVE_PACKAGES = \[[\s\S]*?\] as const;/,
    `const CREATIVE_PACKAGES = [
  { id: "creative_20", creativeCredits: 100, unitAmountBrl: 50, name: "Pacote 10 Imagens Premium", displayPrice: "R$ 0,50" },
  { id: "creative_35", creativeCredits: 200, unitAmountBrl: 55, name: "Pacote 20 Imagens Premium", displayPrice: "R$ 0,55" },
  { id: "creative_50", creativeCredits: 300, unitAmountBrl: 60, name: "Pacote 30 Imagens Premium", displayPrice: "R$ 0,60" },
] as const;`,
  )
  .replace(/planKey: "pro", name: "START",([\s\S]*?)credits: 20,/,
    'planKey: "pro", name: "START",$1credits: 200,')
  .replace(/planKey: "business", name: "PREMIUM",([\s\S]*?)credits: 20,/,
    'planKey: "business", name: "PREMIUM",$1credits: 500,')
  .replace(/planKey: "agency", name: "PRO",([\s\S]*?)credits: 20,/,
    'planKey: "agency", name: "PRO",$1credits: 1000,')
  .replaceAll('"20 créditos gerais + 40 de imagem"', '"Créditos gerais conforme o plano"');

const reconcileStart = route.indexOf('router.post(\n  "/stripe/reconcile-latest"');
const reconcileEnd = route.indexOf('router.post(\n  "/stripe/reconcile-session"', reconcileStart);
if (reconcileStart >= 0 && reconcileEnd > reconcileStart) {
  let block = route.slice(reconcileStart, reconcileEnd);
  const planValidation = `      if (planKey !== "pro" && planKey !== "business" && planKey !== "agency") {
        return res.status(422).json({ error: "Plano da assinatura não identificado" });
      }`;
  const allowanceLine = '      const planCredits = planKey === "pro" ? 200 : planKey === "business" ? 500 : 1000;';

  block = block.replace(
    /\n\s*const planCredits\s*=\s*planKey\s*===\s*"pro"\s*\?\s*\d+\s*:\s*planKey\s*===\s*"business"\s*\?\s*\d+\s*:\s*\d+\s*;/,
    `\n\n${allowanceLine}`,
  );

  if (!/const planCredits\s*=/.test(block)) {
    if (!block.includes(planValidation)) {
      throw new Error("Plan validation block not found before allowance insertion");
    }
    block = block.replace(planValidation, `${planValidation}\n\n${allowanceLine}`);
  }

  block = block
    .replace("          credits: 20,", "          credits: planCredits,")
    .replace("      if (balanceBefore !== 20) {", "      if (balanceBefore !== planCredits) {")
    .replace("          amount: 20 - balanceBefore,", "          amount: planCredits - balanceBefore,")
    .replace("          balanceAfter: 20,", "          balanceAfter: planCredits,")
    .replace("        credits: 20,", "        credits: planCredits,");
  route = route.slice(0, reconcileStart) + block + route.slice(reconcileEnd);
}

for (const marker of [
  'credits: 100, unitAmountBrl: 50, name: "Pacote 100 Créditos"',
  'credits: 200, unitAmountBrl: 55, name: "Pacote 200 Créditos"',
  'credits: 500, unitAmountBrl: 60, name: "Pacote 500 Créditos"',
  'creativeCredits: 100, unitAmountBrl: 50, name: "Pacote 10 Imagens Premium"',
  'creativeCredits: 200, unitAmountBrl: 55, name: "Pacote 20 Imagens Premium"',
  'creativeCredits: 300, unitAmountBrl: 60, name: "Pacote 30 Imagens Premium"',
]) {
  if (!route.includes(marker)) throw new Error(`Commercial catalog marker missing: ${marker}`);
}

if (!/const planCredits\s*=\s*planKey\s*===\s*"pro"\s*\?\s*200\s*:\s*planKey\s*===\s*"business"\s*\?\s*500\s*:\s*1000\s*;/.test(route)) {
  throw new Error("Commercial plan allowance mapping missing or incorrect");
}

write(stripeRoutePath, route);
console.log("New package quantities and plan allowances applied; temporary checkout prices and test video Price IDs remain active.");
