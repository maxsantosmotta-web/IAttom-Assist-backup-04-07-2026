import { useState } from "react";
import { Zap, AlertTriangle, X, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUseCredits, useGetCreditsBalance, getGetCreditsBalanceQueryKey, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import type { FeatureKey } from "@/lib/credits";
import { FEATURE_COSTS, PLAN_CREDITS, PLAN_CREATIVE_CREDITS, CREATIVE_FEATURES } from "@/lib/credits";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";

const GLOBAL_BETA = import.meta.env.VITE_GLOBAL_BETA_MODE === "true";
const OWNER_EMAIL = "maxsantosmotta@gmail.com";

const FEATURE_MODULE_NAMES: Record<FeatureKey, string> = {
  product_discovery: "Buscar Produto",
  product_validation: "Validar Produto",
  campaign: "Criar Campanha",
  content: "Criar Conteúdo",
  creativeImage1: "Imagem",
  creativeImage2: "Imagem",
  creativeImage3: "Imagem",
  video_script: "Script de Vídeo",
  prompt_creation: "Criar Prompt",
};

interface CreditsGateProps {
  feature: FeatureKey;
  onSuccess: (charge: () => Promise<void>) => void;
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
  const { isSignedIn, user } = useUser();
  const isOwner = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() === OWNER_EMAIL;

  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), staleTime: 0, enabled: !!isSignedIn } });
  const { data: balanceData } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), retry: false, staleTime: 0, enabled: !!isSignedIn },
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

  const currentBalance = isOwner
    ? 999999
    : isCreativeFeature
      ? (balanceData?.creativeBalance ?? 0)
      : (balanceData?.balance ?? 0);

  const trigger = () => {
    if (disabled) return;
    if (GLOBAL_BETA || isOwner || me?.role === "admin") {
      onSuccess(async () => {});
      return;
    }
    if (balanceData && currentBalance < cost) {
      setInsufficient({ balance: currentBalance, required: cost, isCreative: isCreativeFeature });
      return;
    }
    onSuccess(() => mutation.mutateAsync({ data: { feature } }).then(() => undefined));
  };

  const currentPlanLimit = isOwner
    ? 999999
    : isCreativeFeature
      ? (PLAN_CREATIVE_CREDITS[balanceData?.plan as keyof typeof PLAN_CREATIVE_CREDITS ?? "free"] ?? 0)
      : (PLAN_CREDITS[balanceData?.plan as keyof typeof PLAN_CREDITS ?? "free"] ?? 0);
  const hasUpgrade = isOwner ? false : isCreativeFeature
    ? (Object.keys(PLAN_CREATIVE_CREDITS) as Array<keyof typeof PLAN_CREATIVE_CREDITS>).some(
        (p) => PLAN_CREATIVE_CREDITS[p] > currentPlanLimit,
      )
    : (Object.keys(PLAN_CREDITS) as Array<keyof typeof PLAN_CREDITS>).some(
        (p) => PLAN_CREDITS[p] > currentPlanLimit,
      );

  const moduleName = FEATURE_MODULE_NAMES[feature];
  const topLabel = `SALDO DE ${moduleName.toUpperCase()}`;
  const title = `Saldo de ${moduleName} insuficiente`;

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
                    {topLabel}
                  </p>
                </div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {title}
                </h2>
                <p className="text-sm text-muted-foreground">Adquira um pacote avulso</p>
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
