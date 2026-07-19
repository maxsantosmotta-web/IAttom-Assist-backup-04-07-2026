import fs from "node:fs";

const path = new URL("../src/routes/stripe.ts", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const start = source.indexOf('router.get("/stripe/plans"');
const end = source.indexOf('router.get(\n  "/stripe/subscription"', start);
if (start === -1 || end === -1) {
  throw new Error("Stripe plans route markers not found");
}

const replacement = `const PLAN_PRICE_IDS = {
  pro: {
    monthly: "price_1TunJ2AYtu5nLhAZPd1Ai0hD",
    annual: "price_1TunNxAYtu5nLhAZw0frXi2Z",
  },
  business: {
    monthly: "price_1TunQhAYtu5nLhAZu5QXWW31",
    annual: "price_1TunROAYtu5nLhAZqhKUuslz",
  },
  agency: {
    monthly: "price_1TunTDAYtu5nLhAZDfzTn8Cm",
    annual: "price_1TunTgAYtu5nLhAZ5nRh52J8",
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
    source: "official_price_ids",
    plans: { start: true, premium: true, pro: true },
    error: null,
  });
});

router.get("/stripe/plans", async (_req: Request, res: Response) => {
  const plans = [
    {
      planKey: "free", name: "Gratuito", description: "Acesso inicial à plataforma",
      credits: PLAN_CREDITS.free, amount: PLAN_PRICES.free, currency: "brl", interval: "month", priceId: null,
      features: ["Acesso inicial", "Recursos limitados", "Suporte padrão"],
    },
    {
      planKey: "pro", name: "START", description: "Plano de entrada do IAttom Assist",
      credits: PLAN_CREDITS.pro, amount: 6900, currency: "brl", interval: "month", priceId: PLAN_PRICE_IDS.pro.monthly,
      features: ["500 créditos/mês", "Acesso aos módulos essenciais", "Projetos ilimitados", "Histórico completo", "Suporte padrão"],
    },
    {
      planKey: "business", name: "PREMIUM", description: "Mais recursos, créditos e capacidade operacional",
      credits: PLAN_CREDITS.business, amount: 15900, currency: "brl", interval: "month", priceId: PLAN_PRICE_IDS.business.monthly,
      features: ["2.000 créditos/mês", "Acesso a todos os módulos", "Análises avançadas", "Automações premium", "Suporte prioritário"],
    },
    {
      planKey: "agency", name: "PRO", description: "Maior volume, recursos avançados e operação completa",
      credits: PLAN_CREDITS.agency, amount: 29900, currency: "brl", interval: "month", priceId: PLAN_PRICE_IDS.agency.monthly,
      features: ["10.000 créditos/mês", "Acesso total da plataforma", "Recursos avançados", "Prioridade máxima", "Suporte dedicado"],
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

fs.writeFileSync(path, source);
console.log("Official IAttom Stripe plan prices applied");
