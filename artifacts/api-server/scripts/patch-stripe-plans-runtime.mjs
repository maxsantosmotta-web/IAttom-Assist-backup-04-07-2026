import fs from "node:fs";

const stripeRoutePath = new URL("../src/routes/stripe.ts", import.meta.url);
let source = fs.readFileSync(stripeRoutePath, "utf8");

const start = source.indexOf('router.get("/stripe/plans"');
const end = source.indexOf('router.get(\n  "/stripe/subscription"', start);
if (start === -1 || end === -1) {
  throw new Error("Stripe plans route markers not found");
}

const replacement = `const PLAN_PRICE_IDS = {
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
} as const;

const ALLOWED_PLAN_PRICE_IDS = new Map<string, string>([
  [PLAN_PRICE_IDS.pro.monthly, "pro"],
  [PLAN_PRICE_IDS.pro.annual, "pro"],
  [PLAN_PRICE_IDS.business.monthly, "business"],
  [PLAN_PRICE_IDS.business.annual, "business"],
  [PLAN_PRICE_IDS.agency.monthly, "agency"],
  [PLAN_PRICE_IDS.agency.annual, "agency"],
]);

router.get("/stripe/diagnostics", async (_req: Request, res: Response) => {
  res.json({
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    appPublicUrlConfigured: Boolean(process.env.APP_PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN),
    source: "temporary_test_price_ids",
    plans: { start: true, premium: true, pro: true },
    error: null,
  });
});

router.get("/stripe/plans", async (_req: Request, res: Response) => {
  const plans = [
    {
      planKey: "free", name: "Gratuito", description: "Acesso inicial à plataforma",
      credits: 0, amount: 0, currency: "brl", interval: "month", priceId: null,
      features: ["Acesso inicial", "Recursos limitados", "Suporte padrão"],
    },
    {
      planKey: "pro", name: "START", description: "Plano de entrada do IAttom Assist",
      credits: 20, amount: 50, currency: "brl", interval: "month", priceId: PLAN_PRICE_IDS.pro.monthly,
      features: ["20 créditos gerais + 40 de imagem", "Acesso aos módulos essenciais", "Projetos ilimitados", "Histórico completo", "Suporte padrão"],
    },
    {
      planKey: "business", name: "PREMIUM", description: "Mais recursos, créditos e capacidade operacional",
      credits: 20, amount: 50, currency: "brl", interval: "month", priceId: PLAN_PRICE_IDS.business.monthly,
      features: ["20 créditos gerais + 40 de imagem", "Acesso a todos os módulos", "Análises avançadas", "Automações premium", "Suporte prioritário"],
    },
    {
      planKey: "agency", name: "PRO", description: "Maior volume, recursos avançados e operação completa",
      credits: 20, amount: 50, currency: "brl", interval: "month", priceId: PLAN_PRICE_IDS.agency.monthly,
      features: ["20 créditos gerais + 40 de imagem", "Acesso total da plataforma", "Recursos avançados", "Prioridade máxima", "Suporte dedicado"],
    },
  ];

  res.setHeader("Cache-Control", "no-store");
  res.json(plans);
});

`;

source = source.slice(0, start) + replacement + source.slice(end);

const checkoutNeedle = "    const { priceId, planKey } = parsed.data;\n\n    try {";
const checkoutReplacement = `    const { priceId, planKey } = parsed.data;

    if (priceId !== "free") {
      const expectedPlanKey = ALLOWED_PLAN_PRICE_IDS.get(priceId);
      if (!expectedPlanKey || expectedPlanKey !== planKey) {
        return res.status(400).json({ error: "Plano ou preço inválido" });
      }
    }

    try {`;

if (source.includes(checkoutNeedle)) {
  source = source.replace(checkoutNeedle, checkoutReplacement);
} else if (!source.includes("ALLOWED_PLAN_PRICE_IDS.get(priceId)")) {
  throw new Error("Stripe checkout validation marker not found");
}

if (!source.includes('getUncachableStripeClient')) {
  source = source.replace(
    'import { reconcileCheckoutSession } from "../lib/webhookHandlers.js";',
    'import { reconcileCheckoutSession } from "../lib/webhookHandlers.js";\nimport { getUncachableStripeClient } from "../lib/stripeClient.js";',
  );
}

const latestMarker = 'router.post(\n  "/stripe/reconcile-latest"';
if (!source.includes(latestMarker)) {
  const reconcileMarker = 'router.post(\n  "/stripe/reconcile-session",';
  const reconcileIndex = source.indexOf(reconcileMarker);
  if (reconcileIndex === -1) throw new Error("Reconcile session route marker not found");

  const latestRoute = `router.post(
  "/stripe/reconcile-latest",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
    if (!user?.stripeCustomerId) {
      return res.status(404).json({ error: "Cliente Stripe não encontrado" });
    }

    try {
      const stripe = await getUncachableStripeClient();
      const sessions = await stripe.checkout.sessions.list({
        customer: user.stripeCustomerId,
        limit: 10,
      });
      const latest = sessions.data.find(
        (session) => session.mode === "subscription" && session.status === "complete" && Boolean(session.subscription),
      );
      if (!latest) {
        return res.status(404).json({ error: "Assinatura concluída não encontrada" });
      }
      const result = await reconcileCheckoutSession(latest.id);
      return res.json(result);
    } catch (err) {
      req.log.error({ err }, "Latest checkout reconciliation failed");
      return res.status(500).json({ error: "Falha ao reconciliar a assinatura" });
    }
  },
);

`;
  source = source.slice(0, reconcileIndex) + latestRoute + source.slice(reconcileIndex);
}

fs.writeFileSync(stripeRoutePath, source);

const webhookPath = new URL("../src/lib/webhookHandlers.ts", import.meta.url);
let webhook = fs.readFileSync(webhookPath, "utf8");
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
fs.writeFileSync(webhookPath, webhook);

const stripeServicePath = new URL("../src/lib/stripeService.ts", import.meta.url);
let stripeService = fs.readFileSync(stripeServicePath, "utf8");
stripeService = stripeService
  .replace('success_url: `${billingUrl}?payment=success`,', 'success_url: `${billingUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,')
  .replaceAll('success_url: `${billingUrl}?payment=credits_success`,', 'success_url: `${billingUrl}?payment=credits_success&session_id={CHECKOUT_SESSION_ID}`,')
  .replace('success_url: `${billingUrl}?payment=video_success`,', 'success_url: `${billingUrl}?payment=video_success&session_id={CHECKOUT_SESSION_ID}`,');
fs.writeFileSync(stripeServicePath, stripeService);

console.log("Temporary Stripe plans, checkout reconciliation, and 20+40 test credits applied");
