import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Crown, Check, Zap, ExternalLink, AlertTriangle, RefreshCw,
  CreditCard, Gift, TrendingUp, Star, Lock,
  Sparkles, Building2, Rocket, CircleSlash, ShoppingCart, Plus, Film, Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetStripePlans, getGetStripePlansQueryKey,
  useGetStripeSubscription, getGetStripeSubscriptionQueryKey,
  useCreateCheckoutSession, useCreateBillingPortal,
  useGetMe, getGetMeQueryKey,
  useGetCreditsBalance, getGetCreditsBalanceQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";
import { PLAN_CREDITS, PLAN_NAMES, PLAN_PRICES, PLAN_SAVINGS } from "@/lib/credits";

/* ─── credit packages ────────────────────────────────────────────────── */
const CREDIT_PACKAGES = [
  { id: "credits_300",  credits: 300,  label: "300",   price: "R$ 39,90",  tag: "Acessível",   perUnit: "" },
  { id: "credits_700",  credits: 700,  label: "700",   price: "R$ 79,90",  tag: "Vantagem",    perUnit: "" },
  { id: "credits_1500", credits: 1500, label: "1.500", price: "R$ 149,90", tag: "Melhor Valor", perUnit: "" },
] as const;

/* ─── image packages ─────────────────────────────────────────────────── */
const IMAGE_PACKAGES = [
  {
    id: "creative_20", tag: "CRIATIVO 20", images: 20, price: "R$ 47,00",
    bg: "bg-[#0a080e]",
    border: "border-violet-500/50 shadow-[0_0_36px_-6px_rgba(139,92,246,0.22)] hover:shadow-[0_0_44px_-6px_rgba(139,92,246,0.30)]",
    topLine: "via-violet-400/70",
    ambient: "from-violet-500/[0.06]",
    badge: "bg-violet-600 text-white shadow-[0_2px_8px_rgba(139,92,246,0.35)]",
    iconBg: "bg-violet-500/15 border border-violet-500/30",
    iconColor: "text-violet-400",
    labelColor: "text-violet-400",
    btn: "bg-violet-600 text-white hover:bg-violet-500 font-bold",
  },
  {
    id: "creative_35", tag: "CRIATIVO 35", images: 35, price: "R$ 79,00",
    bg: "bg-[#040b07]",
    border: "border-emerald-700/40 hover:border-emerald-700/55 shadow-[0_0_36px_-4px_rgba(6,78,59,0.25)]",
    topLine: "via-emerald-600/40",
    ambient: "from-emerald-800/[0.06]",
    badge: "bg-emerald-800 text-emerald-200",
    iconBg: "bg-emerald-800/25 border border-emerald-700/30",
    iconColor: "text-emerald-400",
    labelColor: "text-emerald-400",
    btn: "bg-emerald-800 text-white hover:bg-emerald-700 font-bold",
  },
  {
    id: "creative_50", tag: "CRIATIVO 50", images: 50, price: "R$ 89,00",
    bg: "bg-[#0e0c06]",
    border: "border-[#C9A84C]/55 shadow-[0_0_36px_-4px_rgba(201,168,76,0.20)] hover:shadow-[0_0_44px_-4px_rgba(201,168,76,0.28)]",
    topLine: "via-[#C9A84C]/60",
    ambient: "from-[#C9A84C]/[0.06]",
    badge: "bg-[#C9A84C] text-black shadow-[0_2px_8px_rgba(201,168,76,0.35)]",
    iconBg: "bg-[#C9A84C]/15 border border-[#C9A84C]/30",
    iconColor: "text-[#E8C96A]",
    labelColor: "text-[#E8C96A]",
    btn: "bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black hover:brightness-110 font-black",
  },
] as const;

/* ─── video packages ─────────────────────────────────────────────────── */
const VIDEO_PACKAGES = [
  {
    id: "video_5",  tag: "PACK 5",  videos: 5,  price: "R$ 67,00",
    bg: "bg-[#060a10]",
    border: "border-blue-400/20 hover:border-blue-400/35",
    topLine: "via-blue-400/25",
    ambient: "from-blue-500/[0.03]",
    badge: "bg-blue-500/10 text-blue-300 border border-blue-400/20 border-t-0",
    iconBg: "bg-blue-500/12 border border-blue-400/20",
    iconColor: "text-blue-300",
    labelColor: "text-blue-300",
    btn: "bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 border border-blue-400/25",
  },
  {
    id: "video_7",  tag: "PACK 7",  videos: 7,  price: "R$ 89,00",
    bg: "bg-[#0a080e]",
    border: "border-violet-500/50 shadow-[0_0_36px_-6px_rgba(139,92,246,0.22)] hover:shadow-[0_0_44px_-6px_rgba(139,92,246,0.30)]",
    topLine: "via-violet-400/70",
    ambient: "from-violet-500/[0.06]",
    badge: "bg-violet-600 text-white shadow-[0_2px_8px_rgba(139,92,246,0.35)]",
    iconBg: "bg-violet-500/15 border border-violet-500/30",
    iconColor: "text-violet-400",
    labelColor: "text-violet-400",
    btn: "bg-violet-600 text-white hover:bg-violet-500 font-bold",
  },
  {
    id: "video_10", tag: "PACK 10", videos: 10, price: "R$ 137,00",
    bg: "bg-[#050e09]",
    border: "border-emerald-500/30 hover:border-emerald-500/45 shadow-[0_0_36px_-4px_rgba(16,185,129,0.16)]",
    topLine: "via-emerald-400/50",
    ambient: "from-emerald-500/[0.04]",
    badge: "bg-emerald-600 text-white",
    iconBg: "bg-emerald-500/10 border border-emerald-500/25",
    iconColor: "text-emerald-400",
    labelColor: "text-emerald-400",
    btn: "bg-emerald-600 text-white hover:bg-emerald-500 font-bold",
  },
] as const;

/* ─── plan visual tokens ─────────────────────────────────────────────── */
const PLAN_COLORS: Record<string, string> = {
  free:     "text-blue-300",
  pro:      "text-emerald-400",
  business: "text-violet-400",
  agency:   "text-[#E8C96A]",
};
const PLAN_BORDER: Record<string, string> = {
  free:     "border-blue-400/20",
  pro:      "border-emerald-500/30",
  business: "border-violet-500/30",
  agency:   "border-[#C9A84C]/55",
};
const PLAN_BADGE_STYLE: Record<string, string> = {
  free:     "bg-blue-500/10 text-blue-200 border-blue-400/20",
  pro:      "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  business: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  agency:   "bg-[#C9A84C]/20 text-[#E8C96A] border-[#C9A84C]/40",
};
const PLAN_BTN_STYLE: Record<string, string> = {
  free:     "bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 border border-blue-400/25",
  pro:      "bg-emerald-600 text-white hover:bg-emerald-500 font-bold",
  business: "bg-violet-600 text-white hover:bg-violet-500 font-bold",
  agency:   "bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black hover:brightness-110 font-black",
};
const PLAN_GLOW: Record<string, string> = {
  free:     "",
  pro:      "shadow-[0_0_36px_-4px_rgba(16,185,129,0.16)]",
  business: "",
  agency:   "",
};
const PLAN_ICON: Record<string, React.FC<{ className?: string }>> = {
  free:     ({ className }) => <Zap className={className} />,
  pro:      ({ className }) => <TrendingUp className={className} />,
  business: ({ className }) => <Sparkles className={className} />,
  agency:   ({ className }) => <Building2 className={className} />,
};
/* ─── credit package → plan scheme mapping ──────────────────────────── */
const CREDIT_SCHEME: Record<string, "free" | "pro" | "business" | "agency"> = {
  credits_100:  "free",
  credits_300:  "pro",
  credits_700:  "business",
  credits_1500: "agency",
};

const CREDIT_CARD_BG: Record<string, string> = {
  free:     "bg-[#060a10]",
  pro:      "bg-[#050e09]",
  business: "bg-[#0a080e]",
  agency:   "bg-[#0e0c06]",
};
const CREDIT_CARD_BORDER: Record<string, string> = {
  free:     "border-blue-400/20 hover:border-blue-400/35",
  pro:      "border-emerald-500/30 hover:border-emerald-500/45 shadow-[0_0_36px_-4px_rgba(16,185,129,0.16)]",
  business: "border-violet-500/50 shadow-[0_0_36px_-6px_rgba(139,92,246,0.22),0_0_0_1px_rgba(139,92,246,0.08)] hover:shadow-[0_0_44px_-6px_rgba(139,92,246,0.30)]",
  agency:   "border-[#C9A84C]/55 shadow-[0_0_36px_-4px_rgba(201,168,76,0.20)] hover:shadow-[0_0_44px_-4px_rgba(201,168,76,0.28)]",
};
const CREDIT_TOP_LINE: Record<string, string> = {
  free:     "via-blue-400/25",
  pro:      "via-emerald-400/50",
  business: "via-violet-400/70",
  agency:   "via-[#C9A84C]/60",
};
const CREDIT_AMBIENT: Record<string, string> = {
  free:     "from-blue-500/[0.03]",
  pro:      "from-emerald-500/[0.04]",
  business: "from-violet-500/[0.06]",
  agency:   "from-[#C9A84C]/[0.06]",
};
const CREDIT_BADGE: Record<string, string> = {
  free:     "bg-blue-500/10 text-blue-300 border border-blue-400/20 border-t-0",
  pro:      "bg-emerald-600 text-white",
  business: "bg-violet-600 text-white shadow-[0_2px_8px_rgba(139,92,246,0.35)]",
  agency:   "bg-[#C9A84C] text-black shadow-[0_2px_8px_rgba(201,168,76,0.35)]",
};
const CREDIT_ICON_BG: Record<string, string> = {
  free:     "bg-blue-500/12 border border-blue-400/20",
  pro:      "bg-emerald-500/10 border border-emerald-500/25",
  business: "bg-violet-500/15 border border-violet-500/30",
  agency:   "bg-[#C9A84C]/15 border border-[#C9A84C]/30",
};
const CREDIT_ICON_COLOR: Record<string, string> = {
  free:     "text-blue-300",
  pro:      "text-emerald-400",
  business: "text-violet-400",
  agency:   "text-[#E8C96A]",
};
const CREDIT_ICON_CMP: Record<string, React.FC<{ className?: string }>> = {
  free:     ({ className }) => <Zap className={className} />,
  pro:      ({ className }) => <TrendingUp className={className} />,
  business: ({ className }) => <Sparkles className={className} />,
  agency:   ({ className }) => <Building2 className={className} />,
};
const CREDIT_LABEL_COLOR: Record<string, string> = {
  free:     "text-blue-300",
  pro:      "text-emerald-400",
  business: "text-violet-400",
  agency:   "text-[#E8C96A]",
};
const CREDIT_PERUNIT_COLOR: Record<string, string> = {
  free:     "text-blue-400/50",
  pro:      "text-emerald-400/50",
  business: "text-violet-400/60",
  agency:   "text-[#C9A84C]/60",
};
const CREDIT_BTN: Record<string, string> = {
  free:     "bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 border border-blue-400/25",
  pro:      "bg-emerald-600 text-white hover:bg-emerald-500 font-bold",
  business: "bg-violet-600 text-white hover:bg-violet-500 font-bold",
  agency:   "bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black hover:brightness-110 font-black",
};

const PLAN_DESC: Record<string, string> = {
  free:     "Plano de demonstração para conhecer o IAttom Assist antes de contratar um plano pago.",
  pro:      "Ideal para quem deseja começar a criar campanhas, imagens e utilizar os principais recursos do IAttom Assist.",
  business: "Mais controle, mais produção, mais oportunidades de venda.",
  agency:   "Todos os recursos do IAttom Assist para criar, validar, publicar e escalar com máxima capacidade.",
};
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: "Ativo",               color: "text-emerald-400" },
  trialing: { label: "Trial",               color: "text-blue-400"    },
  past_due: { label: "Pagamento em atraso", color: "text-amber-400"   },
  canceled: { label: "Cancelado",           color: "text-red-400"     },
  unpaid:   { label: "Não pago",            color: "text-red-400"     },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { year: "numeric", month: "short", day: "numeric" });
}

/* ─── billing toggle ─────────────────────────────────────────────────── */
function BillingToggle({ value, onChange }: { value: "monthly" | "annual"; onChange: (v: "monthly" | "annual") => void }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
      {(["monthly", "annual"] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11.5px] font-semibold tracking-wide transition-all duration-200 ${
            value === opt ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {opt === "monthly" ? "Mensal" : "Anual"}
          {opt === "annual" && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 tracking-widest">
              economize até 20%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────────── */
export function Billing() {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [showComparison, setShowComparison] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const { data: plans = [], isLoading: plansLoading, isFetching: fetchingPlans, refetch: refetchPlans } = useGetStripePlans({
    query: { queryKey: getGetStripePlansQueryKey(), retry: false, staleTime: 0 },
  });
  const { data: subscription, isLoading: subLoading, isFetching: fetchingSub, refetch: refetchSub } = useGetStripeSubscription({
    query: { queryKey: getGetStripeSubscriptionQueryKey(), retry: false, staleTime: 0 },
  });
  const { data: me, isFetching: fetchingMe, refetch: refetchMe } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 0 } });
  const { data: creditsData, isFetching: fetchingCredits, refetch: refetchCredits } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), retry: false, staleTime: 0 },
  });
  const isBillingFetching = fetchingPlans || fetchingSub || fetchingMe || fetchingCredits;
  const handleBillingRefresh = () => { void refetchPlans(); void refetchSub(); void refetchMe(); void refetchCredits(); };

  const checkout = useCreateCheckoutSession({
    mutation: {
      onSuccess: (data) => { if (data.url) window.location.href = data.url; },
      onError: () => toast({ title: "Não foi possível iniciar o upgrade", description: "Tente novamente em alguns instantes.", variant: "destructive" }),
    },
  });
  const portal = useCreateBillingPortal({
    mutation: {
      onSuccess: (data) => { if (data.url) window.location.href = data.url; },
      onError: () => toast({ title: "Portal indisponível", description: "Não foi possível abrir o portal. Tente novamente.", variant: "destructive" }),
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId) {
      void (async () => {
        try {
          const response = await fetch("/api/stripe/reconcile-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ sessionId }),
          });

          const result = await response.json() as { ok?: boolean; message?: string };

          if (!response.ok || result.ok === false) {
            throw new Error(result.message ?? "Falha ao reconciliar pagamento");
          }

          await Promise.all([
            refetchSub(),
            refetchMe(),
            refetchCredits(),
          ]);

          toast({
            title: "Pagamento realizado",
            description: "Seu plano foi ativado e os benefícios foram adicionados à sua conta.",
          });

          window.history.replaceState({}, "", window.location.pathname);
        } catch {
          toast({
            title: "Pagamento aprovado",
            description: "A liberação dos benefícios ainda está sendo finalizada. Use o botão Atualizar em alguns instantes.",
            variant: "destructive",
          });
        }
      })();
    } else if (payment === "credits_success") {
      toast({ title: "Créditos adicionados", description: "Seus créditos foram somados ao saldo da conta." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "video_success") {
      toast({ title: "Pacote de vídeos adicionado", description: "Seus vídeos foram adicionados ao saldo da conta." });
      window.history.replaceState({}, "", window.location.pathname);
      fetch("/api/videos/balance", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setVideoBalance((d as { videoBalance: number }).videoBalance ?? 0))
        .catch(() => {});
    } else if (payment === "canceled") {
      toast({ title: "Checkout cancelado", description: "Nenhuma cobrança foi realizada." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location, refetchCredits, refetchMe, refetchSub, toast]);

  const currentPlan  = me?.plan ?? "free";
  const hasActiveSub = subscription?.hasSubscription === true;
  const subStatus    = subscription?.status;
  const isLoading    = plansLoading || subLoading;

  const creditsLeft = creditsData?.balance ?? 0;
  const planLimit   = PLAN_CREDITS[currentPlan as keyof typeof PLAN_CREDITS] ?? 50;

  const PLAN_ORDER  = ["free", "pro", "business", "agency"];
  const sortedPlans = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));

  const [freePending, setFreePending] = useState(false);
  const [creditsPending, setCreditsPending] = useState<string | null>(null);
  const [videoPending, setVideoPending] = useState<string | null>(null);
  const [imagePending, setImagePending] = useState<string | null>(null);
  const [videoBalance, setVideoBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/videos/balance", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setVideoBalance((d as { videoBalance: number }).videoBalance ?? 0))
      .catch(() => setVideoBalance(0));
  }, []);

  const handleBuyImagePack = async (packId: string) => {
    if (currentPlan === "free") {
      setShowComparison(true);
      return;
    }
    setImagePending(packId);
    try {
      const resp = await fetch("/api/stripe/creatives/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: packId }),
        credentials: "include",
      });
      const data = await resp.json() as { url?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "checkout error");
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Não foi possível iniciar o checkout", description: "Tente novamente em alguns instantes.", variant: "destructive" });
    } finally {
      setImagePending(null);
    }
  };

  const handleBuyVideoPack = async (packId: string) => {
    if (currentPlan === "free") {
      setShowComparison(true);
      return;
    }
    setVideoPending(packId);
    try {
      const resp = await fetch("/api/stripe/videos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: packId }),
        credentials: "include",
      });
      const data = await resp.json() as { url?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "checkout error");
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Não foi possível iniciar o checkout", description: "Tente novamente em alguns instantes.", variant: "destructive" });
    } finally {
      setVideoPending(null);
    }
  };

  const handleBuyCredits = async (packageId: string) => {
    if (currentPlan === "free") {
      setShowComparison(true);
      return;
    }
    setCreditsPending(packageId);
    try {
      const resp = await fetch("/api/stripe/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
        credentials: "include",
      });
      const data = await resp.json() as { url?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "checkout error");
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Não foi possível iniciar o checkout", description: "Tente novamente em alguns instantes.", variant: "destructive" });
    } finally {
      setCreditsPending(null);
    }
  };

  const handleUpgrade = async (priceId: string | null | undefined, planKey: string) => {
    if (planKey === "free") {
      setFreePending(true);
      try {
        const token = await getToken();
        const base = import.meta.env.BASE_URL ?? "/";
        await fetch(`${base}api/user/select-plan`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/dashboard");
      } catch {
        toast({ title: "Erro ao selecionar plano", description: "Tente novamente em instantes.", variant: "destructive" });
      } finally {
        setFreePending(false);
      }
      return;
    }
    checkout.mutate({ data: { priceId: priceId ?? "free", planKey } });
  };

  /* ─── price display helpers ────────────────────────────────────────── */
  const getMainPrice = (planKey: string) => {
    const p = PLAN_PRICES[planKey];
    if (!p) return "—";
    return billing === "annual" ? p.yearlyDisplay : p.monthlyDisplay;
  };
  const getPerMonth = (planKey: string) => {
    return PLAN_PRICES[planKey]?.yearlyMonthlyDisplay ?? null;
  };

  const PlanIcon = PLAN_ICON[currentPlan] ?? PLAN_ICON.free;

  return (
    <div className="space-y-8 max-w-5xl">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Assinatura e Planos</h1>
          <p className="text-sm text-muted-foreground mt-1">Escolha o plano ideal e libere todos os recursos da plataforma.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleBillingRefresh} disabled={isBillingFetching} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
          <RefreshCw className={`w-3.5 h-3.5 ${isBillingFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* ── Content (dimmed during refetch) ────────────────────────────── */}
      <div className={`space-y-8 transition-opacity duration-150 ${isBillingFetching && !isLoading ? "opacity-50 pointer-events-none" : ""}`}>

      {/* ── Current Plan Status ────────────────────────────────────────── */}
      {subLoading ? (
        <div className="rounded-xl border border-white/10 bg-[#111111] p-5 h-24 skeleton-shimmer" />
      ) : hasActiveSub ? (
        /* — has active subscription — */
        <div className={`rounded-xl border bg-[#111111] p-5 ${PLAN_BORDER[currentPlan] ?? "border-white/10"} ${PLAN_GLOW[currentPlan] ?? ""}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">Plano Atual</p>
              <div className="flex items-center gap-2.5">
                <PlanIcon className={`w-5 h-5 ${PLAN_COLORS[currentPlan] ?? "text-zinc-400"}`} />
                <span className={`text-2xl font-bold ${PLAN_COLORS[currentPlan] ?? "text-white"}`}>
                  {PLAN_NAMES[currentPlan] ?? currentPlan.toUpperCase()}
                </span>
                {subStatus && STATUS_LABELS[subStatus] && (
                  <Badge className={`text-[10px] px-2 py-0 h-5 border ${
                    subStatus === "active"   ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    subStatus === "trialing" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                    subStatus === "past_due" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                    "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}>
                    {STATUS_LABELS[subStatus].label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">{PLAN_DESC[currentPlan]}</p>
              <p className="text-xs text-zinc-600 mt-1">
                {creditsLeft.toLocaleString("pt-BR")} de {planLimit.toLocaleString("pt-BR")} créditos restantes este mês
              </p>
              {subscription?.currentPeriodEnd && (
                <p className="text-xs text-zinc-600 mt-1">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancela em ${formatDate(subscription.currentPeriodEnd)}`
                    : `Renova em ${formatDate(subscription.currentPeriodEnd)}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowComparison(true)}
                className="border-white/10 hover:border-primary/30 text-sm text-zinc-300 gap-1.5"
              >
                <Rocket className="w-3.5 h-3.5" />
                Fazer Upgrade
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 hover:border-primary/30 text-sm text-zinc-300"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending
                  ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <ExternalLink className="w-3.5 h-3.5 mr-1.5" />}
                Gerenciar Assinatura
              </Button>
            </div>
          </div>
          {subStatus === "past_due" && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">Pagamento em atraso. Atualize seu método de pagamento para manter o plano ativo.</p>
            </div>
          )}
        </div>
      ) : (
        /* — no active subscription — */
        <div className="relative rounded-xl border border-white/[0.08] bg-[#111111] p-5 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              <CircleSlash className="w-4.5 h-4.5 text-zinc-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">Status do Plano</p>
              <p className="text-lg font-bold text-zinc-400">Sem plano ativo</p>
              <p className="text-sm text-zinc-600 mt-0.5">
                Escolha um plano abaixo para liberar todos os módulos e recursos da plataforma.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Plans Grid ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Escolha seu Plano</h2>
            {!hasActiveSub && (
              <p className="text-xs text-zinc-600 mt-0.5">Selecione um plano para liberar o acesso completo à plataforma.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <BillingToggle value={billing} onChange={setBilling} />
            {sortedPlans.length > 0 && (
              <button
                onClick={() => setShowComparison(true)}
                className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors flex items-center gap-1"
              >
                <Star className="w-3 h-3" />
                Comparação completa
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0,1,2,3].map((i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-[#111111] p-5 h-80 skeleton-shimmer" />
            ))}
          </div>
        ) : sortedPlans.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#111111] p-8 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-300 mb-1">Faturamento em configuração</p>
              <p className="text-xs text-zinc-500 max-w-sm">Os planos pagos serão disponibilizados em breve. Créditos e todos os módulos funcionam normalmente.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {sortedPlans.map((plan) => {
              const planKey    = plan.planKey;
              const isCurrent  = planKey === currentPlan && hasActiveSub;
              const isUpgrade  = PLAN_ORDER.indexOf(planKey) > PLAN_ORDER.indexOf(currentPlan);
              const isDowngrade= PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(currentPlan);
              const isPopular  = planKey === "business";
              const PIcon      = PLAN_ICON[planKey] ?? PLAN_ICON.free;
              const savings    = PLAN_SAVINGS[planKey] ?? 0;
              const perMonth   = getPerMonth(planKey);

              return (
                <div
                  key={planKey}
                  className={`relative rounded-xl border bg-[#111111] ${(isCurrent || isPopular) ? "pt-8 px-5 pb-5" : "p-5"} flex flex-col transition-all duration-200 ${
                    isCurrent
                      ? `${PLAN_BORDER[planKey] ?? "border-white/20"} bg-white/[0.015] ${PLAN_GLOW[planKey] ?? ""}`
                      : isPopular
                      ? `${PLAN_BORDER[planKey] ?? "border-white/10"} ${PLAN_GLOW[planKey] ?? ""} hover:bg-white/[0.02]`
                      : "border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.01]"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent rounded-t-xl" />
                  )}

                  {/* badges */}
                  {isCurrent && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                      <span className={`inline-block text-[10px] font-bold px-3 py-0.5 rounded-b-md border border-t-0 ${PLAN_BADGE_STYLE[planKey] ?? "bg-white/10 text-white border-white/20"}`}>
                        PLANO ATUAL
                      </span>
                    </div>
                  )}
                  {isPopular && !isCurrent && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-0.5 rounded-b-md bg-violet-600 text-white shadow-[0_2px_8px_rgba(139,92,246,0.35)]">
                        <Star className="w-2.5 h-2.5 fill-white" />
                        MAIS ESCOLHIDO
                      </span>
                    </div>
                  )}

                  {/* plan header */}
                  <div className="mb-3 mt-1 flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      planKey === "free"     ? "bg-blue-500/12 border border-blue-400/20" :
                      planKey === "pro"      ? "bg-emerald-500/10 border border-emerald-500/25" :
                      planKey === "business" ? "bg-violet-500/12 border border-violet-500/20" :
                                              "bg-[#C9A84C]/10 border border-[#C9A84C]/20"
                    }`}>
                      <PIcon className={`w-3.5 h-3.5 ${PLAN_COLORS[planKey] ?? "text-zinc-400"}`} />
                    </div>
                    <p className={`text-sm font-bold ${PLAN_COLORS[planKey] ?? "text-white"}`}>
                      {PLAN_NAMES[planKey] ?? plan.name}
                    </p>
                  </div>

                  <p className="text-[11px] text-zinc-600 leading-snug mb-4">{PLAN_DESC[planKey] ?? plan.description}</p>

                  {/* price — hidden for free plan */}
                  {planKey !== "free" && (
                    <div className="mb-4">
                      <div className="text-2xl font-bold text-white leading-none">
                        {getMainPrice(planKey)}
                      </div>
                      {billing === "annual" && perMonth ? (
                        <div className="mt-1.5 space-y-0.5">
                          <p className="text-[11px] text-zinc-500">equivale a {perMonth}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-600">cobrado anualmente</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              -{savings}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-600 mt-1">cobrado mensalmente</p>
                      )}
                    </div>
                  )}

                  {/* credits — hidden for free plan */}
                  {planKey !== "free" && (
                    <div className="flex items-center gap-1.5 mb-4 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <Zap className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />
                      <span className="text-xs font-semibold text-zinc-300">
                        {billing === "annual"
                          ? ((PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits) * 12).toLocaleString("pt-BR") + " créditos / ano"
                          : (PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits).toLocaleString("pt-BR") + " créditos / mês"}
                      </span>
                    </div>
                  )}

                  {/* features */}
                  <ul className="space-y-2 mb-5 flex-1">
                    {planKey === "free" ? (
                      <>
                        {[
                          "Acessar a plataforma",
                          "Navegar pelos módulos",
                          "Conhecer a interface",
                          "Visualizar funcionalidades",
                          "Explorar os recursos disponíveis",
                          "Conhecer o ecossistema IAttom Assist",
                        ].map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
                            <span className="text-xs text-zinc-400">{f}</span>
                          </li>
                        ))}
                        {[
                          "Buscar Produtos",
                          "Validar Produto",
                          "Criar Prompt",
                          "Criar Conteúdo",
                          "Criar Campanha",
                          "Scripts de Vídeo",
                          "Criar Imagem e Vídeo",
                          "Criar Vídeo",
                          "IAttom Help",
                          "Publicação Assistida",
                          "Créditos",
                        ].map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <CircleSlash className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-600" />
                            <span className="text-xs text-zinc-600">{f}</span>
                          </li>
                        ))}
                      </>
                    ) : planKey === "pro" ? (
                      <>
                        {[
                          "Criar Prompt",
                          "Criar Campanha",
                          "Criar Imagem e Vídeo",
                          "Gerador de Vídeo (Opcional - consultar pacote)",
                          "IAttom Help",
                          "Navegação pela Plataforma",
                          "Publicação Assistida",
                          "Análise",
                          "Monitoramento",
                          "Biblioteca",
                        ].map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C9A84C]" />
                            <span className="text-xs text-zinc-400">{f}</span>
                          </li>
                        ))}
                        {[
                          "Buscar Produtos",
                          "Validar Produto",
                          "Criar Conteúdo",
                          "Scripts de Vídeo",
                        ].map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <CircleSlash className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-600" />
                            <span className="text-xs text-zinc-600">{f}</span>
                          </li>
                        ))}
                      </>
                    ) : planKey === "business" ? (
                      <>
                        {[
                          "Criar Prompt",
                          "Criar Campanha",
                          "Criar Imagem e Vídeo",
                          "Validar Produto",
                          "Scripts de Vídeo",
                          "IAttom Help",
                          "Gerador de Vídeo (Opcional - consultar pacote)",
                          "Navegação pela Plataforma",
                          "Publicação Assistida",
                          "Análise",
                          "Monitoramento",
                          "Biblioteca",
                        ].map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-400" />
                            <span className="text-xs text-zinc-400">{f}</span>
                          </li>
                        ))}
                        {[
                          "Buscar Produtos",
                          "Criar Conteúdo",
                        ].map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <CircleSlash className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-600" />
                            <span className="text-xs text-zinc-600">{f}</span>
                          </li>
                        ))}
                      </>
                    ) : planKey === "agency" ? (
                      <>
                        {[
                          "Buscar Produtos",
                          "Validar Produto",
                          "Criar Prompt",
                          "Criar Conteúdo",
                          "Criar Campanha",
                          "Criar Imagem e Vídeo",
                          "Scripts de Vídeo",
                          "Gerador de Vídeo (Opcional - consultar pacote)",
                          "IAttom Help",
                          "Navegação pela Plataforma",
                          "Publicação Assistida",
                          "Análise",
                          "Monitoramento",
                          "Biblioteca",
                        ].map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#E8C96A]" />
                            <span className="text-xs text-zinc-400">{f}</span>
                          </li>
                        ))}
                      </>
                    ) : (
                      plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-500" />
                          <span className="text-xs text-zinc-400">{feature}</span>
                        </li>
                      ))
                    )}
                  </ul>

                  {/* CTA */}
                  {isCurrent ? (
                    <Button disabled size="sm" className="w-full bg-white/5 text-zinc-500 border border-white/10 text-xs cursor-default">
                      Plano Atual
                    </Button>
                  ) : hasActiveSub && isDowngrade ? (
                    <Button size="sm" variant="outline" className="w-full border-white/10 text-zinc-400 text-xs hover:border-white/20" onClick={() => portal.mutate()} disabled={portal.isPending}>
                      Fazer Downgrade
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={`w-full text-xs font-semibold ${PLAN_BTN_STYLE[planKey] ?? ""}`}
                      onClick={() => handleUpgrade(plan.priceId, planKey)}
                      disabled={planKey === "free" ? freePending : checkout.isPending}
                    >
                      {(planKey === "free" ? freePending : checkout.isPending) && (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      )}
                      {planKey === "free"
                        ? "Começar GRÁTIS"
                        : hasActiveSub && isUpgrade
                        ? `Fazer Upgrade`
                        : `Assinar ${PLAN_NAMES[planKey] ?? plan.name}`}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Comprar Créditos ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#111111] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <p className="text-xs text-primary uppercase tracking-widest font-semibold">Comprar Créditos</p>
            </div>
            <h2 className="text-sm font-semibold text-zinc-300">Recarregue seu saldo sem mudar de plano</h2>
            <p className="text-xs text-zinc-600 mt-0.5">Os créditos são somados ao seu saldo atual e nunca expiram.</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
            <Zap className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />
            <span className="text-xs font-semibold text-zinc-300">{creditsLeft.toLocaleString("pt-BR")} créditos disponíveis</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {CREDIT_PACKAGES.map((pkg) => {
            const scheme    = CREDIT_SCHEME[pkg.id] ?? "free";
            const isPending = creditsPending === pkg.id;
            const PkgIcon   = CREDIT_ICON_CMP[scheme];
            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 transition-all duration-200 ${CREDIT_CARD_BG[scheme]} ${CREDIT_CARD_BORDER[scheme]}`}
              >
                {/* top accent line */}
                <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent ${CREDIT_TOP_LINE[scheme]} to-transparent rounded-t-xl`} />
                {/* ambient top glow */}
                <div className={`absolute top-0 inset-x-0 h-8 bg-gradient-to-b ${CREDIT_AMBIENT[scheme]} to-transparent rounded-t-xl pointer-events-none`} />

                {/* badge */}
                <div className="absolute -top-px left-1/2 -translate-x-1/2">
                  <span className={`inline-block text-[9px] font-bold px-3 py-0.5 rounded-b-md whitespace-nowrap tracking-wide ${CREDIT_BADGE[scheme]}`}>
                    {pkg.tag.toUpperCase()}
                  </span>
                </div>

                {/* header */}
                <div className="flex items-center gap-2.5 mb-3 mt-1">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${CREDIT_ICON_BG[scheme]}`}>
                    <PkgIcon className={`w-3.5 h-3.5 ${CREDIT_ICON_COLOR[scheme]}`} />
                  </div>
                  <div>
                    <p className={`text-lg font-bold leading-none ${CREDIT_LABEL_COLOR[scheme]}`}>{pkg.label}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">créditos</p>
                  </div>
                </div>

                <p className="text-xl font-bold mb-5 text-white">{pkg.price}</p>

                <Button
                  size="sm"
                  className={`w-full h-9 text-xs ${CREDIT_BTN[scheme]}`}
                  onClick={() => handleBuyCredits(pkg.id)}
                  disabled={isPending || creditsPending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar</>
                  }
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Pacotes de Imagem (Criativos) ─────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#111111] p-6">
        <div className="flex items-start gap-4 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-primary" />
              <p className="text-xs text-primary uppercase tracking-widest font-semibold">Pacotes de Criativos</p>
            </div>
            <h2 className="text-sm font-semibold text-zinc-300">Mais Criativos para Seus Anúncios</h2>
            <p className="text-xs text-zinc-600 mt-0.5">Crie mais imagens e amplie suas possibilidades de divulgação com materiais profissionais.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {IMAGE_PACKAGES.map((pkg) => {
            const isPending = imagePending === pkg.id;
            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 transition-all duration-200 ${pkg.bg} ${pkg.border}`}
              >
                <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent ${pkg.topLine} to-transparent rounded-t-xl`} />
                <div className={`absolute top-0 inset-x-0 h-8 bg-gradient-to-b ${pkg.ambient} to-transparent rounded-t-xl pointer-events-none`} />

                <div className="absolute -top-px left-1/2 -translate-x-1/2">
                  <span className={`inline-block text-[9px] font-bold px-3 py-0.5 rounded-b-md whitespace-nowrap tracking-wide ${pkg.badge}`}>
                    {pkg.tag}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 mb-3 mt-1">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${pkg.iconBg}`}>
                    <Palette className={`w-3.5 h-3.5 ${pkg.iconColor}`} />
                  </div>
                  <div>
                    <p className={`text-lg font-bold leading-none ${pkg.labelColor}`}>{pkg.images}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">imagens</p>
                  </div>
                </div>

                <p className="text-xl font-bold mb-5 text-white">{pkg.price}</p>

                <Button
                  size="sm"
                  className={`w-full h-9 text-xs ${pkg.btn}`}
                  onClick={() => handleBuyImagePack(pkg.id)}
                  disabled={isPending || imagePending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar</>
                  }
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Pacotes de Vídeo ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#111111] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Film className="w-4 h-4 text-primary" />
              <p className="text-xs text-primary uppercase tracking-widest font-semibold">Pacotes de Vídeo</p>
            </div>
            <h2 className="text-sm font-semibold text-zinc-300">Mais Recursos para Sua Operação</h2>
            <p className="text-xs text-zinc-600 mt-0.5">Adicione recursos visuais e torne seus materiais mais completos e profissionais.</p>
          </div>
          {videoBalance !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-400/20 shrink-0">
              <Film className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-bold text-blue-300 tabular-nums">{videoBalance}</span>
              <span className="text-[10px] text-zinc-600">vídeo{videoBalance !== 1 ? "s" : ""} disponível{videoBalance !== 1 ? "is" : ""}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {VIDEO_PACKAGES.map((pkg) => {
            const isPending = videoPending === pkg.id;
            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 transition-all duration-200 ${pkg.bg} ${pkg.border}`}
              >
                {/* top accent line */}
                <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent ${pkg.topLine} to-transparent rounded-t-xl`} />
                {/* ambient top glow */}
                <div className={`absolute top-0 inset-x-0 h-8 bg-gradient-to-b ${pkg.ambient} to-transparent rounded-t-xl pointer-events-none`} />

                {/* badge */}
                <div className="absolute -top-px left-1/2 -translate-x-1/2">
                  <span className={`inline-block text-[9px] font-bold px-3 py-0.5 rounded-b-md whitespace-nowrap tracking-wide ${pkg.badge}`}>
                    {pkg.tag}
                  </span>
                </div>

                {/* header */}
                <div className="flex items-center gap-2.5 mb-3 mt-1">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${pkg.iconBg}`}>
                    <Film className={`w-3.5 h-3.5 ${pkg.iconColor}`} />
                  </div>
                  <div>
                    <p className={`text-lg font-bold leading-none ${pkg.labelColor}`}>{pkg.videos}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">vídeos</p>
                  </div>
                </div>

                <p className="text-xl font-bold mb-5 text-white">{pkg.price}</p>

                <Button
                  size="sm"
                  className={`w-full h-9 text-xs ${pkg.btn}`}
                  onClick={() => handleBuyVideoPack(pkg.id)}
                  disabled={isPending || videoPending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar</>
                  }
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Referral CTA (only shown when user has active plan) ────────── */}
      {hasActiveSub && (
        <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Indique amigos e ganhe créditos</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Ganhe 50 créditos por cada amigo que entrar. Eles recebem 25 créditos de bônus.
              </p>
            </div>
          </div>
          <Link href="/dashboard/referral">
            <Button size="sm" variant="outline" className="border-white/10 hover:border-primary/30 text-zinc-300 gap-1.5 shrink-0">
              <Gift className="w-3.5 h-3.5" />
              Ver Indicações
            </Button>
          </Link>
        </div>
      )}

      {/* ── Bottom note ───────────────────────────────────────────────── */}
      <p className="text-xs text-zinc-600">
        Pagamentos processados com segurança via Stripe. Cancele quando quiser. Créditos renovam mensalmente.
      </p>

      <PlanComparisonModal open={showComparison} onClose={() => setShowComparison(false)} highlightPlan="pro" />
      </div>
    </div>
  );
}
