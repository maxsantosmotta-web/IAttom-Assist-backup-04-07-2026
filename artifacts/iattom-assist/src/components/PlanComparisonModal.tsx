import { useState } from "react";
import { useLocation } from "wouter";
import { X, Check, Zap, Crown, RefreshCw, Star, Sparkles, Building2, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useGetStripePlans,
  getGetStripePlansQueryKey,
  useGetMe,
  getGetMeQueryKey,
  useGetStripeSubscription,
  getGetStripeSubscriptionQueryKey,
  useCreateCheckoutSession,
} from "@workspace/api-client-react";
import { PLAN_CREDITS, PLAN_NAMES, PLAN_PRICES, PLAN_SAVINGS } from "@/lib/credits";

const PLAN_ORDER = ["free", "pro", "business", "agency"];

const PLAN_ACCENT: Record<string, string> = {
  free:     "border-blue-400/20",
  pro:      "border-emerald-500/30",
  business: "border-violet-500/30",
  agency:   "border-[#C9A84C]/55",
};
const PLAN_GLOW: Record<string, string> = {
  free:     "",
  pro:      "shadow-[0_0_40px_-4px_rgba(16,185,129,0.16)]",
  business: "shadow-[0_0_32px_-4px_rgba(139,92,246,0.09)]",
  agency:   "shadow-[0_0_40px_-4px_rgba(201,168,76,0.14)]",
};
const PLAN_COLOR: Record<string, string> = {
  free:     "text-blue-300",
  pro:      "text-emerald-400",
  business: "text-violet-400",
  agency:   "text-[#E8C96A]",
};
const PLAN_BTN: Record<string, string> = {
  free:     "bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 border border-blue-400/25",
  pro:      "bg-emerald-600 text-white hover:bg-emerald-500 font-bold",
  business: "bg-violet-600 text-white hover:bg-violet-500 font-bold",
  agency:   "bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black hover:brightness-110 font-black",
};
const PLAN_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  free:     ({ className }) => <Zap className={className} />,
  pro:      ({ className }) => <TrendingUp className={className} />,
  business: ({ className }) => <Sparkles className={className} />,
  agency:   ({ className }) => <Building2 className={className} />,
};
const PLAN_DESC: Record<string, string> = {
  free:     "Entrada na plataforma.",
  pro:      "Melhor custo-benefício.",
  business: "Recursos avançados.",
  agency:   "Experiência máxima.",
};

interface PlanComparisonModalProps {
  open: boolean;
  onClose: () => void;
  highlightPlan?: string;
}

export function PlanComparisonModal({ open, onClose, highlightPlan = "pro" }: PlanComparisonModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [billing,      setBilling]      = useState<"monthly" | "annual">("monthly");
  const [startPending, setStartPending] = useState(false);

  const { data: plans = [], isLoading } = useGetStripePlans({
    query: { queryKey: getGetStripePlansQueryKey(), staleTime: 60_000 },
  });
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: subscription } = useGetStripeSubscription({
    query: { queryKey: getGetStripeSubscriptionQueryKey(), staleTime: 30_000 },
  });

  const checkout = useCreateCheckoutSession({
    mutation: {
      onSuccess: (data) => { if (data.url) window.location.href = data.url; },
      onError: () => toast({ title: "Erro no checkout", description: "Tente novamente.", variant: "destructive" }),
    },
  });

  const currentPlan  = me?.plan ?? "free";
  const hasActiveSub = subscription?.hasSubscription === true;
  const sortedPlans  = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));

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

  const getMainPrice = (planKey: string) => {
    const p = PLAN_PRICES[planKey];
    if (!p) return "—";
    return billing === "annual" ? p.yearlyDisplay : p.monthlyDisplay;
  };
  const getPerMonth = (planKey: string) => PLAN_PRICES[planKey]?.yearlyMonthlyDisplay ?? null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-5xl bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-depth-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/35 to-transparent" />

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-start justify-between p-6 pb-4 border-b border-white/[0.06]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-4 h-4 text-primary" />
                  <p className="text-xs text-primary uppercase tracking-widest font-semibold">Planos</p>
                </div>
                <h2 className="text-xl font-bold text-white">Escolha seu plano</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Desbloqueie mais créditos e recursos avançados.</p>
              </div>
              <div className="flex items-center gap-3">
                {/* billing toggle */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  {(["monthly", "annual"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setBilling(opt)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 ${
                        billing === opt ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {opt === "monthly" ? "Mensal" : "Anual"}
                      {opt === "annual" && (
                        <span className="text-[9px] font-black px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                          -17%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Plans ─────────────────────────────────────────────── */}
            <div className="p-6">
              {(isLoading || sortedPlans.length === 0) ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[0,1,2,3].map((i) => (
                    <div key={i} className="h-80 rounded-xl bg-white/[0.03] skeleton-shimmer" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {sortedPlans.map((plan) => {
                    const key        = plan.planKey;
                    const isCurrent  = key === currentPlan && hasActiveSub;
                    const isHighlight= key === highlightPlan;
                    const isUpgrade  = PLAN_ORDER.indexOf(key) > PLAN_ORDER.indexOf(currentPlan);
                    const savings    = PLAN_SAVINGS[key] ?? 0;
                    const PlanIcon   = PLAN_ICON_MAP[key] ?? PLAN_ICON_MAP.free;
                    const perMonth   = getPerMonth(key);

                    return (
                      <div
                        key={key}
                        className={`relative flex flex-col rounded-xl border p-5 transition-all duration-200 ${
                          PLAN_ACCENT[key]
                        } ${isHighlight ? PLAN_GLOW[key] : ""} ${
                          isHighlight ? "bg-white/[0.025]" : "bg-[#111111]"
                        }`}
                      >
                        {isHighlight && key === "pro" && (
                          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent rounded-t-xl" />
                        )}

                        {isHighlight && !isCurrent && (
                          <div className="absolute -top-px left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-0.5 rounded-b-md bg-emerald-600 text-white">
                              <Star className="w-2.5 h-2.5 fill-white" />
                              MAIS ESCOLHIDO
                            </span>
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute -top-px left-1/2 -translate-x-1/2">
                            <span className="inline-block text-[10px] font-bold px-3 py-0.5 rounded-b-md bg-white/10 text-zinc-400 border border-white/10 border-t-0">
                              PLANO ATUAL
                            </span>
                          </div>
                        )}

                        {/* plan icon + name */}
                        <div className="flex items-center gap-2 mb-1 mt-1">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                            key === "free"     ? "bg-blue-500/12 border border-blue-400/20" :
                            key === "pro"      ? "bg-emerald-500/10 border border-emerald-500/25" :
                            key === "business" ? "bg-violet-500/12 border border-violet-500/20" :
                                                "bg-[#C9A84C]/10 border border-[#C9A84C]/20"
                          }`}>
                            <PlanIcon className={`w-3 h-3 ${PLAN_COLOR[key]}`} />
                          </div>
                          <p className={`text-sm font-bold ${PLAN_COLOR[key]}`}>
                            {PLAN_NAMES[key] ?? plan.name}
                          </p>
                        </div>

                        <p className="text-[11px] text-zinc-600 leading-snug mb-3">{PLAN_DESC[key] ?? plan.description}</p>

                        {/* price — annual shows full annual as main */}
                        <div className="mb-3">
                          <div className="text-2xl font-bold text-white leading-none">{getMainPrice(key)}</div>
                          {billing === "annual" && perMonth ? (
                            <div className="mt-1 space-y-0.5">
                              <p className="text-[10px] text-zinc-500">equivale a {perMonth}</p>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-zinc-600">cobrado anualmente</span>
                                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                  -{savings}%
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-zinc-600 mt-1">cobrado mensalmente</p>
                          )}
                        </div>

                        {/* credits */}
                        <div className="flex items-center gap-1.5 mb-4 p-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                          <Zap className="w-3 h-3 text-primary fill-primary shrink-0" />
                          <span className="text-xs font-semibold text-zinc-300">
                            {(PLAN_CREDITS[key as keyof typeof PLAN_CREDITS] ?? plan.credits).toLocaleString("pt-BR")} créditos/mês
                          </span>
                        </div>

                        {/* features */}
                        <ul className="space-y-2 mb-5 flex-1">
                          {plan.features.slice(0, 4).map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <Check className={`w-3 h-3 shrink-0 mt-0.5 ${isHighlight ? "text-[#C9A84C]" : "text-zinc-600"}`} />
                              <span className="text-[11px] text-zinc-400 leading-snug">{f}</span>
                            </li>
                          ))}
                        </ul>

                        {/* CTA */}
                        {isCurrent ? (
                          <Button disabled size="sm" className="w-full text-xs bg-white/5 border border-white/10 text-zinc-500">
                            Plano Atual
                          </Button>
                        ) : hasActiveSub && !isUpgrade ? (
                          <Button size="sm" variant="outline" className="w-full text-xs border-white/10 text-zinc-400 hover:border-white/20">
                            Fazer Downgrade
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className={`w-full text-xs ${PLAN_BTN[key]}`}
                            onClick={() => handleUpgrade(plan.priceId, key)}
                            disabled={checkout.isPending || startPending}
                          >
                            {(checkout.isPending || (key === "free" && startPending)) && (
                              <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                            )}
                            {hasActiveSub && isUpgrade
                              ? `Fazer Upgrade`
                              : `Assinar ${PLAN_NAMES[key] ?? plan.name}`}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 pb-5">
              <p className="text-[11px] text-zinc-600 text-center">
                Pagamento seguro via Stripe. Cancele quando quiser. Créditos renovam mensalmente.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
