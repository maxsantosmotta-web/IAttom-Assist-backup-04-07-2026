import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Crown, Check, Zap, ExternalLink, AlertTriangle, RefreshCw,
  CreditCard, Gift, TrendingUp, Star, Lock, ChevronDown, ChevronUp,
  Sparkles, Building2, Rocket, CircleSlash, ShoppingCart, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetStripePlans, getGetStripePlansQueryKey,
  useGetStripeSubscription, getGetStripeSubscriptionQueryKey,
  useCreateCheckoutSession, useCreateBillingPortal,
  useGetMe, getGetMeQueryKey,
  useGetCreditsBalance, getGetCreditsBalanceQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";
import { PLAN_CREDITS, PLAN_NAMES, PLAN_PRICES, PLAN_SAVINGS } from "@/lib/credits";

/* ─── credit packages ────────────────────────────────────────────────── */
const CREDIT_PACKAGES = [
  { id: "credits_100",  credits: 100,  label: "100",   price: "R$ 19,90",  tag: null,           perUnit: "R$ 0,20/cr" },
  { id: "credits_300",  credits: 300,  label: "300",   price: "R$ 49,90",  tag: null,           perUnit: "R$ 0,17/cr" },
  { id: "credits_1000", credits: 1000, label: "1.000", price: "R$ 129,90", tag: "Mais popular", perUnit: "R$ 0,13/cr" },
  { id: "credits_5000", credits: 5000, label: "5.000", price: "R$ 497,90", tag: "Melhor valor", perUnit: "R$ 0,10/cr" },
] as const;

/* ─── plan visual tokens ─────────────────────────────────────────────── */
const PLAN_COLORS: Record<string, string> = {
  free:     "text-blue-300",
  pro:      "text-emerald-400",
  business: "text-violet-400",
  agency:   "text-[#E8C96A]",
};
const PLAN_BORDER: Record<string, string> = {
  free:     "border-blue-400/20",
  pro:      "border-emerald-500/30",
  business: "border-violet-500/30",
  agency:   "border-[#C9A84C]/55",
};
const PLAN_BADGE_STYLE: Record<string, string> = {
  free:     "bg-blue-500/10 text-blue-200 border-blue-400/20",
  pro:      "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  business: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  agency:   "bg-[#C9A84C]/20 text-[#E8C96A] border-[#C9A84C]/40",
};
const PLAN_BTN_STYLE: Record<string, string> = {
  free:     "bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 border border-blue-400/25",
  pro:      "bg-emerald-600 text-white hover:bg-emerald-500 font-bold",
  business: "bg-violet-600 text-white hover:bg-violet-500 font-bold",
  agency:   "bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black hover:brightness-110 font-black",
};
const PLAN_GLOW: Record<string, string> = {
  free:     "",
  pro:      "shadow-[0_0_36px_-4px_rgba(16,185,129,0.16)]",
  business: "",
  agency:   "",
};
const PLAN_ICON: Record<string, React.FC<{ className?: string }>> = {
  free:     ({ className }) => <Zap className={className} />,
  pro:      ({ className }) => <TrendingUp className={className} />,
  business: ({ className }) => <Sparkles className={className} />,
  agency:   ({ className }) => <Building2 className={className} />,
};
const PLAN_DESC: Record<string, string> = {
  free:     "Entrada na plataforma com recursos essenciais.",
  pro:      "Melhor custo-benefício. Tudo que você precisa para crescer.",
  business: "Recursos avançados e automações para escalar.",
  agency:   "Experiência máxima. Ideal para agências e times.",
};
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: "Ativo",               color: "text-emerald-400" },
  trialing: { label: "Trial",               color: "text-blue-400"    },
  past_due: { label: "Pagamento em atraso", color: "text-amber-400"   },
  canceled: { label: "Cancelado",           color: "text-red-400"     },
  unpaid:   { label: "Não pago",            color: "text-red-400"     },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { year: "numeric", month: "short", day: "numeric" });
}

/* ─── FAQ ────────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Como funcionam os créditos?",
    a: "Cada recurso da plataforma consome uma quantidade de créditos: descoberta de produtos (5 cr), validação (5 cr), campanha (10 cr), conteúdo (8 cr), criativo (15 cr) e script de vídeo (10 cr). Os créditos renovam automaticamente todo mês.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. O cancelamento pode ser feito a qualquer momento pelo portal de faturamento. Você mantém acesso ao plano até o fim do período já pago — nenhuma cobrança adicional é feita.",
  },
  {
    q: "O que acontece quando os créditos acabam?",
    a: "Quando os créditos se esgotam, as ações de IA ficam pausadas até a renovação mensal. Você pode fazer upgrade a qualquer momento para obter mais créditos imediatamente.",
  },
  {
    q: "Os créditos acumulam entre os meses?",
    a: "Não. Os créditos reiniciam no primeiro dia de cada ciclo de cobrança. Créditos bônus de indicação, no entanto, são permanentes e não expiram.",
  },
  {
    q: "Como funciona o sistema de indicações?",
    a: "Ao indicar um amigo que se cadastrar, você ganha 50 créditos bônus. O amigo indicado recebe 25 créditos de boas-vindas. Não há limite de indicações.",
  },
  {
    q: "Qual plano é recomendado para quem está começando?",
    a: "O plano COMPLETO oferece o melhor custo-benefício — 500 créditos/mês, acesso completo a todos os módulos e suporte prioritário. É a escolha de 8 em cada 10 usuários ativos.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        }
      </button>
      {open && (
        <p className="text-sm text-zinc-500 leading-relaxed pb-4 pr-6">{a}</p>
      )}
    </div>
  );
}

/* ─── billing toggle ─────────────────────────────────────────────────── */
function BillingToggle({ value, onChange }: { value: "monthly" | "annual"; onChange: (v: "monthly" | "annual") => void }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
      {(["monthly", "annual"] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11.5px] font-semibold tracking-wide transition-all duration-200 ${
            value === opt ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {opt === "monthly" ? "Mensal" : "Anual"}
          {opt === "annual" && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 tracking-widest">
              economize até 17%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────────── */
export function Billing() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [showComparison, setShowComparison] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const { data: plans = [], isLoading: plansLoading } = useGetStripePlans({
    query: { queryKey: getGetStripePlansQueryKey(), retry: false, staleTime: 60_000 },
  });
  const { data: subscription, isLoading: subLoading } = useGetStripeSubscription({
    query: { queryKey: getGetStripeSubscriptionQueryKey(), retry: false, staleTime: 30_000 },
  });
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const { data: creditsData } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), retry: false, staleTime: 30_000 },
  });

  const checkout = useCreateCheckoutSession({
    mutation: {
      onSuccess: (data) => { if (data.url) window.location.href = data.url; },
      onError: () => toast({ title: "Erro no checkout", description: "Não foi possível iniciar o checkout. Tente novamente.", variant: "destructive" }),
    },
  });
  const portal = useCreateBillingPortal({
    mutation: {
      onSuccess: (data) => { if (data.url) window.location.href = data.url; },
      onError: () => toast({ title: "Portal indisponível", description: "Não foi possível abrir o portal. Tente novamente.", variant: "destructive" }),
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      toast({ title: "Pagamento realizado", description: "Seu plano foi ativado. Créditos adicionados à sua conta." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "credits_success") {
      toast({ title: "Créditos adicionados", description: "Seus créditos foram somados ao saldo da conta." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "canceled") {
      toast({ title: "Checkout cancelado", description: "Nenhuma cobrança foi realizada." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location]);

  const currentPlan  = me?.plan ?? "free";
  const hasActiveSub = subscription?.hasSubscription === true;
  const subStatus    = subscription?.status;
  const isLoading    = plansLoading || subLoading;

  const creditsLeft = creditsData?.balance ?? 0;
  const planLimit   = PLAN_CREDITS[currentPlan as keyof typeof PLAN_CREDITS] ?? 50;

  const PLAN_ORDER  = ["free", "pro", "business", "agency"];
  const sortedPlans = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));

  const [creditsPending, setCreditsPending] = useState<string | null>(null);
  const [startPending,   setStartPending]   = useState(false);
  const handleBuyCredits = async (packageId: string) => {
    setCreditsPending(packageId);
    try {
      const resp = await fetch("/api/stripe/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await resp.json() as { url?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "Erro");
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Erro ao iniciar compra", description: "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setCreditsPending(null);
    }
  };

  const handleUpgrade = (priceId: string | null | undefined, planKey: string) => {
    if (!priceId) {
      setStartPending(true);
      fetch("/api/stripe/start/checkout", { method: "POST" })
        .then((r) => r.json() as Promise<{ url?: string; error?: string }>)
        .then((data) => { if (data.url) window.location.href = data.url; })
        .catch(() => toast({ title: "Erro ao iniciar checkout", variant: "destructive" }))
        .finally(() => setStartPending(false));
      return;
    }
    checkout.mutate({ data: { priceId, planKey } });
  };

  /* ─── price display helpers ────────────────────────────────────────── */
  const getMainPrice = (planKey: string) => {
    const p = PLAN_PRICES[planKey];
    if (!p) return "—";
    return billing === "annual" ? p.yearlyDisplay : p.monthlyDisplay;
  };
  const getPerMonth = (planKey: string) => {
    return PLAN_PRICES[planKey]?.yearlyMonthlyDisplay ?? null;
  };

  const PlanIcon = PLAN_ICON[currentPlan] ?? PLAN_ICON.free;

  return (
    <div className="space-y-8 max-w-5xl">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-primary" />
          <p className="text-xs text-primary uppercase tracking-widest font-semibold">Faturamento</p>
        </div>
        <h1 className="text-2xl font-bold text-white">Assinatura e Planos</h1>
        <p className="text-sm text-muted-foreground mt-1">Escolha o plano ideal e libere todos os recursos da plataforma.</p>
      </div>

      {/* ── Current Plan Status ────────────────────────────────────────── */}
      {subLoading ? (
        <div className="rounded-xl border border-white/10 bg-[#111111] p-5 h-24 skeleton-shimmer" />
      ) : hasActiveSub ? (
        /* — has active subscription — */
        <div className={`rounded-xl border bg-[#111111] p-5 ${PLAN_BORDER[currentPlan] ?? "border-white/10"} ${PLAN_GLOW[currentPlan] ?? ""}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">Plano Atual</p>
              <div className="flex items-center gap-2.5">
                <PlanIcon className={`w-5 h-5 ${PLAN_COLORS[currentPlan] ?? "text-zinc-400"}`} />
                <span className={`text-2xl font-bold ${PLAN_COLORS[currentPlan] ?? "text-white"}`}>
                  {PLAN_NAMES[currentPlan] ?? currentPlan.toUpperCase()}
                </span>
                {subStatus && STATUS_LABELS[subStatus] && (
                  <Badge className={`text-[10px] px-2 py-0 h-5 border ${
                    subStatus === "active"   ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    subStatus === "trialing" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                    subStatus === "past_due" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                    "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}>
                    {STATUS_LABELS[subStatus].label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">{PLAN_DESC[currentPlan]}</p>
              <p className="text-xs text-zinc-600 mt-1">
                {creditsLeft.toLocaleString("pt-BR")} de {planLimit.toLocaleString("pt-BR")} créditos restantes este mês
              </p>
              {subscription?.currentPeriodEnd && (
                <p className="text-xs text-zinc-600 mt-1">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancela em ${formatDate(subscription.currentPeriodEnd)}`
                    : `Renova em ${formatDate(subscription.currentPeriodEnd)}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowComparison(true)}
                className="border-white/10 hover:border-primary/30 text-sm text-zinc-300 gap-1.5"
              >
                <Rocket className="w-3.5 h-3.5" />
                Fazer Upgrade
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 hover:border-primary/30 text-sm text-zinc-300"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending
                  ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <ExternalLink className="w-3.5 h-3.5 mr-1.5" />}
                Gerenciar Assinatura
              </Button>
            </div>
          </div>
          {subStatus === "past_due" && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">Pagamento em atraso. Atualize seu método de pagamento para manter o plano ativo.</p>
            </div>
          )}
        </div>
      ) : (
        /* — no active subscription — */
        <div className="relative rounded-xl border border-white/[0.08] bg-[#111111] p-5 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              <CircleSlash className="w-4.5 h-4.5 text-zinc-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">Status do Plano</p>
              <p className="text-lg font-bold text-zinc-400">Sem plano ativo</p>
              <p className="text-sm text-zinc-600 mt-0.5">
                Escolha um plano abaixo para liberar todos os módulos e recursos da plataforma.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Plans Grid ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Escolha seu Plano</h2>
            {!hasActiveSub && (
              <p className="text-xs text-zinc-600 mt-0.5">Selecione um plano para liberar o acesso completo à plataforma.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <BillingToggle value={billing} onChange={setBilling} />
            {sortedPlans.length > 0 && (
              <button
                onClick={() => setShowComparison(true)}
                className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors flex items-center gap-1"
              >
                <Star className="w-3 h-3" />
                Comparação completa
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0,1,2,3].map((i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-[#111111] p-5 h-80 skeleton-shimmer" />
            ))}
          </div>
        ) : sortedPlans.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#111111] p-8 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-300 mb-1">Faturamento em configuração</p>
              <p className="text-xs text-zinc-500 max-w-sm">Os planos pagos serão disponibilizados em breve. Créditos e todos os módulos funcionam normalmente.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedPlans.map((plan) => {
              const planKey    = plan.planKey;
              const isCurrent  = planKey === currentPlan && hasActiveSub;
              const isUpgrade  = PLAN_ORDER.indexOf(planKey) > PLAN_ORDER.indexOf(currentPlan);
              const isDowngrade= PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(currentPlan);
              const isPopular  = planKey === "pro";
              const PIcon      = PLAN_ICON[planKey] ?? PLAN_ICON.free;
              const savings    = PLAN_SAVINGS[planKey] ?? 0;
              const perMonth   = getPerMonth(planKey);

              return (
                <div
                  key={planKey}
                  className={`relative rounded-xl border bg-[#111111] p-5 flex flex-col transition-all duration-200 ${
                    isCurrent
                      ? `${PLAN_BORDER[planKey] ?? "border-white/20"} bg-white/[0.015] ${PLAN_GLOW[planKey] ?? ""}`
                      : isPopular
                      ? `${PLAN_BORDER[planKey] ?? "border-white/10"} ${PLAN_GLOW[planKey] ?? ""} hover:bg-white/[0.02]`
                      : "border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.01]"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent rounded-t-xl" />
                  )}

                  {/* badges */}
                  {isCurrent && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                      <span className={`inline-block text-[10px] font-bold px-3 py-0.5 rounded-b-md border border-t-0 ${PLAN_BADGE_STYLE[planKey] ?? "bg-white/10 text-white border-white/20"}`}>
                        PLANO ATUAL
                      </span>
                    </div>
                  )}
                  {isPopular && !isCurrent && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-0.5 rounded-b-md bg-emerald-600 text-white">
                        <Star className="w-2.5 h-2.5 fill-white" />
                        MAIS ESCOLHIDO
                      </span>
                    </div>
                  )}

                  {/* plan header */}
                  <div className="mb-3 mt-1 flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      planKey === "free"     ? "bg-blue-500/12 border border-blue-400/20" :
                      planKey === "pro"      ? "bg-emerald-500/10 border border-emerald-500/25" :
                      planKey === "business" ? "bg-violet-500/12 border border-violet-500/20" :
                                              "bg-[#C9A84C]/10 border border-[#C9A84C]/20"
                    }`}>
                      <PIcon className={`w-3.5 h-3.5 ${PLAN_COLORS[planKey] ?? "text-zinc-400"}`} />
                    </div>
                    <p className={`text-sm font-bold ${PLAN_COLORS[planKey] ?? "text-white"}`}>
                      {PLAN_NAMES[planKey] ?? plan.name}
                    </p>
                  </div>

                  <p className="text-[11px] text-zinc-600 leading-snug mb-4">{PLAN_DESC[planKey] ?? plan.description}</p>

                  {/* price — annual shows full year price as main */}
                  <div className="mb-4">
                    <div className="text-2xl font-bold text-white leading-none">
                      {getMainPrice(planKey)}
                    </div>
                    {billing === "annual" && perMonth ? (
                      <div className="mt-1.5 space-y-0.5">
                        <p className="text-[11px] text-zinc-500">equivale a {perMonth}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-600">cobrado anualmente</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            -{savings}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-600 mt-1">cobrado mensalmente</p>
                    )}
                  </div>

                  {/* credits */}
                  <div className="flex items-center gap-1.5 mb-4 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Zap className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />
                    <span className="text-xs font-semibold text-zinc-300">
                      {(PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits).toLocaleString("pt-BR")} créditos / mês
                    </span>
                  </div>

                  {/* features */}
                  <ul className="space-y-2 mb-5 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          planKey === "pro" ? "text-[#C9A84C]" : "text-zinc-500"
                        }`} />
                        <span className="text-xs text-zinc-400">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCurrent ? (
                    <Button disabled size="sm" className="w-full bg-white/5 text-zinc-500 border border-white/10 text-xs cursor-default">
                      Plano Atual
                    </Button>
                  ) : hasActiveSub && isDowngrade ? (
                    <Button size="sm" variant="outline" className="w-full border-white/10 text-zinc-400 text-xs hover:border-white/20" onClick={() => portal.mutate()} disabled={portal.isPending}>
                      Fazer Downgrade
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={`w-full text-xs font-semibold ${PLAN_BTN_STYLE[planKey] ?? ""}`}
                      onClick={() => handleUpgrade(plan.priceId, planKey)}
                      disabled={checkout.isPending || startPending}
                    >
                      {(checkout.isPending || (planKey === "free" && startPending)) && (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      )}
                      {hasActiveSub && isUpgrade
                        ? `Fazer Upgrade`
                        : `Assinar ${PLAN_NAMES[planKey] ?? plan.name}`}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Comprar Créditos ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#111111] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <p className="text-xs text-primary uppercase tracking-widest font-semibold">Comprar Créditos</p>
            </div>
            <h2 className="text-sm font-semibold text-zinc-300">Recarregue seu saldo sem mudar de plano</h2>
            <p className="text-xs text-zinc-600 mt-0.5">Os créditos são somados ao seu saldo atual e nunca expiram.</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
            <Zap className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />
            <span className="text-xs font-semibold text-zinc-300">{creditsLeft.toLocaleString("pt-BR")} créditos disponíveis</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CREDIT_PACKAGES.map((pkg) => {
            const isPopular = pkg.tag === "Mais popular";
            const isBest    = pkg.tag === "Melhor valor";
            const isPending = creditsPending === pkg.id;
            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-xl border p-5 transition-all duration-200 ${
                  isPopular
                    ? "border-[#C9A84C]/45 bg-white/[0.025] shadow-[0_0_28px_-4px_rgba(201,168,76,0.14)]"
                    : isBest
                    ? "border-[#C9A84C]/20 bg-[#111111] hover:border-[#C9A84C]/35 hover:bg-white/[0.01]"
                    : "border-white/[0.08] bg-[#111111] hover:border-white/[0.15] hover:bg-white/[0.01]"
                }`}
              >
                {isPopular && (
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/55 to-transparent rounded-t-xl" />
                )}
                {pkg.tag && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <span className={`inline-block text-[9px] font-bold px-2.5 py-0.5 rounded-b-md whitespace-nowrap ${
                      isPopular
                        ? "bg-[#C9A84C] text-black"
                        : "bg-white/[0.08] text-zinc-400 border border-white/[0.10] border-t-0"
                    }`}>
                      {pkg.tag.toUpperCase()}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3 mt-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isPopular ? "bg-[#C9A84C]/12 border border-[#C9A84C]/25" : "bg-white/[0.04] border border-white/[0.08]"
                  }`}>
                    <Plus className={`w-3.5 h-3.5 ${isPopular ? "text-[#C9A84C]" : "text-zinc-500"}`} />
                  </div>
                  <div>
                    <p className={`text-base font-bold leading-none ${isPopular ? "text-[#C9A84C]" : "text-white"}`}>
                      {pkg.label}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">créditos</p>
                  </div>
                </div>

                <p className="text-xl font-bold text-white mb-0.5">{pkg.price}</p>
                <p className="text-[10px] text-zinc-600 mb-5">{pkg.perUnit}</p>

                <Button
                  size="sm"
                  className={`w-full h-9 text-xs font-semibold ${
                    isPopular
                      ? "bg-[#C9A84C] text-black hover:bg-[#E8C96A]"
                      : "bg-white/[0.05] text-zinc-300 border border-white/[0.09] hover:bg-[#C9A84C]/10 hover:text-[#C9A84C] hover:border-[#C9A84C]/25 transition-colors"
                  }`}
                  onClick={() => handleBuyCredits(pkg.id)}
                  disabled={isPending || creditsPending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar Créditos</>
                  }
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Referral CTA (only shown when user has active plan) ────────── */}
      {hasActiveSub && (
        <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Indique amigos e ganhe créditos</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Ganhe 50 créditos por cada amigo que entrar. Eles recebem 25 créditos de bônus.
              </p>
            </div>
          </div>
          <Link href="/dashboard/referral">
            <Button size="sm" variant="outline" className="border-white/10 hover:border-primary/30 text-zinc-300 gap-1.5 shrink-0">
              <Gift className="w-3.5 h-3.5" />
              Ver Indicações
            </Button>
          </Link>
        </div>
      )}

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#111111] p-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs text-primary uppercase tracking-widest font-semibold">Perguntas Frequentes</p>
        </div>
        <p className="text-xs text-zinc-600 mb-5">Tudo que você precisa saber antes de escolher seu plano.</p>
        {FAQ_ITEMS.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>

      {/* ── Bottom note ───────────────────────────────────────────────── */}
      <p className="text-xs text-zinc-600">
        Pagamentos processados com segurança via Stripe. Cancele quando quiser. Créditos renovam mensalmente.
      </p>

      <PlanComparisonModal open={showComparison} onClose={() => setShowComparison(false)} highlightPlan="pro" />
    </div>
  );
}
