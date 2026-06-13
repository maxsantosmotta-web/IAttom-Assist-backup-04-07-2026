import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, TrendingUp, Users, DollarSign, Loader2, AlertCircle, RefreshCw, Lightbulb, Target, Zap, Save, Copy, Plus } from "lucide-react";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useSavedItems } from "@/hooks/useSavedItems";
import { loadModuleState, saveModuleState, clearModuleState } from "@/hooks/useModulePersistence";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { ModuleLockGate } from "@/components/ModuleLockGate";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useAiStream } from "@/hooks/useAiStream";
import type { ValidationResult } from "@/types/ai";

const demandTrendColors: Record<string, string> = {
  Accelerating: "text-emerald-400",
  Growing: "text-primary",
  Stable: "text-amber-400",
  Declining: "text-red-400",
  Acelerando: "text-emerald-400",
  Crescendo: "text-primary",
  Estável: "text-amber-400",
  "Em Queda": "text-red-400",
  "Em declínio": "text-red-400",
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "#34d399" : score >= 55 ? "#C9A84C" : "#f87171";
  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="48" cy="48" r="40" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${(score / 100) * 251} 251`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white tabular-nums">{score}</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

export function ValidateProducts() {
  const { planSlug, isAdmin } = useUserAccess();
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const { saveItem } = useSavedItems();
  const { isFetching: fetchingCredits, refetch: refetchCredits } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), staleTime: 0 },
  });
  const [targetMarket, setTargetMarket] = useState("");
  const { status, result, error, generate, reset } = useAiStream<ValidationResult>();
  const [restoredResult, setRestoredResult] = useState<ValidationResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRestoredMode = !!restoredResult && status === "idle";
  const activeResult = result ?? restoredResult;

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const { toast } = useToast();

  // Restore from Projetos Salvos (sessionStorage) — with localStorage fallback
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("iattom_restore_validation_v1");
      if (raw) {
        sessionStorage.removeItem("iattom_restore_validation_v1");
        const saved = JSON.parse(raw) as { briefing?: { productName?: string; description?: string; targetMarket?: string }; result?: ValidationResult };
        if (saved.briefing?.productName) setProductName(saved.briefing.productName);
        if (saved.briefing?.description) setDescription(saved.briefing.description);
        if (saved.briefing?.targetMarket) setTargetMarket(saved.briefing.targetMarket);
        if (saved.result) setRestoredResult(saved.result);
        return;
      }
    } catch {}
    // Preservação global: restaurar último trabalho via localStorage
    try {
      const persisted = loadModuleState<{ form: { productName: string; description: string; targetMarket: string }; result: ValidationResult }>("validate_product");
      if (persisted) {
        if (persisted.form.productName) setProductName(persisted.form.productName);
        if (persisted.form.description) setDescription(persisted.form.description);
        if (persisted.form.targetMarket) setTargetMarket(persisted.form.targetMarket);
        if (persisted.result) setRestoredResult(persisted.result);
      }
    } catch {}
  }, []);

  // Auto-salvar resultado no localStorage quando geração concluir
  useEffect(() => {
    if (status === "done" && result) {
      saveModuleState("validate_product", { form: { productName, description, targetMarket }, result });
    }
  }, [status, result, productName, description, targetMarket]);

  const runValidation = (charge: () => void) => {
    generate("/api/ai/validate-product", {
      productName,
      description: description || undefined,
      targetMarket: targetMarket || undefined,
    }).then((res) => {
      if (res !== null) charge();
    });
  };

  const buildValidationText = () => {
    if (!activeResult) return "";
    const lines: string[] = [
      `PRODUTO: ${productName}`,
      `RESULTADO: ${activeResult.verdict}`,
      `SCORE: ${activeResult.score}`,
    ];
    if (activeResult.recommendation) lines.push(`\nRECOMENDAÇÃO:\n${activeResult.recommendation}`);
    if (activeResult.strengths?.length) lines.push(`\nPONTOS FORTES:\n${activeResult.strengths.join("\n")}`);
    if (activeResult.risks?.length) lines.push(`\nRISCOS:\n${activeResult.risks.join("\n")}`);
    if (activeResult.opportunities?.length) lines.push(`\nOPORTUNIDADES:\n${activeResult.opportunities.join("\n")}`);
    if (activeResult.launchStrategy) lines.push(`\nESTRATÉGIA:\n${activeResult.launchStrategy}`);
    if (activeResult.pricingInsight) lines.push(`\nPREÇO:\n${activeResult.pricingInsight}`);
    return lines.join("\n");
  };

  const handleSave = () => {
    if (!activeResult) return;
    const content = buildValidationText();
    const title = productName.trim() || "Validação de produto";
    const id = crypto.randomUUID();
    const data = JSON.stringify({ briefing: { productName, description, targetMarket }, result: activeResult });
    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift({ id, title, type: "product_validation", content, data, createdAt: new Date().toISOString() });
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
    } catch {}
    void saveItem({ id, title, type: "product_validation", content, data }).catch(() => {});
    toast({ description: "Salvo com sucesso." });
  };

  const handleRetry = () => {
    reset();
    generate("/api/ai/validate-product", {
      productName,
      description: description || undefined,
      targetMarket: targetMarket || undefined,
    });
  };

  if (!isAdmin && !["business", "agency"].includes(planSlug)) return <ModuleLockGate allowedPlans={["business", "agency"]} moduleName="Validar Produto" />;
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Inteligência de Mercado</p>
          <h2 className="text-2xl font-bold text-white mb-1">Validar Produtos</h2>
          <p className="text-muted-foreground text-sm">Execute validação de mercado antes de comprometer recursos.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setIsRefreshing(true); void refetchCredits(); setTimeout(() => setIsRefreshing(false), 750); }} disabled={fetchingCredits || isRefreshing} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
          <RefreshCw className={`w-3.5 h-3.5 ${(fetchingCredits || isRefreshing) ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-white">Detalhes do Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Nome do Produto / Ideia</Label>
                <Input
                  placeholder="ex: Garrafa de Hidratação Inteligente"
                  className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Mercado-alvo (opcional)</Label>
                <Input
                  placeholder="ex: Atletas 25-40, mercado brasileiro"
                  className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva seu produto, público-alvo, faixa de preço, diferenciais..."
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50 resize-none"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <CreditsGate feature="product_validation" onSuccess={runValidation} disabled={!productName.trim() || isGenerating}>
              {({ trigger, isLoading }) => (
                <Button
                  onClick={trigger}
                  disabled={isLoading || isGenerating || !productName.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                >
                  {isLoading || isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analisando sua ideia...</>
                  ) : "Executar Validação"}
                </Button>
              )}
            </CreditsGate>
          </CardContent>
        </Card>
      </motion.div>

      {isRefreshing ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-32 rounded-lg bg-white/5 border border-white/5" />
          <div className="h-24 rounded-lg bg-white/5 border border-white/5" />
        </div>
      ) : (
      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3 text-muted-foreground mb-5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-sm">IAttom está analisando <span className="text-white">"{productName}"</span> nos sinais de mercado...</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 rounded-lg bg-white/5 border border-white/5 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-red-950/20 border-red-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-400">Validação falhou</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleRetry} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(isDone || isRestoredMode) && activeResult && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Análise de Produto</h3>
              <div className="flex items-center gap-3">
                <button onClick={() => { navigator.clipboard.writeText(buildValidationText()); toast({ description: "Resultado copiado" }); }} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1"><Copy className="w-3 h-3" /> Copiar tudo</button>
                <button onClick={handleSave} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"><Save className="w-3 h-3" /> Salvar</button>
                <button onClick={() => { reset(); setRestoredResult(null); setProductName(""); setDescription(""); setTargetMarket(""); clearModuleState("validate_product"); }} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1"><Plus className="w-3 h-3" /> Novo</button>
              </div>
            </div>
            <Card className="bg-[#111111] border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-6 mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Resultado da Validação</p>
                    <h3 className="text-2xl font-bold text-white mb-1">{activeResult.verdict}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {activeResult.demandTrend && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${demandTrendColors[activeResult.demandTrend] ?? "text-white"}`}>
                          demanda {activeResult.demandTrend}
                        </span>
                      )}
                      {activeResult.profitabilityRating && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400">
                          rentabilidade {activeResult.profitabilityRating}
                        </span>
                      )}
                    </div>
                  </div>
                  <ScoreRing score={activeResult.score} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Tamanho do Mercado", value: activeResult.marketSize, icon: DollarSign, color: "text-emerald-400" },
                    { label: "Concorrência", value: activeResult.competition, icon: Users, color: "text-amber-400" },
                    { label: "Intenção de Compra", value: `${activeResult.buyerIntentScore}%`, icon: Target, color: "text-primary" },
                    { label: "Tendência de Demanda", value: activeResult.demandTrend, icon: TrendingUp, color: demandTrendColors[activeResult.demandTrend ?? ""] ?? "text-white" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="bg-white/5 rounded-lg p-3 text-center border border-white/5">
                        <Icon className={`w-4 h-4 mx-auto mb-1.5 ${item.color}`} />
                        <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Pontos Fortes</p>
                      {activeResult.strengths?.length ? (
                        <button onClick={() => { navigator.clipboard.writeText(activeResult.strengths!.join("\n")); toast({ description: "Texto copiado" }); }} className="text-muted-foreground hover:text-white transition-colors" title="Copiar"><Copy className="w-3 h-3" /></button>
                      ) : null}
                    </div>
                    {activeResult.strengths?.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-xs">{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Riscos</p>
                      {activeResult.risks?.length ? (
                        <button onClick={() => { navigator.clipboard.writeText(activeResult.risks!.join("\n")); toast({ description: "Texto copiado" }); }} className="text-muted-foreground hover:text-white transition-colors" title="Copiar"><Copy className="w-3 h-3" /></button>
                      ) : null}
                    </div>
                    {activeResult.risks?.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-xs">{r}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-primary uppercase tracking-widest">Oportunidades</p>
                      {activeResult.opportunities?.length ? (
                        <button onClick={() => { navigator.clipboard.writeText(activeResult.opportunities!.join("\n")); toast({ description: "Texto copiado" }); }} className="text-muted-foreground hover:text-white transition-colors" title="Copiar"><Copy className="w-3 h-3" /></button>
                      ) : null}
                    </div>
                    {activeResult.opportunities?.map((o, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-xs">{o}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/5 pt-5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-primary uppercase tracking-widest">Recomendação IAttom</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(activeResult.recommendation); toast({ description: "Recomendação copiada" }); }}
                        className="text-muted-foreground hover:text-white transition-colors"
                        title="Copiar recomendação"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{activeResult.recommendation}</p>
                  </div>
                  {activeResult.launchStrategy && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Estratégia de Lançamento</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(activeResult.launchStrategy!); toast({ description: "Estratégia copiada" }); }}
                          className="text-muted-foreground hover:text-white transition-colors"
                          title="Copiar estratégia"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{activeResult.launchStrategy}</p>
                    </div>
                  )}
                  {activeResult.pricingInsight && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15 group">
                      <Zap className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-white/80 flex-1">{activeResult.pricingInsight}</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(activeResult.pricingInsight!); toast({ description: "Insight copiado" }); }}
                        className="text-muted-foreground hover:text-white transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="Copiar insight"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </motion.div>
        )}
      </AnimatePresence>
      )}
    </div>
  );
}
