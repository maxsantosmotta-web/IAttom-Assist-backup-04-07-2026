import fs from "node:fs";

const stripeRoutePath = new URL("../src/routes/stripe.ts", import.meta.url);
const webhookPath = new URL("../src/lib/webhookHandlers.ts", import.meta.url);

let route = fs.readFileSync(stripeRoutePath, "utf8");
let webhook = fs.readFileSync(webhookPath, "utf8");

const planCreditsExpression = 'planKey === "pro" ? 200 : planKey === "business" ? 500 : 1000';

route = route
  .replaceAll('"20 créditos gerais + 40 de imagem"', '"Créditos gerais conforme o plano"')
  .replaceAll("creativeCredits: 40,", "creativeCredits: 0,")
  .replaceAll("creativeCredits: 40", "creativeCredits: 0")
  .replace(/credits:\s*20,/g, `credits: ${planCreditsExpression},`)
  .replace(/if \(balanceBefore !== 20\)/g, `if (balanceBefore !== (${planCreditsExpression}))`)
  .replace(/amount:\s*20 - balanceBefore,/g, `amount: (${planCreditsExpression}) - balanceBefore,`)
  .replace(/balanceAfter:\s*20,/g, `balanceAfter: ${planCreditsExpression},`);

webhook = webhook
  .replace(
    /const PLAN_CREDITS: Record<string, number> = \{[\s\S]*?\};/,
    `const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 200,
  business: 500,
  agency: 1000,
};`,
  )
  .replace(
    /const PLAN_CREATIVE_CREDITS: Record<string, number> = \{[\s\S]*?\};/,
    `const PLAN_CREATIVE_CREDITS: Record<string, number> = {
  free: 0,
  pro: 0,
  business: 0,
  agency: 0,
};`,
  );

for (const forbidden of [
  "20 créditos gerais + 40 de imagem",
  "creativeCredits: 40",
]) {
  if (route.includes(forbidden) || webhook.includes(forbidden)) {
    throw new Error(`Obsolete plan allowance still present: ${forbidden}`);
  }
}

for (const required of [
  'pro: 200',
  'business: 500',
  'agency: 1000',
]) {
  if (!webhook.includes(required)) {
    throw new Error(`Required plan credit allowance missing: ${required}`);
  }
}

for (const required of [
  'pro: 0',
  'business: 0',
  'agency: 0',
]) {
  if (!webhook.includes(required)) {
    throw new Error(`Plan image allowance was not removed: ${required}`);
  }
}

fs.writeFileSync(stripeRoutePath, route);
fs.writeFileSync(webhookPath, webhook);

console.log("Obsolete 20+40 plan test allowances removed; plans grant only general credits and image balance remains separate.");
