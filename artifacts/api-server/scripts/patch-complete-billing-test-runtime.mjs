import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, source) { fs.writeFileSync(path, source); }

const creditsPath = new URL("../src/lib/credits.ts", import.meta.url);
let credits = read(creditsPath);
credits = credits
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
write(creditsPath, credits);

const stripeRoutePath = new URL("../src/routes/stripe.ts", import.meta.url);
let routes = read(stripeRoutePath);
routes = routes
  .replace(/const CREDIT_PACKAGES = \[[\s\S]*?\] as const;/, `const CREDIT_PACKAGES = [
  { id: "credits_300", credits: 300, unitAmountBrl: 50, name: "Pacote 300 Créditos", displayPrice: "R$ 0,50" },
  { id: "credits_700", credits: 700, unitAmountBrl: 55, name: "Pacote 700 Créditos", displayPrice: "R$ 0,55" },
  { id: "credits_1500", credits: 1500, unitAmountBrl: 60, name: "Pacote 1.500 Créditos", displayPrice: "R$ 0,60" },
] as const;`)
  .replace(/const CREATIVE_PACKAGES = \[[\s\S]*?\] as const;/, `const CREATIVE_PACKAGES = [
  { id: "creative_20", creativeCredits: 200, unitAmountBrl: 50, name: "Pacote 20 Imagens", displayPrice: "R$ 0,50" },
  { id: "creative_35", creativeCredits: 350, unitAmountBrl: 55, name: "Pacote 35 Imagens", displayPrice: "R$ 0,55" },
  { id: "creative_50", creativeCredits: 500, unitAmountBrl: 60, name: "Pacote 50 Imagens", displayPrice: "R$ 0,60" },
] as const;`)
  .replace(/pkg\.priceId,/g, "pkg.unitAmountBrl,");
write(stripeRoutePath, routes);

const stripeServicePath = new URL("../src/lib/stripeService.ts", import.meta.url);
let service = read(stripeServicePath);

function rewriteOneTimeCheckout(functionName, lineItemsSource) {
  const start = service.indexOf(`export async function ${functionName}`);
  if (start === -1) throw new Error(`${functionName} not found`);
  const next = service.indexOf("export async function ", start + 1);
  const end = next === -1 ? service.length : next;
  let block = service.slice(start, end);

  block = block
    .replace(/\n\s*const catalogPriceId = [^\n]+;\n\s*if \(!catalogPriceId\) throw new Error\("Invalid Stripe catalog package"\);\n/, "\n")
    .replaceAll("  priceId: string,\n  packageName: string,", "  unitAmountBrl: number,\n  packageName: string,");

  const catalogLineItems = "    line_items: [{ price: catalogPriceId, quantity: 1 }],";
  const legacyPriceLineItems = "    line_items: [{ price: priceId, quantity: 1 }],";
  if (block.includes(catalogLineItems)) {
    block = block.replace(catalogLineItems, lineItemsSource);
  } else if (block.includes(legacyPriceLineItems)) {
    block = block.replace(legacyPriceLineItems, lineItemsSource);
  } else if (!block.includes("unit_amount: unitAmountBrl")) {
    throw new Error(`${functionName} temporary line_items were not applied`);
  }

  service = service.slice(0, start) + block + service.slice(end);
}

rewriteOneTimeCheckout(
  "createCreditPurchaseCheckoutSession",
  `    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: unitAmountBrl,
          product_data: {
            name: packageName,
            description: \`\${credits.toLocaleString("pt-BR")} créditos — compra avulsa (não expiram)\`,
          },
        },
        quantity: 1,
      },
    ],`,
);

rewriteOneTimeCheckout(
  "createCreativePurchaseCheckoutSession",
  `    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: unitAmountBrl,
          product_data: {
            name: packageName,
            description: \`\${Math.floor(creativeCredits / 10)} imagens — compra avulsa (não expiram)\`,
          },
        },
        quantity: 1,
      },
    ],`,
);

service = service
  .replace(/const APP_ORIGIN =[\s\S]*?const BASE_PATH =/, `const APP_ORIGIN = "https://www.iattomassist.com.br";\n\nconst BASE_PATH =`)
  .replaceAll('success_url: `${billingUrl}?payment=success`,', 'success_url: `${billingUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,')
  .replaceAll('success_url: `${billingUrl}?payment=credits_success`,', 'success_url: `${billingUrl}?payment=credits_success&session_id={CHECKOUT_SESSION_ID}`,')
  .replaceAll('success_url: `${billingUrl}?payment=video_success`,', 'success_url: `${billingUrl}?payment=video_success&session_id={CHECKOUT_SESSION_ID}`,');
write(stripeServicePath, service);

const creditsRoutePath = new URL("../src/routes/credits.ts", import.meta.url);
let creditsRoute = read(creditsRoutePath);
if (!creditsRoute.includes('getUncachableStripeClient')) {
  creditsRoute = creditsRoute.replace(
    'import { getOrCreateUserFromClerk } from "../lib/userSync";',
    'import { getOrCreateUserFromClerk } from "../lib/userSync";\nimport { getUncachableStripeClient } from "../lib/stripeClient";\nimport { reconcileCheckoutSession } from "../lib/webhookHandlers";',
  );
}

const balanceAnchor = `  const plan = user.plan as keyof typeof PLAN_CREDITS;`;
if (!creditsRoute.includes("recover pending paid package sessions")) {
  const recoveryBlock = `  // Best-effort recovery for paid package sessions when Stripe could not return to the app.\n  // Reconciliation is idempotent through stripeSessionId, so repeated balance reads never duplicate credits.\n  if (user.stripeCustomerId) {\n    try {\n      const stripe = await getUncachableStripeClient();\n      const sessions = await stripe.checkout.sessions.list({ customer: user.stripeCustomerId, limit: 10 });\n      const recoverable = sessions.data.filter((session) => {\n        const type = session.metadata?.type;\n        return session.mode === "payment"\n          && session.payment_status === "paid"\n          && session.metadata?.clerkUserId === clerkUserId\n          && ["credit_pack", "credit_purchase", "creative_pack"].includes(type ?? "");\n      });\n      for (const session of recoverable) {\n        await reconcileCheckoutSession(session.id, clerkUserId);\n      }\n    } catch (recoveryError) {\n      req.log.warn({ recoveryError, clerkUserId }, "credits/balance: paid package recovery failed");\n    }\n  }\n\n  // Always reread the user after reconciliation/webhook activity so the response never exposes a stale balance.\n  const [latestUser] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));\n  if (latestUser) user = latestUser;\n\n`;
  if (!creditsRoute.includes(balanceAnchor)) throw new Error("credits balance anchor not found");
  creditsRoute = creditsRoute.replace(balanceAnchor, recoveryBlock + balanceAnchor);
} else {
  creditsRoute = creditsRoute
    .replaceAll("await reconcileCheckoutSession(session.id);", "await reconcileCheckoutSession(session.id, clerkUserId);")
    .replace(
      balanceAnchor,
      `  const [latestUser] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));\n  if (latestUser) user = latestUser;\n\n${balanceAnchor}`,
    );
}
write(creditsRoutePath, creditsRoute);

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

// Deployment trigger only: no runtime behavior change.
console.log("Complete billing test runtime applied: package recovery is user-bound and balance reads are refreshed after reconciliation.");
