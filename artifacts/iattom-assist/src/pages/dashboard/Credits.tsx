import { motion } from "framer-motion";
import { Zap, TrendingUp, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetCreditsBalance,
  getGetCreditsBalanceQueryKey,
  useListCreditTransactions,
  getListCreditTransactionsQueryKey,
} from "@workspace/api-client-react";
import { PLAN_CREDITS, PLAN_NAMES, PLAN_PRICES, getCreditColor, getCreditBarColor } from "@/lib/credits";

const featureLabels: Record<string, string> = {
  product_discovery: "Buscar Produtos",
  product_validation: "Validar Produtos",
  campaign: "Criar Campanha",
  content: "Criar Conteúdo",
  creative: "Criar Imagem e Vídeo",
  video_script: "Scripts de Vídeo",
  prompt_creation: "Criar Prompt",
};

const descriptionTranslations: Record<string, string> = {
  "Used product discovery feature": "Busca de produto",
  "Used product validation feature": "Validação de produto",
  "Used campaign feature": "Criação de campanha",
  "Used content feature": "Criação de conteúdo",
  "Used creative feature": "Criação de imagem",
  "Used video script feature": "Criação de roteiro",
};

const planDisplayNames: Record<string, string> = {
  free: "FREE",
  pro: "START",
  business: "PREMIUM",
  agency: "PRO",
};

function getPlanDisplayName(value: string): string {
  return planDisplayNames[value.toLowerCase()] ?? value.toUpperCase();
}

function translateDescription(desc: string): string {
  const exact = descriptionTranslations[desc];
  if (exact) return exact;

  const normalized = desc.trim();
  const lower = normalized.toLowerCase();

  if (lower.includes("plan subscription activated")) {
    const planKey = lower.split(" plan subscription activated")[0]?.trim() ?? "";
    return `Assinatura ${getPlanDisplayName(planKey)}`;
  }

  if (lower.includes("upgrade")) {
    const destination =
      lower.includes("agency") || lower.includes(" pro") ? "PRO" :
      lower.includes("business") || lower.includes("premium") ? "PREMIUM" :
      lower.includes("start") ? "START" :
      "";
    return destination ? `Upgrade para ${destination}` : "Upgrade de plano";
  }

  if (lower.includes("compra de créditos avulsos")) return "Compra de créditos";
  if (lower.includes("compra de criativos avulsos")) return "Compra de imagens";
  if (lower.includes("compra de pacote de vídeos")) return "Compra de vídeos";
  if (lower.includes("uso do gerador criativo")) return "Criação de imagem";
  if (lower.includes("uso do criador de campanha")) return "Criação de campanha";
  if (lower.includes("uso do validador de produtos")) return "Validação de produto";
  if (lower.includes("uso do buscador de produtos")) return "Busca de produto";
  if (lower.includes("criação de prompt")) return "Criação de prompt";
  if (lower.includes("refund") || lower.includes("reembolso") || lower.includes("estorno")) return "Reembolso";

  return normalized;
}

function isTechnicalMaintenanceDescription(desc: string): boolean {
  const lower = desc.toLowerCase();
  return [
    "ajuste administrativo",
    "correção única",
    "franquia criativa antiga",
    "sincronizada automaticamente",
    "sincronizada auto",
    "reparo técnico",
    "maintenance",
  ].some((marker) => lower.includes(marker));
}

const txTypeLabels: Record<string, string> = {
  initial: "inicial",
  credit: "crédito",
  debit: "débito",
  adjustment: "ajuste",
  refund: "reembolso",
};

const txTypeStyles: Record<string, string> = {
  initial: "text-primary bg-primary/10 border-primary/20",
  credit: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  debit: "text-red-400 bg-red-400/10 border-red-400/20",
  adjustment: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  refund: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const planColors: Record<string, string> = {
  free: "text-zinc-400",
  pro: "text-primary",
  business: "text-emerald-400",
  agency: "text-purple-400",
};

export function Credits() {
  const [, navigate] = useLocation();
  const { data: balance, isLoading: balanceLoading, isFetching: fetchingBalance, refetch: refetchBalance } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), staleTime: 0 },
  });

  const { data: txData, isLoading: txLoading, isFetching: fetchingTx, refetch: refetchTx } = useListCreditTransactions(
    {},
    { query: { queryKey: getListCreditTransactionsQueryKey() } },
  );

  const percentage = balance?.percentage ?? 0;
  const barColor = getCreditBarColor(percentage);
  const textColor = getCreditColor(percentage);

  const upgradePlans = balance
    ? (Object.keys(PLAN_CREDITS) as Array<keyof typeof PLAN_CREDITS>).filter(
        (p) => PLAN_CREDITS[p] > (PLAN_CREDITS[balance.plan as keyof typeof PLAN_CREDITS] ?? 0),
      )
    : [];

  const currentPlanDisplay = balance?.plan ? (planDisplayNames[balance.plan] ?? balance.plan) : "FREE";
  const visibleTransactions = txData?.transactions.filter(
    (tx) => !isTechnicalMaintenanceDescription(tx.description),
  ) ?? [];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Créditos e Uso</p>
            <h2 className="text-2xl font-bold text-white mb-1">Créditos</h2>
            <p className="text-muted-foreground text-sm">
              Acompanhe seu saldo e histórico de uso dos créditos.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { void refetchBalance(); void refetchTx(); }} disabled={fetchingBalance || fetchingTx} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
            <RefreshCw className={`w-3.5 h-3.5 ${(fetchingBalance || fetchingTx) ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="bg-[#111111] border-white/5">
          <CardContent className="p-6">
            {balanceLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-36 bg-white/5" />
                <Skeleton className="h-2 w-full bg-white/5" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Saldo</p>
                    <p className={`text-5xl font-bold tabular-nums ${textColor}`}>
                      {(balance?.balance ?? 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      de {(balance?.planLimit ?? 0).toLocaleString()} créditos &middot;{" "}
                      <span className={`capitalize font-medium ${planColors[balance?.plan ?? "free"]}`}>
                        Plano {currentPlanDisplay}
                      </span>
                    </p>
                  </div>
                  {balance?.lowCredit && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-medium shrink-0">
                      Créditos Baixos
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Créditos restantes</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {balance?.lowCredit && upgradePlans.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="bg-amber-950/20 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <TrendingUp className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-400">Créditos acabando</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Atualize para{" "}
                    <span className="text-white font-medium">{PLAN_NAMES[upgradePlans[0]] ?? upgradePlans[0]}</span>{" "}
                    e tenha {PLAN_CREDITS[upgradePlans[0]].toLocaleString()} créditos/mês.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-8">
                {upgradePlans.slice(0, 2).map((plan) => (
                  <button
                    key={plan}
                    onClick={() => navigate("/dashboard/billing")}
                    className="text-xs px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors font-medium"
                  >
                    {PLAN_NAMES[plan] ?? plan} — {PLAN_PRICES[plan].monthlyDisplay}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Histórico de Transações
          </h3>
          {txData && (
            <span className="text-xs text-muted-foreground">{visibleTransactions.length} movimentações</span>
          )}
        </div>
        <Card className="bg-[#111111] border-white/5 overflow-hidden">
          {txLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-white/5" />
              ))}
            </div>
          ) : !visibleTransactions.length ? (
            <div className="py-16 text-center">
              <Zap className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">Use um dos módulos para ver seu histórico aqui.</p>
            </div>
          ) : (
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#111111]">
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Data</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Descrição</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Tipo</th>
                    <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Valor</th>
                    <th className="text-right px-5 py-3 text-xs text-muted-foreground font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString("pt-BR")}{" "}
                        <span className="text-white/30">
                          {new Date(tx.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white max-w-xs">
                        <span className="truncate block">{translateDescription(tx.description)}</span>
                        {tx.feature && (
                          <span className="text-xs text-muted-foreground">
                            {featureLabels[tx.feature] ?? tx.feature}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${txTypeStyles[tx.type] ?? "text-muted-foreground bg-white/5 border-white/10"}`}
                        >
                          {txTypeLabels[tx.type] ?? tx.type}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold text-sm ${
                          tx.amount >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {tx.amount}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm text-white tabular-nums">
                        {tx.balanceAfter}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
