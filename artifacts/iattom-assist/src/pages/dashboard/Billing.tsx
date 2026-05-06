import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  Crown,
  Check,
  Zap,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetStripePlans,
  getGetStripePlansQueryKey,
  useGetStripeSubscription,
  getGetStripeSubscriptionQueryKey,
  useCreateCheckoutSession,
  useCreateBillingPortal,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";

const PLAN_COLORS: Record<string, string> = {
  free: "text-zinc-400",
  pro: "text-primary",
  business: "text-emerald-400",
  agency: "text-purple-400",
};

const PLAN_BORDER: Record<string, string> = {
  free: "border-white/10",
  pro: "border-primary/40",
  business: "border-emerald-500/40",
  agency: "border-purple-500/40",
};

const PLAN_BADGE_STYLE: Record<string, string> = {
  free: "bg-zinc-800 text-zinc-400 border-zinc-700",
  pro: "bg-primary/15 text-primary border-primary/30",
  business: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  agency: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const PLAN_BTN_STYLE: Record<string, string> = {
  free: "bg-white/8 text-zinc-300 hover:bg-white/12 border border-white/10",
  pro: "bg-primary text-black hover:bg-primary/90",
  business: "bg-emerald-500 text-black hover:bg-emerald-500/90",
  agency: "bg-purple-500 text-white hover:bg-purple-500/90",
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
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAmount(amount: number): string {
  if (amount === 0) return "Free";
  return `$${(amount / 100).toFixed(0)}/mo`;
}

export function Billing() {
  const { toast } = useToast();
  const [location] = useLocation();

  const { data: plans = [], isLoading: plansLoading } = useGetStripePlans({
    query: { queryKey: getGetStripePlansQueryKey(), retry: false, staleTime: 60_000 },
  });

  const { data: subscription, isLoading: subLoading } = useGetStripeSubscription({
    query: { queryKey: getGetStripeSubscriptionQueryKey(), retry: false, staleTime: 30_000 },
  });

  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });

  const checkout = useCreateCheckoutSession({
    mutation: {
      onSuccess: (data) => {
        if (data.url) window.location.href = data.url;
      },
      onError: () => {
        toast({
          title: "Checkout failed",
          description: "Could not start checkout. Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  const portal = useCreateBillingPortal({
    mutation: {
      onSuccess: (data) => {
        if (data.url) window.location.href = data.url;
      },
      onError: () => {
        toast({
          title: "Portal unavailable",
          description: "Could not open billing portal. Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      toast({
        title: "Payment successful",
        description: "Your plan has been upgraded. Credits have been added to your account.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "canceled") {
      toast({
        title: "Checkout canceled",
        description: "No charges were made.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location]);

  const currentPlan = me?.plan ?? "free";
  const hasActiveSub = subscription?.hasSubscription;
  const subStatus = subscription?.status;

  const handleUpgrade = (priceId: string | null | undefined, planKey: string) => {
    if (!priceId) {
      toast({
        title: "Plan not available",
        description: "Stripe products not yet seeded. Run seed-products script.",
        variant: "destructive",
      });
      return;
    }
    checkout.mutate({ data: { priceId, planKey } });
  };

  const handleManage = () => {
    portal.mutate();
  };

  const isLoading = plansLoading || subLoading;

  const PLAN_ORDER = ["free", "pro", "business", "agency"];
  const sortedPlans = [...plans].sort(
    (a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey),
  );

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-primary" />
          <p className="text-xs text-primary uppercase tracking-widest font-semibold">Billing</p>
        </div>
        <h1 className="text-2xl font-bold text-white">Subscription & Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your plan and billing preferences.
        </p>
      </div>

      {/* Current Plan Status */}
      <div className="rounded-xl border border-white/10 bg-[#111111] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">
              Current Plan
            </p>
            <div className="flex items-center gap-2.5">
              <Crown className={`w-5 h-5 ${PLAN_COLORS[currentPlan] ?? "text-zinc-400"}`} />
              <span className={`text-2xl font-bold ${PLAN_COLORS[currentPlan] ?? "text-white"}`}>
                {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
              </span>
              {subStatus && STATUS_LABELS[subStatus] && (
                <Badge
                  className={`text-[10px] px-2 py-0 h-5 border ${
                    STATUS_LABELS[subStatus].color === "text-emerald-400"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : STATUS_LABELS[subStatus].color === "text-amber-400"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : STATUS_LABELS[subStatus].color === "text-blue-400"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}
                >
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

          {hasActiveSub && (
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 hover:border-primary/30 text-sm text-zinc-300"
              onClick={handleManage}
              disabled={portal.isPending}
            >
              {portal.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              )}
              Manage Subscription
            </Button>
          )}
        </div>

        {subStatus === "past_due" && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              Your payment is past due. Update your payment method to keep your plan active.
            </p>
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-4">
          Available Plans
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-[#111111] p-5 animate-pulse">
                <div className="h-4 bg-white/5 rounded mb-3 w-1/2" />
                <div className="h-7 bg-white/5 rounded mb-4 w-2/3" />
                <div className="space-y-2">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-3 bg-white/5 rounded w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedPlans.map((plan) => {
              const isCurrent = plan.planKey === currentPlan;
              const planKey = plan.planKey;
              const isUpgrade =
                PLAN_ORDER.indexOf(planKey) > PLAN_ORDER.indexOf(currentPlan);
              const isDowngrade =
                PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(currentPlan);

              return (
                <div
                  key={planKey}
                  className={`relative rounded-xl border bg-[#111111] p-5 flex flex-col transition-colors ${
                    isCurrent
                      ? `${PLAN_BORDER[planKey] ?? "border-white/20"} bg-white/[0.02]`
                      : "border-white/8 hover:border-white/15"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                      <span
                        className={`inline-block text-[10px] font-bold px-3 py-0.5 rounded-b-md border border-t-0 ${
                          PLAN_BADGE_STYLE[planKey] ?? "bg-white/10 text-white border-white/20"
                        }`}
                      >
                        CURRENT
                      </span>
                    </div>
                  )}

                  <div className="mb-4 mt-1">
                    <p
                      className={`text-sm font-bold mb-0.5 ${PLAN_COLORS[planKey] ?? "text-white"}`}
                    >
                      {plan.name}
                    </p>
                    <p className="text-xs text-zinc-600 leading-snug">{plan.description}</p>
                  </div>

                  <div className="mb-4">
                    <span className="text-2xl font-bold text-white">
                      {formatAmount(plan.amount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-4 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Zap className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />
                    <span className="text-xs font-semibold text-zinc-300">
                      {plan.credits.toLocaleString()} credits / month
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
                    <Button
                      disabled
                      size="sm"
                      className="w-full bg-white/5 text-zinc-500 border border-white/10 text-xs cursor-default"
                    >
                      Current Plan
                    </Button>
                  ) : planKey === "free" ? (
                    hasActiveSub ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-white/10 text-zinc-400 text-xs hover:border-white/20"
                        onClick={handleManage}
                        disabled={portal.isPending}
                      >
                        Downgrade via Portal
                      </Button>
                    ) : (
                      <Button
                        disabled
                        size="sm"
                        className="w-full bg-white/5 text-zinc-500 border border-white/10 text-xs cursor-default"
                      >
                        Free Plan
                      </Button>
                    )
                  ) : hasActiveSub && isDowngrade ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-white/10 text-zinc-400 text-xs hover:border-white/20"
                      onClick={handleManage}
                      disabled={portal.isPending}
                    >
                      Downgrade via Portal
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={`w-full text-xs font-semibold ${PLAN_BTN_STYLE[planKey] ?? ""}`}
                      onClick={() => handleUpgrade(plan.priceId, planKey)}
                      disabled={checkout.isPending}
                    >
                      {checkout.isPending ? (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : null}
                      {hasActiveSub && isUpgrade ? "Upgrade" : "Get Started"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom note */}
      <p className="text-xs text-zinc-600">
        Payments are processed securely via Stripe. Cancel anytime. Credits reset monthly.
      </p>
    </div>
  );
}
