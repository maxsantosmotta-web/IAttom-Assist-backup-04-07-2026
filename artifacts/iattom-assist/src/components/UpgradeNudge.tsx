import { useState } from "react";
import { Zap, X, TrendingUp, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  useGetCreditsBalance,
  getGetCreditsBalanceQueryKey,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { PlanComparisonModal } from "./PlanComparisonModal";
import { PLAN_CREDITS } from "@/lib/credits";

interface UpgradeNudgeProps {
  totalActions?: number;
}

export function UpgradeNudge({ totalActions = 0 }: UpgradeNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const { data: balance } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), staleTime: 30_000 },
  });
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const plan = me?.plan ?? "free";
  const isPaid = plan !== "free";
  const pct = balance?.percentage ?? 100;
  const isPowerUser = totalActions >= 15;

  const planLimit = PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] ?? 50;
  const creditsLeft = balance?.balance ?? planLimit;

  if (dismissed) return null;
  if (pct > 35 && !isPowerUser) return null;
  if (isPaid && pct > 15) return null;

  let variant: "low" | "critical" | "power" = "low";
  if (isPowerUser && !isPaid) variant = "power";
  else if (pct <= 10) variant = "critical";
  else variant = "low";

  const configs = {
    critical: {
      icon: <Zap className="w-4 h-4 text-red-400 fill-red-400/30 shrink-0" />,
      bg: "bg-red-500/8 border-red-500/20",
      title: "Créditos quase esgotados",
      body: `Apenas ${creditsLeft} créditos restantes. Atualize agora para continuar sem interrupção.`,
      cta: "Atualizar agora",
      accentCta: true,
    },
    low: {
      icon: <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />,
      bg: "bg-amber-500/6 border-amber-500/15",
      title: `Créditos baixos — ${pct}% restantes`,
      body: `Você tem ${creditsLeft} créditos este mês. Atualize para o Rubi: ${PLAN_CREDITS.pro.toLocaleString()}+ créditos e acesso prioritário.`,
      cta: "Ver planos",
      accentCta: false,
    },
    power: {
      icon: <TrendingUp className="w-4 h-4 text-primary shrink-0" />,
      bg: "bg-primary/6 border-primary/20",
      title: `Você é um usuário avançado`,
      body: `${totalActions} execuções e contando. O plano Rubi oferece ${PLAN_CREDITS.pro.toLocaleString()} créditos/mês — muito mais potência.`,
      cta: "Desbloquear Rubi",
      accentCta: true,
    },
  };

  const cfg = configs[variant];

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="nudge"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden mb-5"
        >
          <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${cfg.bg}`}>
            {cfg.icon}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white mb-0.5">{cfg.title}</p>
              <p className="text-xs text-zinc-400 leading-relaxed">{cfg.body}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => setShowComparison(true)}
                className={`h-7 text-[11px] px-3 ${
                  cfg.accentCta
                    ? "bg-primary text-black hover:bg-primary/90 font-semibold"
                    : "bg-white/8 text-zinc-200 hover:bg-white/12 border border-white/10"
                }`}
              >
                <Crown className="w-3 h-3 mr-1" />
                {cfg.cta}
              </Button>
              <button
                onClick={() => setDismissed(true)}
                className="p-1 text-zinc-600 hover:text-zinc-300 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <PlanComparisonModal
        open={showComparison}
        onClose={() => setShowComparison(false)}
        highlightPlan="pro"
      />
    </>
  );
}
