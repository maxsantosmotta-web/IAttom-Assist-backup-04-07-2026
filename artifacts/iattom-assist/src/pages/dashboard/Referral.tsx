import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gift, Copy, Check, Users, Zap, ArrowRight, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/react";

interface ReferralData {
  code: string;
  shareUrl: string;
  totalUses: number;
  creditsEarned: number;
  referrerBonus: number;
  referredBonus: number;
  recentReferrals: Array<{
    referredUserId: string;
    creditsAwarded: number;
    createdAt: string;
  }>;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Referral() {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${basePath}/api/referral/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshTick, getToken]);

  const copyLink = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.shareUrl);
    setCopied(true);
    toast({ title: "Link copiado", description: "Envie para amigos e ganhe créditos quando eles entrarem." });
    setTimeout(() => setCopied(false), 2500);
  };

  const copyCode = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const applyReferral = async () => {
    if (!applyCode.trim()) return;
    setApplying(true);
    setApplyError("");
    setApplySuccess("");
    try {
      const token = await getToken();
      const res = await fetch(`${basePath}/api/referral/use`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code: applyCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setApplyError(json.error ?? "Algo deu errado.");
      } else {
        setApplySuccess(`${json.creditsAwarded} créditos de bônus adicionados à sua conta.`);
        setApplyCode("");
      }
    } catch {
      setApplyError("Erro de rede. Tente novamente.");
    } finally {
      setApplying(false);
    }
  };

  const steps = [
    { n: "1", label: "Compartilhe seu link", desc: "Envie seu link único para amigos ou nas redes sociais." },
    { n: "2", label: "Eles se cadastram", desc: "Seu amigo cria uma conta usando seu link." },
    { n: "3", label: "Ambos ganham créditos", desc: `Você recebe ${data?.referrerBonus ?? 50} créditos. Eles recebem ${data?.referredBonus ?? 25} créditos de bônus.` },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-primary" />
              <p className="text-xs text-primary uppercase tracking-widest font-semibold">Indicações</p>
            </div>
            <h1 className="text-2xl font-bold text-white">Indique e Ganhe</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Indique amigos e ambos ganham créditos quando eles entram.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setRefreshTick((t) => t + 1)} disabled={loading} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Amigos Indicados", value: loading ? "—" : (data?.totalUses ?? 0).toString(), icon: Users, color: "text-primary" },
          { label: "Créditos Ganhos", value: loading ? "—" : (data?.creditsEarned ?? 0).toString(), icon: Zap, color: "text-amber-400" },
          { label: "Créditos por Indicação", value: `${data?.referrerBonus ?? 50}`, icon: Gift, color: "text-emerald-400" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="glass-surface rounded-xl border border-white/[0.07] p-5 card-hover"
          >
            <stat.icon className={`w-4 h-4 ${stat.color} mb-3`} />
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="rounded-2xl border border-primary/20 bg-[#111111] p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none" style={{ background: "radial-gradient(ellipse at top right, rgba(201,168,76,0.06) 0%, transparent 65%)" }} />

        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Seu Código de Indicação</p>

        {loading ? (
          <div className="h-16 skeleton-shimmer rounded-xl" />
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-3 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3">
              <span className="text-2xl font-mono font-bold text-primary tracking-widest">{data?.code ?? "Carregando..."}</span>
              <button
                onClick={copyCode}
                className="ml-auto p-1.5 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                {codeCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <Button
              onClick={copyLink}
              className="bg-primary text-black hover:bg-primary/90 font-semibold px-5 gap-2 shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
          </div>
        )}

        {data && (
          <p className="text-xs text-zinc-600 mt-3 font-mono truncate">{data.shareUrl}</p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-4">Como funciona</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((step) => (
            <div key={step.n} className="flex gap-3 p-4 rounded-xl border border-white/[0.06] bg-[#111111]">
              <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{step.n}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">{step.label}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {data && data.recentReferrals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">Indicações Recentes</h2>
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] divide-y divide-white/[0.04]">
            {data.recentReferrals.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-white/[0.05] flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">{r.referredUserId}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-2">
                    +{r.creditsAwarded} créditos
                  </Badge>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(r.createdAt).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="rounded-xl border border-white/[0.06] bg-[#111111] p-5"
      >
        <h2 className="text-sm font-semibold text-white mb-1">Tem um código de indicação?</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Insira o código de um amigo para receber {data?.referredBonus ?? 25} créditos de bônus na sua conta.
        </p>
        <div className="flex gap-3">
          <input
            value={applyCode}
            onChange={(e) => { setApplyCode(e.target.value.toUpperCase()); setApplyError(""); setApplySuccess(""); }}
            placeholder="XXXX-XXXX"
            maxLength={9}
            className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
            onKeyDown={(e) => e.key === "Enter" && applyReferral()}
          />
          <Button
            onClick={applyReferral}
            disabled={applying || !applyCode.trim()}
            className="bg-white/8 hover:bg-white/12 border border-white/10 text-zinc-200 text-sm gap-1.5"
          >
            {applying ? "Aplicando..." : <>Aplicar <ArrowRight className="w-3.5 h-3.5" /></>}
          </Button>
        </div>
        {applyError && (
          <div className="flex items-center gap-2 mt-2.5 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {applyError}
          </div>
        )}
        {applySuccess && (
          <div className="flex items-center gap-2 mt-2.5 text-xs text-emerald-400">
            <Check className="w-3.5 h-3.5 shrink-0" />
            {applySuccess}
          </div>
        )}
      </motion.div>
    </div>
  );
}
