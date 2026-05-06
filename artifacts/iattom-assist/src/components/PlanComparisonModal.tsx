import { X, Check, Zap, Crown, RefreshCw, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetStripePlans,
  getGetStripePlansQueryKey,
  useGetMe,
  getGetMeQueryKey,
  useCreateCheckoutSession,
} from "@workspace/api-client-react";
import { PLAN_CREDITS } from "@/lib/credits";

const PLAN_ORDER = ["free", "pro", "business", "agency"];
const PLAN_ACCENT: Record<string, string> = {
  free: "border-white/10",
  pro: "border-primary/50",
  business: "border-emerald-500/50",
  agency: "border-purple-500/50",
};
const PLAN_GLOW: Record<string, string> = {
  free: "",
  pro: "shadow-[0_0_32px_rgba(201,168,76,0.12)]",
  business: "shadow-[0_0_32px_rgba(52,211,153,0.12)]",
  agency: "shadow-[0_0_32px_rgba(168,85,247,0.12)]",
};
const PLAN_COLOR: Record<string, string> = {
  free: "text-zinc-400",
  pro: "text-primary",
  business: "text-emerald-400",
  agency: "text-purple-400",
};
const PLAN_BTN: Record<string, string> = {
  free: "bg-white/8 text-zinc-300 hover:bg-white/12 border border-white/10",
  pro: "bg-primary text-black hover:bg-primary/90 font-bold",
  business: "bg-emerald-500 text-black hover:bg-emerald-500/90 font-bold",
  agency: "bg-purple-500 text-white hover:bg-purple-500/90 font-bold",
};

interface PlanComparisonModalProps {
  open: boolean;
  onClose: () => void;
  highlightPlan?: string;
}

export function PlanComparisonModal({ open, onClose, highlightPlan = "pro" }: PlanComparisonModalProps) {
  const { toast } = useToast();

  const { data: plans = [], isLoading } = useGetStripePlans({
    query: { queryKey: getGetStripePlansQueryKey(), staleTime: 60_000 },
  });
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const checkout = useCreateCheckoutSession({
    mutation: {
      onSuccess: (data) => { if (data.url) window.location.href = data.url; },
      onError: () => toast({ title: "Checkout failed", description: "Please try again.", variant: "destructive" }),
    },
  });

  const currentPlan = me?.plan ?? "free";
  const sortedPlans = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));

  const handleUpgrade = (priceId: string | null | undefined, planKey: string) => {
    if (!priceId) {
      toast({ title: "Not available", description: "Run the seed-products script first.", variant: "destructive" });
      return;
    }
    checkout.mutate({ data: { priceId, planKey } });
  };

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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-5xl bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-depth-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            <div className="flex items-start justify-between p-6 pb-4 border-b border-white/[0.06]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-4 h-4 text-primary" />
                  <p className="text-xs text-primary uppercase tracking-widest font-semibold">Upgrade</p>
                </div>
                <h2 className="text-xl font-bold text-white">Choose your plan</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Unlock more credits and advanced features.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {isLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[0,1,2,3].map((i) => (
                    <div key={i} className="h-72 rounded-xl bg-white/[0.03] skeleton-shimmer" />
                  ))}
                </div>
              ) : sortedPlans.length === 0 ? (
                <div className="py-16 text-center">
                  <Zap className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500 mb-1">No plans available yet.</p>
                  <p className="text-xs text-zinc-700">Run the seed-products script to set up Stripe plans.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {sortedPlans.map((plan) => {
                    const key = plan.planKey;
                    const isCurrent = key === currentPlan;
                    const isHighlight = key === highlightPlan;
                    const isUpgrade = PLAN_ORDER.indexOf(key) > PLAN_ORDER.indexOf(currentPlan);

                    return (
                      <div
                        key={key}
                        className={`relative flex flex-col rounded-xl border p-5 transition-all duration-200 ${
                          PLAN_ACCENT[key]
                        } ${isHighlight ? PLAN_GLOW[key] : ""} ${
                          isHighlight ? "bg-white/[0.03]" : "bg-[#111111]"
                        }`}
                      >
                        {isHighlight && (
                          <div className="absolute -top-px left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-0.5 rounded-b-md bg-primary text-black">
                              <Star className="w-2.5 h-2.5 fill-black" />
                              MOST POPULAR
                            </span>
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute -top-px left-1/2 -translate-x-1/2">
                            <span className="inline-block text-[10px] font-bold px-3 py-0.5 rounded-b-md bg-white/10 text-zinc-400">
                              CURRENT
                            </span>
                          </div>
                        )}

                        <p className={`text-sm font-bold mb-0.5 mt-1 ${PLAN_COLOR[key]}`}>{plan.name}</p>
                        <p className="text-xs text-zinc-600 leading-snug mb-3">{plan.description}</p>

                        <div className="mb-3">
                          {plan.amount === 0 ? (
                            <span className="text-2xl font-bold text-white">Free</span>
                          ) : (
                            <>
                              <span className="text-2xl font-bold text-white">${plan.amount / 100}</span>
                              <span className="text-xs text-zinc-500">/mo</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mb-4 p-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                          <Zap className="w-3 h-3 text-primary fill-primary shrink-0" />
                          <span className="text-xs font-semibold text-zinc-300">
                            {(PLAN_CREDITS[key as keyof typeof PLAN_CREDITS] ?? plan.credits).toLocaleString()} credits/mo
                          </span>
                        </div>

                        <ul className="space-y-2 mb-5 flex-1">
                          {plan.features.slice(0, 4).map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <Check className={`w-3 h-3 shrink-0 mt-0.5 ${isHighlight ? "text-primary" : "text-zinc-500"}`} />
                              <span className="text-[11px] text-zinc-400 leading-snug">{f}</span>
                            </li>
                          ))}
                        </ul>

                        {isCurrent ? (
                          <Button disabled size="sm" className="w-full text-xs bg-white/5 border border-white/10 text-zinc-500">
                            Current Plan
                          </Button>
                        ) : !isUpgrade ? (
                          <Button size="sm" variant="outline" className="w-full text-xs border-white/10 text-zinc-400">
                            Downgrade
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className={`w-full text-xs ${PLAN_BTN[key]}`}
                            onClick={() => handleUpgrade(plan.priceId, key)}
                            disabled={checkout.isPending}
                          >
                            {checkout.isPending && <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />}
                            Get {plan.name}
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
                Secure checkout via Stripe. Cancel anytime. Credits reset monthly.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
