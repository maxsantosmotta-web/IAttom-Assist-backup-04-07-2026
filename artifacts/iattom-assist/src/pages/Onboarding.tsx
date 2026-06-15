import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser, useAuth } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Zap, Star, RefreshCw, CheckCircle2, ChevronDown, Shield,
  HeadphonesIcon, CreditCard, ArrowUpCircle, XCircle, LayoutGrid,
} from "lucide-react";
import {
  useGetStripePlans,
  getGetStripePlansQueryKey,
  useCreateCheckoutSession,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { PLAN_CREDITS } from "@/lib/credits";
import { useToast } from "@/hooks/use-toast";

type PlanKey = "free" | "pro" | "business" | "agency";

const PLAN_ORDER: PlanKey[] = ["free", "pro", "business", "agency"];

const PLAN_DISPLAY: Record<PlanKey, {
  name: string;
  price: string;
  monthlyLabel: string;
  tagline: string;
  color: string;
  border: string;
  activeBorder: string;
  glow: string;
  badgeColor: string;
  btnClass: string;
  checkColor: string;
  features: string[];
}> = {
  free: {
    name: "Cristal",
    price: "R$19,90",
    monthlyLabel: "/mês",
    tagline: "Clareza e começo",
    color: "text-sky-200",
    border: "border-sky-300/15",
    activeBorder: "border-sky-400/40",
    glow: "hover:shadow-[0_0_40px_-8px_rgba(186,230,253,0.15)]",
    badgeColor: "bg-sky-500/10 text-sky-200 border-sky-300/20",
    btnClass: "bg-sky-400/15 hover:bg-sky-400/25 text-sky-100 border border-sky-300/25 hover:border-sky-300/50",
    checkColor: "text-sky-300",
    features: [
      "50 créditos por mês",
      "Todos os módulos",
      "Histórico básico",
      "Suporte por email",
    ],
  },
  pro: {
    name: "Rubi",
    price: "R$89",
    monthlyLabel: "/mês",
    tagline: "Energia e crescimento",
    color: "text-rose-400",
    border: "border-rose-500/30",
    activeBorder: "border-rose-500/70",
    glow: "hover:shadow-[0_0_50px_-8px_rgba(244,63,94,0.25)]",
    badgeColor: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    btnClass: "bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-[0_4px_20px_-4px_rgba(244,63,94,0.5)] hover:shadow-[0_4px_24px_-4px_rgba(244,63,94,0.7)]",
    checkColor: "text-rose-400",
    features: [
      "500 créditos por mês",
      "Analytics avançado",
      "Suporte prioritário",
      "Bônus de indicação 2×",
    ],
  },
  business: {
    name: "Esmeralda",
    price: "R$197",
    monthlyLabel: "/mês",
    tagline: "Inteligência e expansão",
    color: "text-emerald-400",
    border: "border-emerald-500/25",
    activeBorder: "border-emerald-500/60",
    glow: "hover:shadow-[0_0_50px_-8px_rgba(16,185,129,0.2)]",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    btnClass: "bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-[0_4px_20px_-4px_rgba(16,185,129,0.4)] hover:shadow-[0_4px_24px_-4px_rgba(16,185,129,0.6)]",
    checkColor: "text-emerald-400",
    features: [
      "2.000 créditos por mês",
      "Tudo do Rubi",
      "Relatórios exportáveis",
      "Suporte dedicado",
    ],
  },
  agency: {
    name: "Diamante",
    price: "R$497",
    monthlyLabel: "/mês",
    tagline: "Elite e máximo poder",
    color: "text-slate-100",
    border: "border-slate-300/15",
    activeBorder: "border-slate-300/50",
    glow: "hover:shadow-[0_0_50px_-8px_rgba(226,232,240,0.12)]",
    badgeColor: "bg-white/10 text-slate-200 border-white/20",
    btnClass: "bg-gradient-to-br from-slate-100 to-white hover:from-white hover:to-slate-200 text-black font-bold shadow-[0_4px_20px_-4px_rgba(226,232,240,0.2)]",
    checkColor: "text-slate-300",
    features: [
      "10.000 créditos por mês",
      "Tudo do Esmeralda",
      "Multi-workspace",
      "Acesso à API",
    ],
  },
};

const FAQ_ITEMS = [
  {
    icon: Zap,
    q: "O que são créditos e como funcionam?",
    a: "Créditos são a moeda interna do iAttom Assist. Cada execução consome uma quantidade de créditos conforme a complexidade da tarefa. Seu saldo renova automaticamente no início de cada ciclo mensal, sem acúmulo de saldo anterior.",
  },
  {
    icon: XCircle,
    q: "Posso cancelar minha assinatura quando quiser?",
    a: "Sim. Você pode cancelar a qualquer momento pelo painel de faturamento, sem multas ou taxa de cancelamento. Seu plano permanece ativo até o fim do período já pago.",
  },
  {
    icon: LayoutGrid,
    q: "Todos os planos têm acesso aos módulos?",
    a: "Sim. Todos os planos — incluindo o Cristal — têm acesso a todos os 6 módulos: Encontrar Produtos, Validar Produtos, Criar Campanha, Criar Conteúdo, Gerador de Criativos e Roteiros de Vídeo. A diferença está na quantidade de créditos disponíveis por mês.",
  },
  {
    icon: ArrowUpCircle,
    q: "Posso fazer upgrade ou downgrade do meu plano?",
    a: "Sim. Você pode mudar de plano a qualquer momento pelo painel de faturamento. O upgrade é imediato e o valor é calculado proporcionalmente. O downgrade ocorre no próximo ciclo de cobrança.",
  },
  {
    icon: Shield,
    q: "Meus dados e pagamentos são seguros?",
    a: "Sim. Os pagamentos são processados exclusivamente pela Stripe, líder global em segurança de pagamentos — certificada PCI DSS nível 1. O iAttom Assist nunca armazena dados do seu cartão.",
  },
  {
    icon: HeadphonesIcon,
    q: "Como funciona o suporte em cada plano?",
    a: "O plano Cristal inclui suporte por email com tempo de resposta padrão. O Rubi e o Esmeralda têm suporte prioritário com respostas mais rápidas. O Diamante conta com suporte dedicado e atendimento personalizado.",
  },
  {
    icon: CreditCard,
    q: "O que acontece se eu esgotar todos os créditos antes do fim do mês?",
    a: "Quando seus créditos acabam, as execuções ficam pausadas até a renovação mensal. Você pode fazer upgrade de plano a qualquer momento para obter mais créditos imediatamente, ou aguardar o próximo ciclo.",
  },
];

function onboardingKey(userId: string) {
  return `iattom_onboarded_${userId}`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, damping: 20, stiffness: 240 },
  },
};

const faqVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 24, stiffness: 220 },
  },
};

function FaqItem({ item, index }: { item: typeof FAQ_ITEMS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      variants={faqVariants}
      className="border border-white/[0.07] rounded-xl overflow-hidden bg-white/[0.02]"
      style={{ transitionDelay: `${index * 40}ms` }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left group"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <item.icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-200 leading-snug group-hover:text-white transition-colors">
            {item.q}
          </span>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 pt-1 text-[12.5px] text-zinc-400 leading-relaxed pl-[60px]">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Onboarding() {
  const [, navigate] = useLocation();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [selecting, setSelecting] = useState<PlanKey | null>(null);

  const { data: me, isLoading: meLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 0 },
  });

  useEffect(() => {
    if (!isLoaded || !user || meLoading || me === undefined) return;
    const isAdmin = me?.role === "admin";
    const hasPaidPlan = me?.plan !== undefined && me.plan !== "free";
    const hasSelectedFree = me?.betaAccess === true;
    if (isAdmin || hasPaidPlan || hasSelectedFree) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoaded, user, me, meLoading]);

  const { data: stripePlans = [] } = useGetStripePlans({
    query: { queryKey: getGetStripePlansQueryKey(), retry: false, staleTime: 60_000 },
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

  const handleSelect = async (planKey: PlanKey) => {
    if (!user || selecting) return;

    if (planKey === "free") {
      setSelecting("free");
      try {
        const token = await getToken();
        await fetch(`${import.meta.env.BASE_URL}api/user/select-plan`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        localStorage.setItem(onboardingKey(user.id), "1");
        navigate("/dashboard", { replace: true });
      } catch {
        setSelecting(null);
        toast({ title: "Erro ao selecionar plano", description: "Tente novamente em instantes.", variant: "destructive" });
      }
      return;
    }

    const stripePlan = stripePlans.find((p) => p.planKey === planKey);
    if (!stripePlan?.priceId) {
      toast({ title: "Plano indisponível", description: "Não foi possível iniciar o checkout. Tente novamente.", variant: "destructive" });
      return;
    }
    localStorage.setItem(onboardingKey(user.id), "1");
    setSelecting(planKey);
    checkout.mutate({ data: { priceId: stripePlan.priceId, planKey } });
  };

  if (!isLoaded) return null;

  return (
    <div className="relative min-h-[100dvh] bg-[#0a0a0a] flex flex-col items-center px-4 sm:px-6 py-14 overflow-x-hidden">

      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 inset-x-0 h-[55vh]"
          style={{
            background:
              "radial-gradient(ellipse 90% 65% at 50% -5%, rgba(201,168,76,0.13) 0%, transparent 68%)",
          }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-[35vh]"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(201,168,76,0.04) 0%, transparent 65%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <img
            src="/logo-nobg.png"
            alt="IAttom Assist"
            className="w-10 h-10 object-contain"
          />
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-14"
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", damping: 16, stiffness: 280 }}
            className="inline-flex items-center justify-center w-[58px] h-[58px] rounded-full bg-primary/10 border border-primary/25 mb-5"
          >
            <CheckCircle2 className="w-6.5 h-6.5 text-primary" />
          </motion.div>

          <h1 className="text-3xl sm:text-[32px] font-black text-white tracking-tight leading-none mb-3">
            Conta criada com sucesso
          </h1>
          <p className="text-[13.5px] text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Escolha seu plano e comece a usar o iAttom Assist agora mesmo.
          </p>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-5 mt-5 flex-wrap">
            {[
              { icon: Shield, label: "Pagamento seguro via Stripe" },
              { icon: RefreshCw, label: "Cancele quando quiser" },
              { icon: Zap, label: "Créditos renovam todo mês" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="w-3 h-3 text-primary/70" />
                <span className="text-[11px] text-zinc-500 tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Plan cards */}
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
            const credits = PLAN_CREDITS[planKey];

            return (
              <motion.div
                key={planKey}
                variants={cardVariants}
                className={`relative rounded-2xl border bg-[#111111] p-5 flex flex-col transition-all duration-300 ${plan.glow} ${
                  isRecommended
                    ? `${plan.activeBorder} ring-1 ring-rose-500/20 bg-[#130d0d]`
                    : plan.border
                }`}
              >
                {/* Recommended top line */}
                {isRecommended && (
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />
                )}

                {/* Badge */}
                {isRecommended && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-[3.5px] rounded-b-lg bg-rose-600 text-white tracking-widest uppercase">
                      <Star className="w-2.5 h-2.5 fill-white" />
                      Recomendado
                    </span>
                  </div>
                )}

                {/* Plan name + tagline */}
                <div className="mb-4 mt-3">
                  <span className={`inline-block text-[10px] font-black uppercase tracking-[0.18em] mb-2 px-2 py-0.5 rounded-md border ${plan.badgeColor}`}>
                    {plan.name}
                  </span>
                  <div className="flex items-baseline gap-0.5 mb-1">
                    <span className="text-[28px] font-black text-white tracking-tight leading-none">
                      {plan.price}
                    </span>
                    <span className="text-[12px] text-zinc-500 ml-0.5">{plan.monthlyLabel}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 tracking-wide">
                    {plan.tagline}
                  </p>
                </div>

                {/* Credits pill */}
                <div className={`flex items-center gap-1.5 mb-5 px-3 py-2 rounded-lg border ${
                  isRecommended
                    ? "bg-primary/8 border-primary/20"
                    : "bg-white/[0.035] border-white/[0.07]"
                }`}>
                  <Zap className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />
                  <span className="text-[11.5px] font-bold text-zinc-200">
                    {credits.toLocaleString("pt-BR")} créditos / mês
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className={`w-3.5 h-3.5 shrink-0 mt-[2px] ${plan.checkColor}`} />
                      <span className="text-[12px] text-zinc-400 leading-snug">
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleSelect(planKey)}
                  disabled={!!selecting}
                  className={`w-full h-[44px] rounded-xl text-[12.5px] tracking-wide transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${plan.btnClass}`}
                >
                  {isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    `Assinar ${plan.name}`
                  )}
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom trust note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="text-center text-[11px] text-zinc-600 mt-7 tracking-wide"
        >
          Pagamento seguro via Stripe · Cancele quando quiser · Créditos renovam todo mês
        </motion.p>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5, ease: "easeOut" }}
          className="w-full mt-20"
        >
          {/* Divider */}
          <div className="flex items-center gap-4 mb-10">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/70 mb-0.5">
                Perguntas frequentes
              </p>
              <h2 className="text-[19px] font-bold text-white tracking-tight">
                Tudo que você precisa saber
              </h2>
            </div>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2"
          >
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={item.q} item={item} index={i} />
            ))}
          </motion.div>

          {/* Support note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="mt-10 rounded-xl border border-primary/15 bg-primary/[0.04] px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
          >
            <div>
              <p className="text-[13px] font-semibold text-zinc-200 mb-1">
                Ainda tem dúvidas?
              </p>
              <p className="text-[12px] text-zinc-500">
                Nossa equipe está pronta para ajudar você a escolher o plano ideal.
              </p>
            </div>
            <a
              href="mailto:suporte@iattom.com"
              className="shrink-0 inline-flex items-center gap-2 text-[12px] font-semibold text-primary hover:text-primary/80 border border-primary/25 hover:border-primary/50 px-4 py-2 rounded-lg transition-all duration-200 hover:bg-primary/5"
            >
              <HeadphonesIcon className="w-3.5 h-3.5" />
              Falar com suporte
            </a>
          </motion.div>

          <p className="text-center text-[10.5px] text-zinc-700 mt-8 pb-4 tracking-wide">
            iAttom Assist · Pagamentos processados com segurança via Stripe · PCI DSS nível 1
          </p>
        </motion.div>

      </div>
    </div>
  );
}
