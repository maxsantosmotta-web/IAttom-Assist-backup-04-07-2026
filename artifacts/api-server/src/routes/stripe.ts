import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middlewares/requireAuth.js";
import {
  createCheckoutSession,
  createBillingPortalSession,
  createCreditPurchaseCheckoutSession,
  createFreeStartCheckoutSession,
} from "../lib/stripeService.js";
import {
  getSubscriptionByCustomerId,
  getPlansWithPrices,
} from "../lib/stripeStorage.js";

const router: IRouter = Router();

const CREDIT_PACKAGES = [
  { id: "credits_100",  credits: 100,  unitAmountBrl: 1990,  name: "Pacote 100 Créditos",   displayPrice: "R$ 19,90"  },
  { id: "credits_300",  credits: 300,  unitAmountBrl: 4990,  name: "Pacote 300 Créditos",   displayPrice: "R$ 49,90"  },
  { id: "credits_1000", credits: 1000, unitAmountBrl: 12990, name: "Pacote 1.000 Créditos", displayPrice: "R$ 129,90" },
  { id: "credits_5000", credits: 5000, unitAmountBrl: 49790, name: "Pacote 5.000 Créditos", displayPrice: "R$ 497,90" },
] as const;

router.get("/stripe/credit-packages", requireAuth, (_req: Request, res: Response) => {
  res.json(CREDIT_PACKAGES);
});

const CreditCheckoutBodySchema = z.object({
  packageId: z.string().min(1),
});

router.post(
  "/stripe/credits/checkout",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = CreditCheckoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "packageId is required" });
    }

    const { packageId } = parsed.data;
    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return res.status(400).json({ error: "Pacote inválido" });
    }

    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

    try {
      const url = await createCreditPurchaseCheckoutSession(
        clerkUserId,
        pkg.id,
        pkg.credits,
        pkg.unitAmountBrl,
        pkg.name,
      );
      return res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("not configured")) {
        req.log.warn("Credit checkout attempted but billing is not configured");
        return res.status(503).json({ error: "Faturamento não disponível neste ambiente." });
      }
      req.log.error({ err }, "Failed to create credit purchase checkout session");
      return res.status(500).json({ error: "Falha ao iniciar o checkout" });
    }
  },
);

const PLAN_CREDITS: Record<string, number> = {
  free: 50,
  pro: 500,
  business: 2000,
  agency: 10000,
};

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 7900,
  business: 19900,
  agency: 49900,
};

router.get("/stripe/plans", async (_req: Request, res: Response) => {
  const stripeRows = await getPlansWithPrices();

  const priceIdMap: Record<string, string> = {};
  for (const { product, prices } of stripeRows) {
    const planKey = product.metadata?.plan;
    if (!planKey) continue;
    const monthly = prices.find((p) => p.recurring?.interval === "month");
    if (monthly) priceIdMap[planKey] = monthly.id;
  }

  const plans = [
    {
      planKey: "free",
      name: "Gratuito",
      description: "Comece com as ferramentas essenciais de IA para negócios",
      credits: PLAN_CREDITS.free,
      amount: PLAN_PRICES.free,
      currency: "usd",
      interval: "month",
      priceId: priceIdMap["free"] ?? null,
      features: [
        "50 créditos/mês",
        "Acesso aos módulos essenciais",
        "Projetos limitados",
        "Histórico básico",
        "Suporte padrão",
      ],
    },
    {
      planKey: "pro",
      name: "Pro",
      description: "Para empreendedores e solopreneurs",
      credits: PLAN_CREDITS.pro,
      amount: PLAN_PRICES.pro,
      currency: "usd",
      interval: "month",
      priceId: priceIdMap["pro"] ?? null,
      features: [
        "500 créditos/mês",
        "Acesso a todos os módulos",
        "Projetos ilimitados",
        "Histórico completo",
        "Suporte prioritário",
      ],
    },
    {
      planKey: "business",
      name: "Empresarial",
      description: "Para empresas em crescimento e equipes",
      credits: PLAN_CREDITS.business,
      amount: PLAN_PRICES.business,
      currency: "usd",
      interval: "month",
      priceId: priceIdMap["business"] ?? null,
      features: [
        "2.000 créditos/mês",
        "Acesso a todos os módulos",
        "Espaço de equipe",
        "Análises avançadas",
        "Automações premium",
        "Suporte prioritário",
      ],
    },
    {
      planKey: "agency",
      name: "Agência",
      description: "Para agências e usuários avançados",
      credits: PLAN_CREDITS.agency,
      amount: PLAN_PRICES.agency,
      currency: "usd",
      interval: "month",
      priceId: priceIdMap["agency"] ?? null,
      features: [
        "10.000 créditos/mês",
        "Acesso total da plataforma",
        "Espaços multiclientes",
        "Relatórios white-label",
        "Prioridade máxima",
        "Suporte dedicado",
      ],
    },
  ];

  res.json(plans);
});

router.get(
  "/stripe/subscription",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (!user?.stripeCustomerId) {
      return res.json({
        hasSubscription: false,
        status: null,
        planKey: user?.plan ?? "free",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
    }

    const subscription = await getSubscriptionByCustomerId(
      user.stripeCustomerId,
    );

    if (!subscription) {
      return res.json({
        hasSubscription: false,
        status: null,
        planKey: user.plan,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: null,
      });
    }

    const isActive =
      subscription.status === "active" || subscription.status === "trialing";

    return res.json({
      hasSubscription: isActive,
      status: subscription.status,
      planKey: user.plan,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
    });
  },
);

router.post(
  "/stripe/start/checkout",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
    try {
      const url = await createFreeStartCheckoutSession(clerkUserId);
      return res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("not configured")) {
        req.log.warn("START checkout attempted but billing is not configured");
        return res.status(503).json({ error: "Faturamento não disponível neste ambiente." });
      }
      req.log.error({ err }, "Failed to create START checkout session");
      return res.status(500).json({ error: "Falha ao iniciar o checkout" });
    }
  },
);

const CheckoutBodySchema = z.object({
  priceId: z.string().min(1),
  planKey: z.string().min(1),
});

router.post(
  "/stripe/checkout",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = CheckoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "priceId and planKey are required" });
    }

    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
    const { priceId, planKey } = parsed.data;

    try {
      /* free/START plan has no Stripe priceId — use dedicated $0 checkout */
      if (priceId === "free" || planKey === "free") {
        const url = await createFreeStartCheckoutSession(clerkUserId);
        return res.json({ url });
      }
      const url = await createCheckoutSession(clerkUserId, priceId, planKey);
      return res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("not configured")) {
        req.log.warn("Stripe checkout attempted but billing is not configured");
        return res.status(503).json({ error: "Billing is not available in this environment." });
      }
      req.log.error({ err }, "Failed to create checkout session");
      return res.status(500).json({ error: "Failed to create checkout session" });
    }
  },
);

router.post(
  "/stripe/portal",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

    try {
      const url = await createBillingPortalSession(clerkUserId);
      return res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("not configured")) {
        req.log.warn("Stripe portal attempted but billing is not configured");
        return res.status(503).json({ error: "Billing is not available in this environment." });
      }
      req.log.error({ err }, "Failed to create billing portal session");
      return res.status(500).json({ error: "Failed to create billing portal session" });
    }
  },
);

export default router;
