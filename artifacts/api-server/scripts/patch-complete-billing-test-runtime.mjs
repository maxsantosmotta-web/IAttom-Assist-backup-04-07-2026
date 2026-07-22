import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, source) { fs.writeFileSync(path, source); }

const stripeRoutePath = new URL("../src/routes/stripe.ts", import.meta.url);
let routes = read(stripeRoutePath);

routes = routes
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
  .replace(/pkg\.unitAmountBrl,/g, "pkg.priceId,");

write(stripeRoutePath, routes);

const stripeServicePath = new URL("../src/lib/stripeService.ts", import.meta.url);
let service = read(stripeServicePath);

service = service
  .replaceAll("  unitAmountBrl: number,\n  packageName: string,", "  priceId: string,\n  packageName: string,")
  .replace(/line_items: \[\n      \{\n        price_data: \{\n          currency: "brl",\n          unit_amount: unitAmountBrl,\n          product_data: \{\n            name: packageName,\n            description: `\$\{credits\.toLocaleString\("pt-BR"\)\} créditos — compra avulsa \(não expiram\)`,\n          \},\n        \},\n        quantity: 1,\n      \},\n    \],/, "line_items: [{ price: priceId, quantity: 1 }],")
  .replace(/line_items: \[\n      \{\n        price_data: \{\n          currency: "brl",\n          unit_amount: unitAmountBrl,\n          product_data: \{\n            name: packageName,\n            description: `\$\{creativeCredits\} créditos criativos — compra avulsa \(não expiram\)`,\n          \},\n        \},\n        quantity: 1,\n      \},\n    \],/, "line_items: [{ price: priceId, quantity: 1 }],")
  .replace('success_url: `${billingUrl}?payment=success`,', 'success_url: `${billingUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,')
  .replaceAll('success_url: `${billingUrl}?payment=credits_success`,', 'success_url: `${billingUrl}?payment=credits_success&session_id={CHECKOUT_SESSION_ID}`,')
  .replace('success_url: `${billingUrl}?payment=video_success`,', 'success_url: `${billingUrl}?payment=video_success&session_id={CHECKOUT_SESSION_ID}`,');

write(stripeServicePath, service);

const webhookPath = new URL("../src/lib/webhookHandlers.ts", import.meta.url);
let webhook = read(webhookPath);
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
};`)
  .replace(
    "    const sync = await getStripeSync();\n    await sync.processWebhook(payload, signature);",
    `    try {
      const sync = await getStripeSync();
      await sync.processWebhook(payload, signature);
    } catch (syncError) {
      logger.warn({ syncError }, "Stripe auxiliary sync failed; continuing IAttom billing logic");
    }`,
  );
write(webhookPath, webhook);

console.log("Complete billing test runtime applied: all plans and one-time packages use Stripe Price IDs and session reconciliation.");
