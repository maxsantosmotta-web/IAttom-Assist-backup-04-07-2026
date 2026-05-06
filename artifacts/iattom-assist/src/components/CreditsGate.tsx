import { useState } from "react";
import { Zap, TrendingUp, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUseCredits, useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { FeatureKey } from "@/lib/credits";
import { FEATURE_COSTS, PLAN_CREDITS, PLAN_PRICES } from "@/lib/credits";

interface CreditsGateProps {
  feature: FeatureKey;
  onSuccess: () => void;
  disabled?: boolean;
  children: (props: { trigger: () => void; isLoading: boolean }) => React.ReactNode;
}

interface InsufficientState {
  balance: number;
  required: number;
}

export function CreditsGate({ feature, onSuccess, disabled, children }: CreditsGateProps) {
  const [insufficient, setInsufficient] = useState<InsufficientState | null>(null);
  const qc = useQueryClient();
  const cost = FEATURE_COSTS[feature];

  const { data: balanceData } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), retry: false, staleTime: 30_000 },
  });

  const mutation = useUseCredits({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
        onSuccess();
      },
      onError: (err: unknown) => {
        const apiErr = err as { status?: number; data?: Record<string, unknown> };
        if (apiErr?.status === 402) {
          const data = apiErr.data ?? {};
          setInsufficient({
            balance: typeof data.balance === "number" ? data.balance : balanceData?.balance ?? 0,
            required: typeof data.required === "number" ? data.required : cost,
          });
        }
      },
    },
  });

  const trigger = () => {
    if (disabled) return;
    mutation.mutate({ data: { feature } });
  };

  const currentPlan = balanceData?.plan ?? "free";
  const currentPlanLimit = PLAN_CREDITS[currentPlan as keyof typeof PLAN_CREDITS] ?? 0;
  const upgradePlans = (Object.keys(PLAN_CREDITS) as Array<keyof typeof PLAN_CREDITS>).filter(
    (p) => PLAN_CREDITS[p] > currentPlanLimit,
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">{children({ trigger, isLoading: mutation.isPending })}</div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 shrink-0">
          <Zap className="w-3 h-3 text-primary fill-primary" />
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{cost} cr</span>
        </div>
      </div>

      <Dialog open={!!insufficient} onOpenChange={(open) => !open && setInsufficient(null)}>
        <DialogContent className="bg-[#111111] border-white/10 max-w-md p-0 gap-0">
          <div className="p-6 border-b border-white/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <p className="text-xs text-amber-400 uppercase tracking-widest font-medium">Insufficient Credits</p>
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Not enough credits</h2>
                <p className="text-sm text-muted-foreground">
                  This action costs{" "}
                  <span className="text-white font-semibold">{insufficient?.required} credits</span>. Your balance is{" "}
                  <span className="text-amber-400 font-semibold">{insufficient?.balance}</span>.
                </p>
              </div>
              <button
                onClick={() => setInsufficient(null)}
                className="text-muted-foreground hover:text-white transition-colors shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-3">Upgrade to get more credits</p>
            {upgradePlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">You are on the highest plan. Contact support to add credits.</p>
            ) : (
              upgradePlans.map((plan) => {
                const info = PLAN_PRICES[plan];
                const planCredits = PLAN_CREDITS[plan];
                return (
                  <div
                    key={plan}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-white/5 border border-white/10 hover:border-primary/30 transition-colors"
                  >
                    <div>
                      <p className={`text-sm font-semibold ${info.color}`}>{info.label}</p>
                      <p className="text-xs text-muted-foreground">{planCredits.toLocaleString()} credits / month</p>
                    </div>
                    <p className="text-sm font-bold text-white">${info.monthly}/mo</p>
                  </div>
                );
              })
            )}

            <div className="pt-2 flex gap-2">
              <Link
                href="/dashboard/credits"
                className="flex-1"
                onClick={() => setInsufficient(null)}
              >
                <Button variant="outline" className="w-full border-white/10 hover:border-primary/30 text-sm">
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                  View Credits
                </Button>
              </Link>
              <Link
                href="/dashboard/billing"
                className="flex-1"
                onClick={() => setInsufficient(null)}
              >
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                >
                  Upgrade Plan
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
