import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Check, Zap, Star, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  useGetStripePlans,
  getGetStripePlansQueryKey,
  useCreateCheckoutSession,
} from "@workspace/api-client-react";
import { PLAN_CREDITS } from "@/lib/credits";
import { useToast } from "@/hooks/use-toast";

type PlanKey = "free" | "pro" | "business" | "agency";

const PLAN_ORDER: PlanKey[] = ["free", "pro", "business", "agency"];

const PLAN_DISPLAY: Record<PlanKey, {
  name: string;
  price: string;
  tagline: string;
  color: string;
  border: string;
  glow: string;
  badgeColor: string;
  btnClass: string;
  features: string[];
}> = {
  free: {
    name: "Cristal",
    price: "R$19,90/mês",
    tagline: "Clareza e começo",
    color: "text-sky-100",
    border: "border-sky-300/20",
    glow: "shadow-[0_0_40px_rgba(186,230,253,0.06)]",
    badgeColor: "bg-sky-500/10 text-sky-200 border-sky-300/20",
    btnClass: "bg-sky-400/15 hover:bg-sky-400/25 text-sky-100 border border-sky-300/25",
    features: [
      "50 créditos por mês",
      "Todos os módulos de IA",
      "Histórico básico",
      "Suporte por email",
    ],
  },
  pro: {
    name: "Rubi",
    price: "R$89/mês",
    tagline: "Energia e crescimento",
    color: "text-rose-400",
    border: "border-rose-500/40",
    glow: "shadow-[0_0_40px_rgba(244,63,94,0.09)]",
    badgeColor: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    btnClass: "bg-rose-600 hover:bg-rose-500 text-white font-bold",
    features: [
      "500 créditos por mês",
      "Analytics avançado",
      "Suporte prioritário",
      "Bônus de indicação 2×",
    ],
  },
  business: {
    name: "Esmeralda",
    price: "R$197/mês",
    tagline: "Inteligência e expansão",
    color: "text-emerald-400",
    border: "border-emerald-500/40",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.09)]",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    btnClass: "bg-emerald-600 hover:bg-emerald-500 text-white font-bold",
    features: [
      "2.000 créditos por mês",
      "Tudo do Rubi",
      "Relatórios exportáveis",
      "Suporte dedicado",
    ],
  },
  agency: {
    name: "Diamante",
    price: "R$497/mês",
    tagline: "Elite e máximo poder",
    color: "text-slate-100",
    border: "border-slate-300/25",
    glow: "shadow-[0_0_50px_rgba(226,232,240,0.07)]",
    badgeColor: "bg-white/10 text-slate-200 border-white/20",
    btnClass: "bg-gradient-to-br from-slate-100 to-white hover:from-white hover:to-slate-200 text-black font-bold",
    features: [
      "10.000 créditos por mês",
      "Tudo do Esmeralda",
      "Multi-workspace",
      "Acesso à API",
    ],
  },
};

function onboardingKey(userId: string) {
  return `iattom_onboarded_${userId}`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.35 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 22, stiffness: 260 },
  },
};

export function Onboarding() {
  const [, navigate] = useLocation();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const [selecting, setSelecting] = useState<PlanKey | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (localStorage.getItem(onboardingKey(user.id))) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoaded, user]);

  const { data: stripePlans = [] } = useGetStripePlans({
    query: {
      queryKey: getGetStripePlansQueryKey(),
      retry: false,
      staleTime: 60_000,
    },
  });

  const checkout = useCreateCheckoutSession({
    mutation: {
      onSuccess: (data) => {
        if (data.url) window.location.href = data.url;
      },
      onError: () => {
        setSelecting(null);
        toast({
          title: "Erro ao iniciar checkout",
          description: "Tente novamente em instantes.",
          variant: "destructive",
        });
      },
    },
  });

  const handleSelect = (planKey: PlanKey) => {
    if (!user || selecting) return;

    const stripePlan = stripePlans.find((p) => p.planKey === planKey);
    if (!stripePlan?.priceId) {
      toast({
        title: "Plano em configuração",
        description: "Este plano será disponibilizado em breve.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem(onboardingKey(user.id), "1");
    setSelecting(planKey);
    checkout.mutate({ data: { priceId: stripePlan.priceId, planKey } });
  };

  if (!isLoaded) return null;

  return (
    <div className="relative min-h-[100dvh] bg-[#0a0a0a] flex flex-col items-center px-4 py-14 overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 inset-x-0 h-[45vh]"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.11) 0%, transparent 65%)",
          }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-[30vh]"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(201,168,76,0.04) 0%, transparent 65%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-12"
        >
          <img
            src="/iattom-logo-transparent.png"
            alt="iAttom"
            className="w-11 h-11 opacity-85"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.1,
              type: "spring",
              damping: 16,
              stiffness: 280,
            }}
            className="inline-flex items-center justify-center w-[60px] h-[60px] rounded-full bg-primary/10 border border-primary/25 mb-5"
          >
            <CheckCircle2 className="w-7 h-7 text-primary" />
          </motion.div>

          <h1 className="text-[28px] font-black text-white tracking-tight leading-none mb-2.5">
            Conta criada com sucesso
          </h1>
          <p className="text-[13px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Escolha seu plano para desbloquear o iAttom Assist.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full"
        >
          {PLAN_ORDER.map((planKey) => {
            const plan = PLAN_DISPLAY[planKey];
            const isRecommended = planKey === "pro";
            const isPending = selecting === planKey;

            return (
              <motion.div
                key={planKey}
                variants={cardVariants}
                className={`relative rounded-2xl border bg-[#111111] p-5 flex flex-col ${plan.border} ${plan.glow}`}
              >
                {isRecommended && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-[3px] rounded-b-lg bg-rose-600 text-white tracking-wide">
                      <Star className="w-2.5 h-2.5 fill-white" />
                      RECOMENDADO
                    </span>
                  </div>
                )}

                <div className="mb-4 mt-2">
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${plan.color}`}>
                    {plan.name}
                  </p>
                  <p className="text-[26px] font-black text-white tracking-tight leading-none">
                    {plan.price}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1 tracking-wide">
                    {plan.tagline}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 mb-4 px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <Zap className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />
                  <span className="text-[11px] font-semibold text-zinc-300">
                    {PLAN_CREDITS[planKey].toLocaleString()} créditos / mês
                  </span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className={`w-3.5 h-3.5 shrink-0 mt-[1px] ${plan.color}`} />
                      <span className="text-[12px] text-zinc-400 leading-snug">
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(planKey)}
                  disabled={!!selecting}
                  className={`w-full h-[42px] rounded-xl text-[12px] transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${plan.btnClass}`}
                >
                  {isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    `Assinar ${plan.name}`
                  )}
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="text-center text-[11px] text-zinc-600 mt-9 tracking-wide"
        >
          Pagamento seguro via Stripe · Cancele quando quiser · Créditos renovam todo mês
        </motion.p>
      </div>
    </div>
  );
}
