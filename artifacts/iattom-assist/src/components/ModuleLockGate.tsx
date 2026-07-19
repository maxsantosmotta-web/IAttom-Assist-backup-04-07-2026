import { useState } from "react";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";
import { PLAN_NAMES } from "@/lib/credits";

const PLAN_ORDER = ["pro", "business", "agency"];

interface ModuleLockGateProps {
  allowedPlans: string[];
  moduleName: string;
}

export function ModuleLockGate({ allowedPlans, moduleName }: ModuleLockGateProps) {
  const [showPlans, setShowPlans] = useState(false);

  const minimumPlan = PLAN_ORDER.find((p) => allowedPlans.includes(p)) ?? allowedPlans[0] ?? "pro";
  const minimumPlanName = PLAN_NAMES[minimumPlan] ?? minimumPlan.toUpperCase();
  const exclusive = allowedPlans.length === 1;

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-6">
          <Lock className="w-6 h-6 text-zinc-500" />
        </div>
        <p className="text-[10px] text-primary uppercase tracking-widest font-semibold mb-2">
          Plano necessário: {minimumPlanName}
        </p>
        <h2 className="text-xl font-bold text-white mb-3">{moduleName}</h2>
        <p className="text-sm text-muted-foreground max-w-xs mb-8">
          {exclusive
            ? `Este módulo está disponível exclusivamente no plano ${minimumPlanName}.`
            : `Este módulo está disponível a partir do plano ${minimumPlanName}.`}{" "}
          Faça upgrade para desbloquear.
        </p>
        <Button
          className="bg-primary text-black hover:bg-primary/90 font-semibold"
          onClick={() => setShowPlans(true)}
        >
          <Zap className="w-3.5 h-3.5 mr-2 fill-black" />
          Ver Planos
        </Button>
      </div>
      <PlanComparisonModal
        open={showPlans}
        onClose={() => setShowPlans(false)}
        highlightPlan={minimumPlan}
      />
    </>
  );
}
