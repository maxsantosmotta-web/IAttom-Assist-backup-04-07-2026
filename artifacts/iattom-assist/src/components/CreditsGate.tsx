import { useState } from "react";
import { Zap, AlertTriangle, X, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUseCredits, useGetCreditsBalance, getGetCreditsBalanceQueryKey, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { FeatureKey } from "@/lib/credits";
import { FEATURE_COSTS, PLAN_CREDITS, PLAN_CREATIVE_CREDITS, CREATIVE_FEATURES } from "@/lib/credits";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";

const GLOBAL_BETA = import.meta.env.VITE_GLOBAL_BETA_MODE === "true";

interface CreditsGateProps {
  feature: FeatureKey;
  onSuccess: (charge: () => void) => void;
  disabled?: boolean;
  hideCostBadge?: boolean;
  children: (props: { trigger: () => void; isLoading: boolean }) => React.ReactNode;
}

interface InsufficientState {
  balance: number;
  required: number;
  isCreative: boolean;
}

export function CreditsGate({ feature, onSuccess, disabled, hideCostBadge, children }: CreditsGateProps) {
  const [insufficient, setInsufficient] = useState<InsufficientState | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const qc = useQueryClient();
  const cost = FEATURE_COSTS[feature];
  const isCreativeFeature = CREATIVE_FEATURES.has(feature);

  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), staleTime: 0 } });
  const { data: balanceData } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), retry: false, staleTime: 0 },
  });

  const mutation = useUseCredits({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
      },
      onError: (err: unknown) => {
        const apiErr = err as { status?: number; data?: Record<string, unknown> };
        if (apiErr?.status === 402) {
          const data = apiErr.data ?? {};
          setInsufficient({
            balance: typeof data.balance === "number" ? data.balance : currentBalance,
            required: typeof data.required === "number" ? data.required : cost,
            isCreative: isCreativeFeature,
          });
        }
      },
    },
  });

  const currentBalance = isCreativeFeature
    ? (balanceData?.creativeBalance ?? 0)
    : (balanceData?.balance ?? 0);

  const trigger = () => {
    if (disabled) return;
    if (GLOBAL_BETA || me?.role === "admin") {
      onSuccess(() => {});
      return;
    }
    if (balanceData && currentBalance < cost) {
      setInsufficient({ balance: currentBalance, required: cost, isCreative: isCreativeFeature });
      return;
    }
    onSuccess(() => mutation.mutate({ data: { feature } }));
  };

  const currentPlanLimit = isCreativeFeature
    ? (PLAN_CREATIVE_CREDITS[balanceData?.plan as keyof typeof PLAN_CREATIVE_CREDITS ?? "free"] ?? 0)
    : (PLAN_CREDITS[balanceData?.plan as keyof typeof PLAN_CREDITS ?? "free"] ?? 0);
  const hasUpgrade = isCreativeFeature
    ? (Object.keys(PLAN_CREATIVE_CREDITS) as Array<keyof typeof PLAN_CREATIVE_CREDITS>).some(
        (p) => PLAN_CREATIVE_CREDITS[p] > currentPlanLimit,
      )
    : (Object.keys(PLAN_CREDITS) as Array<keyof typeof PLAN_CREDITS>).some(
        (p) => PLAN_CREDITS[p] > currentPlanLimit,
      );

  const labelGeneral = "Créditos Insuficientes";
  const labelCreative = "Créditos de Criativo Insuficientes";
  const titleGeneral = "Créditos insuficientes";
  const titleCreative = "Créditos de criativo insuficientes";

  return (
    <>
      <div className="flex items-center gap-2">
        <div className={hideCostBadge ? "w-full" : "flex-1 min-w-0"}>{children({ trigger, isLoading: mutation.isPending })}</div>
      </div>

      <Dialog open={!!insufficient} onOpenChange={(open) => !open && setInsufficient(null)}>
        <DialogContent className="bg-[#111111] border-white/10 max-w-md p-0 gap-0">
          <div className="p-6 border-b border-white/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {insufficient?.isCreative
                    ? <Palette className="w-4 h-4 text-amber-400" />
                    : <AlertTriangle className="w-4 h-4 text-amber-400" />
                  }
                  <p className="text-xs text-amber-400 uppercase tracking-widest font-medium">
                    {insufficient?.isCreative ? labelCreative : labelGeneral}
                  </p>
                </div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {insufficient?.isCreative ? titleCreative : titleGeneral}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Esta ação custa{" "}
                  <span className="text-white font-semibold">
                    {insufficient?.required} crédito{insufficient?.isCreative ? "s de criativo" : "s"}
                  </span>. Seu saldo{insufficient?.isCreative ? " de criativo" : ""} é{" "}
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
            {hasUpgrade ? (
              <>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-4">
                  Faça upgrade para obter mais créditos
                </p>
                <Button
                  className="w-full bg-primary text-black hover:bg-primary/90 font-semibold"
                  onClick={() => {
                    setInsufficient(null);
                    setShowPlans(true);
                  }}
                >
                  <Zap className="w-3.5 h-3.5 mr-2 fill-black" />
                  Comparar Planos
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Você está no plano mais alto. Contate o suporte para adicionar mais créditos.
              </p>
            )}
            <Button
              variant="outline"
              className="w-full border-white/10 hover:border-primary/30 text-sm"
              onClick={() => setInsufficient(null)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PlanComparisonModal
        open={showPlans}
        onClose={() => setShowPlans(false)}
        highlightPlan="pro"
      />
    </>
  );
}
