import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, Star, DollarSign, BarChart2, Loader2, AlertCircle, RefreshCw, Zap, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import type { FindProductsResult, FoundProduct } from "@/types/ai";

const demandColors: Record<string, string> = {
  "Muito Alta": "text-emerald-400",
  "Alta": "text-primary",
  "Média": "text-amber-400",
  "Baixa": "text-red-400",
  "Very High": "text-emerald-400",
  "High": "text-primary",
  "Medium": "text-amber-400",
  "Low": "text-red-400",
};

const competitionColors: Record<string, string> = {
  "Muito Alta": "text-red-400",
  "Alta": "text-amber-400",
  "Média": "text-primary",
  "Baixa": "text-emerald-400",
  "Very High": "text-red-400",
  "High": "text-amber-400",
  "Medium": "text-primary",
  "Low": "text-emerald-400",
};

const quickSearches = ["Em alta agora", "Alta margem", "Baixa concorrência", "Casa & Decoração", "Fitness", "Acessórios tech"];

export function FindProducts() {
  const [query, setQuery] = useState("");
  const [niche, setNiche] = useState("");
  const { status, result, error, generate, reset } = useAiStream<FindProductsResult>();

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const runSearch = (charge: () => void) => {
    generate("/api/ai/find-products", { query, niche: niche || undefined }).then((res) => {
      if (res !== null) charge();
    });
  };

  const handleRetry = () => {
    reset();
    generate("/api/ai/find-products", { query, niche: niche || undefined });
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Pesquisa de Produtos com IA</p>
        <h2 className="text-2xl font-bold text-white mb-1">Buscar Produtos</h2>
        <p className="text-muted-foreground text-sm">Descubra produtos de alta margem e tendência de mercado real.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos, nichos ou categorias..."
                  className="pl-10 bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50 text-white"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <CreditsGate feature="product_discovery" onSuccess={runSearch} disabled={!query.trim() || isGenerating}>
                {({ trigger, isLoading }) => (
                  <Button
                    onClick={trigger}
                    disabled={isLoading || isGenerating || !query.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 shrink-0"
                  >
                    {isLoading || isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                  </Button>
                )}
              </CreditsGate>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickSearches.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3 text-muted-foreground mb-4">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-sm">A IA está analisando mercados para <span className="text-white">"{query}"</span>...</span>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-white/5 border border-white/5 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
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
                  <p className="text-sm font-semibold text-red-400">Falha na geração</p>
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
          <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            {result.marketInsight && (
              <div className="mb-5 p-4 rounded-lg bg-primary/5 border border-primary/15">
                <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1.5">Visão de Mercado</p>
                <p className="text-sm text-white/80 leading-relaxed">{result.marketInsight}</p>
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                Resultados para "{query}"
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{result.products?.length ?? 0} encontrados</span>
                <button onClick={() => reset()} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Nova busca
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {result.products?.map((product: FoundProduct, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Card className="bg-[#111111] border-white/5 hover:border-primary/20 transition-colors">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h4 className="font-semibold text-white text-sm">{product.name}</h4>
                            <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground">{product.category}</Badge>
                            {result.topPick === product.name && (
                              <Badge className="text-xs bg-primary/20 text-primary border-primary/30">Destaque</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{product.whyNow}</p>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <BarChart2 className="w-3 h-3" /> Demanda:{" "}
                              <span className={`font-medium ml-0.5 ${demandColors[product.demand] ?? "text-white"}`}>{product.demand}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" /> Margem:{" "}
                              <span className="text-emerald-400 font-medium ml-0.5">{product.margin}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" /> Tendência:{" "}
                              <span className="text-primary font-medium ml-0.5">{product.trend}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> Concorrência:{" "}
                              <span className={`font-medium ml-0.5 ${competitionColors[product.competition] ?? "text-white"}`}>{product.competition}</span>
                            </span>
                          </div>
                          {product.keySellingPoints?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {product.keySellingPoints.map((ksp, j) => (
                                <span key={j} className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/5 text-muted-foreground">{ksp}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="flex items-center gap-1 justify-end mb-1">
                            <Star className="w-4 h-4 text-primary fill-primary" />
                            <span className="text-2xl font-bold text-white tabular-nums">{product.score}</span>
                          </div>
                          {product.estimatedMonthlyRevenue && (
                            <p className="text-xs text-emerald-400 font-medium">{product.estimatedMonthlyRevenue}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
