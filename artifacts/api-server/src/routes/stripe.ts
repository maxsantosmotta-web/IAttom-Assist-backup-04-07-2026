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
} from "../lib/stripeService.js";
import {
  getSubscriptionByCustomerId,
  getPlansWithPrices,
} from "../lib/stripeStorage.js";

const router: IRouter = Router();

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
