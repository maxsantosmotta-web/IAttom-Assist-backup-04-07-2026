import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middlewares/requireAuth.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import {
  createCheckoutSession,
  createBillingPortalSession,
  createCreditPurchaseCheckoutSession,
  createCreativePurchaseCheckoutSession,
  createVideoPackCheckoutSession,
  createFreeStartCheckoutSession,
} from "../lib/stripeService.js";
import {
  getSubscriptionByCustomerId,
  getPlansWithPrices,
} from "../lib/stripeStorage.js";
import { reconcileCheckoutSession } from "../lib/webhookHandlers.js";

const router: IRouter = Router();

/* ─── credit packages ─────────────────────────────────────────────────── */
const CREDIT_PACKAGES = [
  { id: "credits_300",  credits: 300,  unitAmountBrl: 3990,  name: "Pacote 300 Créditos",   displayPrice: "R$ 39,90"  },
  { id: "credits_700",  credits: 700,  unitAmountBrl: 7990,  name: "Pacote 700 Créditos",   displayPrice: "R$ 79,90"  },
  { id: "credits_1500", credits: 1500, unitAmountBrl: 14990, name: "Pacote 1.500 Créditos", displayPrice: "R$ 149,90" },
] as const;

/* ─── creative packages ───────────────────────────────────────────────── */
const CREATIVE_PACKAGES = [
  { id: "creative_20", creativeCredits: 200, unitAmountBrl: 4700, name: "Criativo 20", displayPrice: "R$ 47,00" },
  { id: "creative_35", creativeCredits: 350, unitAmountBrl: 7900, name: "Criativo 35", displayPrice: "R$ 79,00" },
  { id: "creative_50", creativeCredits: 500, unitAmountBrl: 8900, name: "Criativo 50", displayPrice: "R$ 89,00" },
] as const;

router.get("/stripe/credit-packages", requireAuth, (_req: Request, res: Response) => {
  res.json(CREDIT_PACKAGES);
});

/* ─── POST /stripe/credits/checkout — créditos avulsos ───────────────── */
const CreditCheckoutBodySchema = z.object({
  packageId: z.string().min(1),
});

router.post(
  "/stripe/credits/checkout",
  requireAuth,
  requirePlan(["pro", "business", "agency"]),
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

/* ─── POST /stripe/creatives/checkout — criativos avulsos ────────────── */
const CreativeCheckoutBodySchema = z.object({
  packageId: z.string().min(1),
});

router.post(
  "/stripe/creatives/checkout",
  requireAuth,
  requirePlan(["pro", "business", "agency"]),
  async (req: Request, res: Response) => {
    const parsed = CreativeCheckoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "packageId is required" });
    }

    const { packageId } = parsed.data;
    const pkg = CREATIVE_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return res.status(400).json({ error: "Pacote criativo inválido" });
    }

    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

    try {
      const url = await createCreativePurchaseCheckoutSession(
        clerkUserId,
        pkg.id,
        pkg.creativeCredits,
        pkg.unitAmountBrl,
        pkg.name,
      );
      return res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("not configured")) {
        req.log.warn("Creative checkout attempted but billing is not configured");
        return res.status(503).json({ error: "Faturamento não disponível neste ambiente." });
      }
      req.log.error({ err }, "Failed to create creative purchase checkout session");
      return res.status(500).json({ error: "Falha ao iniciar o checkout" });
    }
  },
);

/* ─── video packages ──────────────────────────────────────────────────── */
const VIDEO_PACKAGES = [
  { id: "video_5",  videos: 5,  unitAmountBrl: 6700,  name: "Pack 5 Vídeos"  },
  { id: "video_7",  videos: 7,  unitAmountBrl: 8900,  name: "Pack 7 Vídeos"  },
  { id: "video_10", videos: 10, unitAmountBrl: 13700, name: "Pack 10 Vídeos" },
] as const;

/* ─── POST /stripe/videos/checkout — vídeos avulsos ─────────────────── */
const VideoCheckoutBodySchema = z.object({
  packageId: z.string().min(1),
});

router.post(
  "/stripe/videos/checkout",
  requireAuth,
  requirePlan(["pro", "business", "agency"]),
  async (req: Request, res: Response) => {
    const parsed = VideoCheckoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "packageId is required" });
    }

    const { packageId } = parsed.data;
    const pkg = VIDEO_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return res.status(400).json({ error: "Pacote de vídeo inválido" });
    }

    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

    try {
      const url = await createVideoPackCheckoutSession(
        clerkUserId,
        pkg.id,
        pkg.videos,
        pkg.unitAmountBrl,
        pkg.name,
      );
      return res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("not configured")) {
        req.log.warn("Video checkout attempted but billing is not configured");
        return res.status(503).json({ error: "Faturamento não disponível neste ambiente." });
      }
      req.log.error({ err }, "Failed to create video pack checkout session");
      return res.status(500).json({ error: "Falha ao iniciar o checkout" });
    }
  },
);

/* ─── plan constants ──────────────────────────────────────────────────── */
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
  "/stripe/reconcile-session",
  requireAuth,
  async (req: Request, res: Response) => {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

    try {
      const result = await reconcileCheckoutSession(sessionId, clerkUserId);
      return res.json(result);
    } catch (err) {
      req.log.error({ err }, "Reconcile session failed");
      return res.status(500).json({ error: "Reconciliation failed" });
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
