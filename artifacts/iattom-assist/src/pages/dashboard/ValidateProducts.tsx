import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, TrendingUp, Users, DollarSign, Loader2, AlertCircle, RefreshCw, Lightbulb, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import type { ValidationResult } from "@/types/ai";

const demandTrendColors: Record<string, string> = {
  Accelerating: "text-emerald-400",
  Growing: "text-primary",
  Stable: "text-amber-400",
  Declining: "text-red-400",
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
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const { status, result, error, generate, reset } = useAiStream<ValidationResult>();

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const runValidation = (charge: () => void) => {
    generate("/api/ai/validate-product", {
      productName,
      description: description || undefined,
      targetMarket: targetMarket || undefined,
    }).then((res) => {
      if (res !== null) charge();
    });
  };

  const handleRetry = () => {
    reset();
    generate("/api/ai/validate-product", {
      productName,
      description: description || undefined,
      targetMarket: targetMarket || undefined,
    });
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Inteligência de Mercado</p>
        <h2 className="text-2xl font-bold text-white mb-1">Validar Produtos</h2>
        <p className="text-muted-foreground text-sm">Execute validação de mercado antes de comprometer recursos.</p>
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
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> A IA está analisando sua ideia...</>
                  ) : "Executar Validação IA"}
                </Button>
              )}
            </CreditsGate>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3 text-muted-foreground mb-5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-sm">Analisando <span className="text-white">"{productName}"</span> nos sinais de mercado...</span>
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

        {isDone && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
            <Card className="bg-[#111111] border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-6 mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Resultado da Validação</p>
                    <h3 className="text-2xl font-bold text-white mb-1">{result.verdict}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {result.demandTrend && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${demandTrendColors[result.demandTrend] ?? "text-white"}`}>
                          demanda {result.demandTrend}
                        </span>
                      )}
                      {result.profitabilityRating && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400">
                          rentabilidade {result.profitabilityRating}
                        </span>
                      )}
                    </div>
                  </div>
                  <ScoreRing score={result.score} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Tamanho do Mercado", value: result.marketSize, icon: DollarSign, color: "text-emerald-400" },
                    { label: "Concorrência", value: result.competition, icon: Users, color: "text-amber-400" },
                    { label: "Intenção de Compra", value: `${result.buyerIntentScore}%`, icon: Target, color: "text-primary" },
                    { label: "Tendência de Demanda", value: result.demandTrend, icon: TrendingUp, color: demandTrendColors[result.demandTrend ?? ""] ?? "text-white" },
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
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Pontos Fortes</p>
                    {result.strengths?.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-xs">{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Riscos</p>
                    {result.risks?.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-xs">{r}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Oportunidades</p>
                    {result.opportunities?.map((o, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-xs">{o}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/5 pt-5">
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1.5">Recomendação IA</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.recommendation}</p>
                  </div>
                  {result.launchStrategy && (
                    <div>
                      <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1.5">Estratégia de Lançamento</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{result.launchStrategy}</p>
                    </div>
                  )}
                  {result.pricingInsight && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15">
                      <Zap className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-white/80">{result.pricingInsight}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Validar outro produto
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
