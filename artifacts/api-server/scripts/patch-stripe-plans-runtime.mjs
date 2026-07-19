import fs from "node:fs";

const path = new URL("../src/routes/stripe.ts", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const clientImport = 'import { getUncachableStripeClient, isStripeConfigured } from "../lib/stripeClient.js";';
if (!source.includes(clientImport)) {
  source = source.replace(
    'import { reconcileCheckoutSession } from "../lib/webhookHandlers.js";',
    'import { reconcileCheckoutSession } from "../lib/webhookHandlers.js";\n' + clientImport,
  );
}

const start = source.indexOf('router.get("/stripe/plans"');
const end = source.indexOf('router.get(\n  "/stripe/subscription"', start);
if (start === -1 || end === -1) {
  throw new Error("Stripe plans route markers not found");
}

const replacement = `const PLAN_PRICE_ENV: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO ?? process.env.STRIPE_PRICE_START,
  business: process.env.STRIPE_PRICE_BUSINESS ?? process.env.STRIPE_PRICE_PREMIUM,
  agency: process.env.STRIPE_PRICE_AGENCY ?? process.env.STRIPE_PRICE_PRO_MAX,
};

async function resolvePlanPriceIds(): Promise<{ priceIdMap: Record<string, string>; source: string; error?: string }> {
  const priceIdMap: Record<string, string> = {};
  for (const [planKey, priceId] of Object.entries(PLAN_PRICE_ENV)) {
    if (priceId?.startsWith("price_")) priceIdMap[planKey] = priceId;
  }
  if (Object.keys(priceIdMap).length >= 3) return { priceIdMap, source: "railway_env" };

  try {
    const stripeRows = await getPlansWithPrices();
    for (const { product, prices } of stripeRows) {
      const planKey = product.metadata?.plan;
      if (!planKey || priceIdMap[planKey]) continue;
      const monthly = prices.find((p) => p.active && p.recurring?.interval === "month");
      if (monthly) priceIdMap[planKey] = monthly.id;
    }
    if (Object.keys(priceIdMap).length >= 3) return { priceIdMap, source: "stripe_sync_db" };
  } catch { /* continue to live Stripe */ }

  if (!isStripeConfigured()) return { priceIdMap, source: "unconfigured", error: "STRIPE_SECRET_KEY ausente" };

  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active: true, limit: 100 });
    for (const product of products.data) {
      const planKey = product.metadata?.plan;
      if (!planKey || priceIdMap[planKey]) continue;
      const prices = await stripe.prices.list({ product: product.id, active: true, type: "recurring", limit: 20 });
      const monthly = prices.data.find((p) => p.recurring?.interval === "month");
      if (monthly) priceIdMap[planKey] = monthly.id;
    }
    return { priceIdMap, source: "stripe_api" };
  } catch (err: unknown) {
    return { priceIdMap, source: "stripe_api_error", error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

router.get("/stripe/diagnostics", async (_req: Request, res: Response) => {
  const resolved = await resolvePlanPriceIds();
  res.json({
    stripeConfigured: isStripeConfigured(),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    appPublicUrlConfigured: Boolean(process.env.APP_PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN),
    source: resolved.source,
    plans: {
      start: Boolean(resolved.priceIdMap.pro),
      premium: Boolean(resolved.priceIdMap.business),
      pro: Boolean(resolved.priceIdMap.agency),
    },
    error: resolved.error ?? null,
  });
});

router.get("/stripe/plans", async (_req: Request, res: Response) => {
  const { priceIdMap } = await resolvePlanPriceIds();

  const plans = [
    {
      planKey: "free", name: "Gratuito", description: "Comece com as ferramentas essenciais de IA para negócios",
      credits: PLAN_CREDITS.free, amount: PLAN_PRICES.free, currency: "brl", interval: "month", priceId: null,
      features: ["50 créditos/mês", "Acesso aos módulos essenciais", "Projetos limitados", "Histórico básico", "Suporte padrão"],
    },
    {
      planKey: "pro", name: "Pro", description: "Para empreendedores e solopreneurs",
      credits: PLAN_CREDITS.pro, amount: PLAN_PRICES.pro, currency: "brl", interval: "month", priceId: priceIdMap.pro ?? null,
      features: ["500 créditos/mês", "Acesso a todos os módulos", "Projetos ilimitados", "Histórico completo", "Suporte prioritário"],
    },
    {
      planKey: "business", name: "Empresarial", description: "Para empresas em crescimento e equipes",
      credits: PLAN_CREDITS.business, amount: PLAN_PRICES.business, currency: "brl", interval: "month", priceId: priceIdMap.business ?? null,
      features: ["2.000 créditos/mês", "Acesso a todos os módulos", "Espaço de equipe", "Análises avançadas", "Automações premium", "Suporte prioritário"],
    },
    {
      planKey: "agency", name: "Agência", description: "Para agências e usuários avançados",
      credits: PLAN_CREDITS.agency, amount: PLAN_PRICES.agency, currency: "brl", interval: "month", priceId: priceIdMap.agency ?? null,
      features: ["10.000 créditos/mês", "Acesso total da plataforma", "Espaços multiclientes", "Relatórios white-label", "Prioridade máxima", "Suporte dedicado"],
    },
  ];

  res.setHeader("Cache-Control", "no-store");
  res.json(plans);
});

`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
console.log("Stripe plans runtime patch applied");
