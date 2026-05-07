import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Crown, Check, Zap, ExternalLink, AlertTriangle, RefreshCw,
  CreditCard, Gift, TrendingUp, Star, Lock,
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
import { PLAN_CREDITS } from "@/lib/credits";

const PLAN_COLORS: Record<string, string> = {
  free: "text-zinc-400", pro: "text-primary", business: "text-emerald-400", agency: "text-purple-400",
};
const PLAN_BORDER: Record<string, string> = {
  free: "border-white/10", pro: "border-primary/40", business: "border-emerald-500/40", agency: "border-purple-500/40",
};
const PLAN_BADGE_STYLE: Record<string, string> = {
  free: "bg-zinc-800 text-zinc-400 border-zinc-700",
  pro: "bg-primary/15 text-primary border-primary/30",
  business: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  agency: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};
const PLAN_BTN_STYLE: Record<string, string> = {
  free: "bg-white/8 text-zinc-300 hover:bg-white/12 border border-white/10",
  pro: "bg-primary text-black hover:bg-primary/90 font-bold",
  business: "bg-emerald-500 text-black hover:bg-emerald-500/90 font-bold",
  agency: "bg-purple-500 text-white hover:bg-purple-500/90 font-bold",
};
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "text-emerald-400" },
  trialing: { label: "Trial", color: "text-blue-400" },
  past_due: { label: "Past Due", color: "text-amber-400" },
  canceled: { label: "Canceled", color: "text-red-400" },
  unpaid: { label: "Unpaid", color: "text-red-400" },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function formatAmount(amount: number): string {
  if (amount === 0) return "START";
  return `$${(amount / 100).toFixed(0)}/mo`;
}

const PRO_UNLOCKS = [
  { icon: Zap, label: "500 créditos / mês", desc: "10× mais execuções" },
  { icon: TrendingUp, label: "Analytics avançado", desc: "Painel de uso completo" },
  { icon: Star, label: "Suporte prioritário", desc: "Respostas mais rápidas" },
  { icon: Gift, label: "Bônus de indicação", desc: "Ganhe créditos extras" },
];

export function Billing() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [showComparison, setShowComparison] = useState(false);

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
      onError: () => toast({ title: "Checkout failed", description: "Could not start checkout. Please try again.", variant: "destructive" }),
    },
  });
  const portal = useCreateBillingPortal({
    mutation: {
      onSuccess: (data) => { if (data.url) window.location.href = data.url; },
      onError: () => toast({ title: "Portal unavailable", description: "Could not open billing portal. Please try again.", variant: "destructive" }),
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      toast({ title: "Pagamento realizado", description: "Seu plano foi atualizado. Créditos foram adicionados à sua conta." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "canceled") {
      toast({ title: "Checkout cancelado", description: "Nenhuma cobrança foi realizada." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location]);

  const currentPlan = me?.plan ?? "free";
  const hasActiveSub = subscription?.hasSubscription;
  const subStatus = subscription?.status;
  const isLoading = plansLoading || subLoading;
  const isFree = currentPlan === "free";

  const pct = creditsData?.percentage ?? 100;
  const creditsLeft = creditsData?.balance ?? 0;
  const planLimit = PLAN_CREDITS[currentPlan as keyof typeof PLAN_CREDITS] ?? 50;

  const PLAN_ORDER = ["free", "pro", "business", "agency"];
  const sortedPlans = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));

  const handleUpgrade = (priceId: string | null | undefined, planKey: string) => {
    if (!priceId) {
      toast({ title: "Plan not available", description: "Stripe products not yet seeded. Run seed-products script.", variant: "destructive" });
      return;
    }
    checkout.mutate({ data: { priceId, planKey } });
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-primary" />
          <p className="text-xs text-primary uppercase tracking-widest font-semibold">Faturamento</p>
        </div>
        <h1 className="text-2xl font-bold text-white">Assinatura e Planos</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu plano e preferências de faturamento.</p>
      </div>

      {/* Free plan upgrade nudge */}
      {isFree && (
        <div className="relative rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent p-5 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none" style={{ background: "radial-gradient(ellipse at top right, rgba(201,168,76,0.08) 0%, transparent 65%)" }} />
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-widest">Você está no Plano START</span>
              </div>
              <p className="text-sm text-zinc-300 mb-1">
                Você usou <span className="font-bold text-white">{creditsLeft}</span> de <span className="font-bold text-white">{planLimit}</span> créditos ({pct}% restantes).
              </p>
              <p className="text-xs text-zinc-500">Atualize para o Pro: 500 créditos/mês, análises avançadas e suporte prioritário.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => setShowComparison(true)}
                className="bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                Comparar planos
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PRO_UNLOCKS.map((item) => (
              <div key={item.label} className="flex items-start gap-2 p-2.5 rounded-lg bg-black/20 border border-white/[0.06]">
                <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="w-3 h-3 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-zinc-200 leading-tight">{item.label}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Plan Status */}
      <div className="rounded-xl border border-white/10 bg-[#111111] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">Plano Atual</p>
            <div className="flex items-center gap-2.5">
              <Crown className={`w-5 h-5 ${PLAN_COLORS[currentPlan] ?? "text-zinc-400"}`} />
              <span className={`text-2xl font-bold ${PLAN_COLORS[currentPlan] ?? "text-white"}`}>
                {currentPlan === "free" ? "START" : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
              </span>
              {subStatus && STATUS_LABELS[subStatus] && (
                <Badge className={`text-[10px] px-2 py-0 h-5 border ${
                  STATUS_LABELS[subStatus].color === "text-emerald-400" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  STATUS_LABELS[subStatus].color === "text-amber-400" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                  STATUS_LABELS[subStatus].color === "text-blue-400" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                  "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {STATUS_LABELS[subStatus].label}
                </Badge>
              )}
            </div>
            {subscription?.currentPeriodEnd && (
              <p className="text-xs text-zinc-500 mt-1.5">
                {subscription.cancelAtPeriodEnd
                  ? `Cancels on ${formatDate(subscription.currentPeriodEnd)}`
                  : `Renews on ${formatDate(subscription.currentPeriodEnd)}`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isFree && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowComparison(true)}
                className="border-white/10 hover:border-primary/30 text-sm text-zinc-300 gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Atualizar
              </Button>
            )}
            {hasActiveSub && (
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 hover:border-primary/30 text-sm text-zinc-300"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5 mr-1.5" />}
                Gerenciar Assinatura
              </Button>
            )}
          </div>
        </div>

        {subStatus === "past_due" && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Your payment is past due. Update your payment method to keep your plan active.</p>
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Planos Disponíveis</h2>
          {sortedPlans.length > 0 && (
            <button
              onClick={() => setShowComparison(true)}
              className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors flex items-center gap-1"
            >
              <Star className="w-3 h-3" /> Comparação completa
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0,1,2,3].map((i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-[#111111] p-5 h-64 skeleton-shimmer" />
            ))}
          </div>
        ) : sortedPlans.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#111111] p-8 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-300 mb-1">Faturamento em configuração</p>
              <p className="text-xs text-zinc-500 max-w-sm">
                Os planos pagos serão disponibilizados em breve. Créditos e todos os módulos funcionam normalmente.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedPlans.map((plan) => {
              const isCurrent = plan.planKey === currentPlan;
              const planKey = plan.planKey;
              const isUpgrade = PLAN_ORDER.indexOf(planKey) > PLAN_ORDER.indexOf(currentPlan);
              const isDowngrade = PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(currentPlan);
              const isPopular = planKey === "pro";

              return (
                <div
                  key={planKey}
                  className={`relative rounded-xl border bg-[#111111] p-5 flex flex-col transition-colors ${
                    isCurrent
                      ? `${PLAN_BORDER[planKey] ?? "border-white/20"} bg-white/[0.02]`
                      : isPopular && isFree
                      ? "border-primary/30 hover:border-primary/50"
                      : "border-white/8 hover:border-white/15"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                      <span className={`inline-block text-[10px] font-bold px-3 py-0.5 rounded-b-md border border-t-0 ${PLAN_BADGE_STYLE[planKey] ?? "bg-white/10 text-white border-white/20"}`}>
                        CURRENT
                      </span>
                    </div>
                  )}
                  {isPopular && !isCurrent && isFree && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-0.5 rounded-b-md bg-primary text-black">
                        <Star className="w-2.5 h-2.5 fill-black" /> POPULAR
                      </span>
                    </div>
                  )}

                  <div className="mb-4 mt-1">
                    <p className={`text-sm font-bold mb-0.5 ${PLAN_COLORS[planKey] ?? "text-white"}`}>{plan.name}</p>
                    <p className="text-xs text-zinc-600 leading-snug">{plan.description}</p>
                  </div>

                  <div className="mb-4">
                    <span className="text-2xl font-bold text-white">{formatAmount(plan.amount)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-4 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Zap className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />
                    <span className="text-xs font-semibold text-zinc-300">
                      {(PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits).toLocaleString()} créditos / mês
                    </span>
                  </div>

                  <ul className="space-y-2 mb-5 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-xs text-zinc-400">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button disabled size="sm" className="w-full bg-white/5 text-zinc-500 border border-white/10 text-xs cursor-default">
                      Current Plan
                    </Button>
                  ) : planKey === "free" ? (
                    hasActiveSub ? (
                      <Button size="sm" variant="outline" className="w-full border-white/10 text-zinc-400 text-xs hover:border-white/20" onClick={() => portal.mutate()} disabled={portal.isPending}>
                        Fazer Downgrade
                      </Button>
                    ) : (
                      <Button disabled size="sm" className="w-full bg-white/5 text-zinc-500 border border-white/10 text-xs cursor-default">
                        Plano START
                      </Button>
                    )
                  ) : hasActiveSub && isDowngrade ? (
                    <Button size="sm" variant="outline" className="w-full border-white/10 text-zinc-400 text-xs hover:border-white/20" onClick={() => portal.mutate()} disabled={portal.isPending}>
                        Fazer Downgrade
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={`w-full text-xs font-semibold ${PLAN_BTN_STYLE[planKey] ?? ""}`}
                      onClick={() => handleUpgrade(plan.priceId, planKey)}
                      disabled={checkout.isPending}
                    >
                      {checkout.isPending ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                      {hasActiveSub && isUpgrade ? "Atualizar" : "Começar"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Referral CTA */}
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

      {/* Bottom note */}
      <p className="text-xs text-zinc-600">
        Pagamentos processados com segurança via Stripe. Cancele quando quiser. Créditos renovam mensalmente.
      </p>

      <PlanComparisonModal open={showComparison} onClose={() => setShowComparison(false)} highlightPlan="pro" />
    </div>
  );
}
