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
if (!source.includes('creditsTransactions')) {
  source = source.replace(
    'import { db, users } from "@workspace/db";',
    'import { db, users, creditsTransactions } from "@workspace/db";',
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
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    try {
      const stripe = await getUncachableStripeClient();
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        const customers = await stripe.customers.list({ email: user.email, limit: 20 });
        const customer = customers.data.find((item) => item.metadata?.clerkUserId === clerkUserId) ?? customers.data[0];
        if (!customer) {
          return res.status(404).json({ error: "Cliente Stripe não encontrado" });
        }
        customerId = customer.id;
        await db.update(users)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(users.clerkId, clerkUserId));
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 20,
      });
      const active = subscriptions.data
        .filter((subscription) => subscription.status === "active" || subscription.status === "trialing")
        .sort((a, b) => b.created - a.created)[0];

      if (!active) {
        return res.status(404).json({ error: "Assinatura ativa não encontrada" });
      }

      const firstItem = active.items.data[0];
      let planKey = active.metadata?.planKey || (firstItem ? ALLOWED_PLAN_PRICE_IDS.get(firstItem.price.id) : undefined);

      if (!planKey && firstItem) {
        const productId = typeof firstItem.price.product === "string"
          ? firstItem.price.product
          : firstItem.price.product.id;
        const product = await stripe.products.retrieve(productId);
        planKey = product.metadata?.plan;
      }

      if (planKey !== "pro" && planKey !== "business" && planKey !== "agency") {
        return res.status(422).json({ error: "Plano da assinatura não identificado" });
      }

      const balanceBefore = user.credits ?? 0;
      await db.update(users)
        .set({
          plan: planKey,
          credits: 20,
          creativeCredits: 40,
          stripeCustomerId: customerId,
          stripeSubscriptionId: active.id,
          stripeSubscriptionStatus: active.status,
          planSelected: true,
          helpMessagesUsed: 0,
          helpUsedResetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, clerkUserId));

      if (balanceBefore !== 20) {
        await db.insert(creditsTransactions).values({
          clerkUserId,
          amount: 20 - balanceBefore,
          type: "credit",
          description: "Assinatura paga reconciliada — créditos do plano ativados",
          balanceBefore,
          balanceAfter: 20,
        });
      }

      req.log.info(
        { clerkUserId, customerId, subscriptionId: active.id, planKey },
        "Active Stripe subscription reconciled directly",
      );
      return res.json({
        ok: true,
        plan: planKey,
        credits: 20,
        creativeCredits: 40,
        subscriptionId: active.id,
      });
    } catch (err) {
      req.log.error({ err, clerkUserId }, "Latest checkout reconciliation failed");
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
fs.writeFileSync(webhookPath, webhook);

const stripeServicePath = new URL("../src/lib/stripeService.ts", import.meta.url);
let stripeService = fs.readFileSync(stripeServicePath, "utf8");
stripeService = stripeService
  .replace('success_url: `${billingUrl}?payment=success`,', 'success_url: `${billingUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,')
  .replaceAll('success_url: `${billingUrl}?payment=credits_success`,', 'success_url: `${billingUrl}?payment=credits_success&session_id={CHECKOUT_SESSION_ID}`,')
  .replace('success_url: `${billingUrl}?payment=video_success`,', 'success_url: `${billingUrl}?payment=video_success&session_id={CHECKOUT_SESSION_ID}`,');
fs.writeFileSync(stripeServicePath, stripeService);

const authRoutesPath = new URL("../src/routes/authRoutes.ts", import.meta.url);
let authRoutes = fs.readFileSync(authRoutesPath, "utf8");
if (!authRoutes.includes('getUncachableStripeClient')) {
  authRoutes = authRoutes.replace(
    'import { sendOtpEmail } from "../lib/email";',
    'import { sendOtpEmail } from "../lib/email";\nimport { getUncachableStripeClient } from "../lib/stripeClient.js";',
  );
}
const oldProtection = `  const protectedPaidStatuses = new Set(["active", "trialing", "past_due"]);
  const hasProtectedPaidSubscription =
    user.plan !== "free" &&
    !!user.stripeSubscriptionId &&
    !!user.stripeSubscriptionStatus &&
    protectedPaidStatuses.has(user.stripeSubscriptionStatus);

  if (hasProtectedPaidSubscription) {
    res.status(409).json({ error: "Active paid subscription cannot be replaced by FREE." });
    return;
  }`;
const newProtection = `  const protectedPaidStatuses = new Set(["active", "trialing", "past_due"]);
  const hasProtectedPaidSubscription =
    !!user.stripeSubscriptionId &&
    !!user.stripeSubscriptionStatus &&
    protectedPaidStatuses.has(user.stripeSubscriptionStatus);

  if (hasProtectedPaidSubscription) {
    res.status(409).json({ error: "Assinatura paga ativa não pode ser substituída pelo FREE." });
    return;
  }

  if (user.stripeCustomerId) {
    try {
      const stripe = await getUncachableStripeClient();
      const subscriptions = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: "all", limit: 10 });
      const hasActiveStripeSubscription = subscriptions.data.some(
        (subscription) => subscription.status === "active" || subscription.status === "trialing" || subscription.status === "past_due",
      );
      if (hasActiveStripeSubscription) {
        res.status(409).json({ error: "Existe uma assinatura paga ativa no Stripe. Atualize o faturamento para sincronizar." });
        return;
      }
    } catch (err) {
      req.log.error({ err, clerkUserId }, "Could not verify Stripe subscription before FREE selection");
      res.status(503).json({ error: "Não foi possível verificar sua assinatura. Tente novamente." });
      return;
    }
  }`;
if (authRoutes.includes(oldProtection)) {
  authRoutes = authRoutes.replace(oldProtection, newProtection);
} else if (!authRoutes.includes("hasActiveStripeSubscription")) {
  throw new Error("FREE plan protection marker not found");
}
fs.writeFileSync(authRoutesPath, authRoutes);

console.log("Stripe plans, direct reconciliation, paid-plan protection, and 20+40 test credits applied");
