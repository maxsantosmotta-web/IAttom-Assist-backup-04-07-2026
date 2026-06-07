import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, RefreshCw, AlertCircle, Image, Save } from "lucide-react";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { saveProjectAssets } from "@/lib/assetStorage";
import { useSavedItems } from "@/hooks/useSavedItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import type { CreativeIdeasResult, CreativeConcept } from "@/types/ai";
import type { FeatureKey } from "@/lib/credits";

type FormatKey = "feed" | "story" | "banner" | "profile" | "marketplace";

const FORMAT_OPTIONS: { value: FormatKey; label: string; ratio: string }[] = [
  { value: "feed",        label: "Feed",        ratio: "1:1"  },
  { value: "story",       label: "Story",        ratio: "9:16" },
  { value: "banner",      label: "Banner",       ratio: "16:9" },
  { value: "profile",     label: "Perfil",       ratio: "1:1"  },
  { value: "marketplace", label: "Marketplace",  ratio: "1:1"  },
];

function formatToAspectClass(format: string): string {
  if (format === "story") return "aspect-[9/16]";
  if (format === "banner") return "aspect-[16/9]";
  return "aspect-square";
}

function ConceptCard({ concept, index }: { concept: CreativeConcept; index: number }) {
  const aspectClass = formatToAspectClass(concept.format ?? "feed");

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
      <Card className="bg-[#111111] border-white/5 hover:border-primary/20 transition-colors overflow-hidden">
        {concept.imageBase64 ? (
          <div className={`relative bg-black overflow-hidden w-full ${aspectClass}`}>
            <img
              src={`data:image/png;base64,${concept.imageBase64}`}
              alt={concept.label}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={`w-full ${aspectClass} bg-gradient-to-br from-white/[0.03] to-transparent flex items-center justify-center`}>
            <Image className="w-8 h-8 text-white/20" />
          </div>
        )}
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest">{concept.label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function CreativeGenerator() {
  const [prompt, setPrompt] = useState("");
  const [quantity, setQuantity] = useState<1 | 2>(1);
  const [format, setFormat] = useState<FormatKey | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [restoredResult, setRestoredResult] = useState<CreativeIdeasResult | null>(null);

  const { status, result, error, generate, reset } = useAiStream<CreativeIdeasResult>();
  const { toast } = useToast();
  const { saveItem, saveItemAssets } = useSavedItems();
  const { isFetching: fetchingCredits, refetch: refetchCredits } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), staleTime: 0 },
  });

  const refundCalledRef = useRef(false);
  const chargedFeatureRef = useRef<FeatureKey>("creativeImage1");

  useEffect(() => {
    if (status === "error" && !refundCalledRef.current) {
      refundCalledRef.current = true;
      fetch("/api/credits/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: chargedFeatureRef.current }),
        credentials: "include",
      }).catch(() => {});
    }
    if (status === "idle" || status === "generating") {
      refundCalledRef.current = false;
    }
  }, [status]);

  // Prefill a partir do módulo Campanha
  useEffect(() => {
    const saved = sessionStorage.getItem("iattom_creative_prefill");
    if (saved) {
      try {
        const d = JSON.parse(saved) as { prompt?: string };
        if (d.prompt) setPrompt(d.prompt);
      } catch { /* ignore */ }
      sessionStorage.removeItem("iattom_creative_prefill");
    }
  }, []);

  // Restaurar de Projetos Salvos
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("iattom_restore_creative_v1");
      if (!raw) return;
      sessionStorage.removeItem("iattom_restore_creative_v1");
      const saved = JSON.parse(raw) as {
        briefing?: { prompt?: string; format?: string; quantity?: number };
        result?: unknown;
      };
      if (saved.briefing?.prompt) setPrompt(saved.briefing.prompt);
      const savedFormat = saved.briefing?.format;
      if (savedFormat && FORMAT_OPTIONS.some((f) => f.value === savedFormat)) {
        setFormat(savedFormat as FormatKey);
      }
      if (saved.briefing?.quantity === 1) setQuantity(1);
      else if (saved.briefing?.quantity === 2) setQuantity(2);
      if (saved.result) setRestoredResult(saved.result as CreativeIdeasResult);
    } catch { /* ignore */ }
  }, []);

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";
  const isRestoredMode = !!restoredResult && status === "idle";
  const activeResult = result ?? restoredResult;

  const featureKey: FeatureKey = quantity === 1 ? "creativeImage1" : "creativeImage2";

  const runGenerate = (charge: () => void) => {
    chargedFeatureRef.current = featureKey;
    generate("/api/ai/creative-ideas", {
      prompt,
      quantity,
      format: format || undefined,
    }).then((res) => {
      if (res !== null) charge();
    });
  };

  const handleSave = async () => {
    if (!activeResult || isSaving) return;
    setIsSaving(true);

    const formatOpt = FORMAT_OPTIONS.find((f) => f.value === format);
    const formatLabel = formatOpt?.label ?? "Imagem";

    const content = [
      `Tipo: Imagem`,
      `Quantidade: ${quantity} ${quantity === 1 ? "imagem" : "imagens"}`,
      `Formato: ${formatLabel}`,
      `Prompt: ${prompt.trim()}`,
    ].join(" | ");

    const resultWithoutImages: CreativeIdeasResult = {
      ...activeResult,
      concepts: activeResult.concepts?.map(({ imageBase64: _removed, ...rest }) => rest) ?? [],
    };

    const data = JSON.stringify({
      type: "image",
      quantity,
      format,
      prompt: prompt.trim(),
      result: resultWithoutImages,
    });

    const projectId = crypto.randomUUID();
    const title = `${formatLabel} — ${prompt.trim().slice(0, 60) || "Criativo"}`;
    const hasImages = (activeResult.concepts?.some((c) => !!c.imageBase64)) ?? false;

    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift({
        id: projectId, title, type: "creative", content, data, hasImages,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
    } catch { /* ignore */ }

    const imageAssets = (activeResult.concepts ?? [])
      .map((c, i) => c.imageBase64
        ? { conceptIndex: i, base64: c.imageBase64, label: c.label ?? `Imagem ${i + 1}`, format: c.format ?? "PNG" }
        : null)
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (imageAssets.length > 0) void saveProjectAssets(projectId, imageAssets);

    try {
      await saveItem({ id: projectId, title, type: "creative", content, data, hasImages });

      if (imageAssets.length > 0) {
        try {
          await saveItemAssets(projectId, imageAssets);
          toast({ description: "Criativo salvo com imagens sincronizadas." });
        } catch {
          toast({
            description: "Criativo salvo, mas as imagens não foram sincronizadas. Tente salvar novamente.",
            variant: "destructive",
          });
        }
      } else {
        toast({ description: "Criativo salvo." });
      }
    } catch {
      toast({ description: "Erro ao salvar. Tente novamente.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const loadingAspect =
    format === "story" ? "aspect-[9/16]" :
    format === "banner" ? "aspect-[16/9]" :
    "aspect-square";

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Módulo Criativo</p>
          <h2 className="text-2xl font-bold text-white mb-1">Gerador de Imagens</h2>
          <p className="text-muted-foreground text-sm">Gere imagens prontas para publicação.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refetchCredits()}
          disabled={fetchingCredits}
          className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fetchingCredits ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </motion.div>

      {/* Formulário */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="bg-[#111111] border-white/5">
          <CardContent className="p-6 space-y-5">

            {/* Quantidade */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Quantidade de imagens</Label>
              <div className="flex gap-2">
                {([1, 2] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuantity(q)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      quantity === q
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                    }`}
                  >
                    {q === 1 ? "1 imagem" : "2 imagens"}
                  </button>
                ))}
              </div>
            </div>

            {/* Formato */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Formato</Label>
              <div className="grid grid-cols-5 gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`py-2.5 px-1 rounded-lg border text-xs font-medium transition-colors flex flex-col items-center gap-0.5 ${
                      format === opt.value
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className={`text-[9px] ${format === opt.value ? "text-primary/60" : "text-zinc-700"}`}>{opt.ratio}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">O que você quer gerar?</Label>
              <Input
                placeholder="Ex: Moto premium em rua neon noturna"
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* Botão de geração */}
            <CreditsGate
              feature={featureKey}
              onSuccess={runGenerate}
              disabled={!prompt.trim() || !format || isGenerating}
            >
              {({ trigger, isLoading }) => (
                <Button
                  onClick={trigger}
                  disabled={isLoading || isGenerating || !prompt.trim() || !format}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                >
                  {isLoading || isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Gerar {quantity === 1 ? "Imagem" : "Imagens"}</>
                  )}
                </Button>
              )}
            </CreditsGate>
          </CardContent>
        </Card>
      </motion.div>

      {/* Estados de resultado */}
      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3 text-muted-foreground mb-5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-sm">Gerando {quantity === 1 ? "imagem" : "imagens"}...</span>
            </div>
            <div className={`grid gap-4 ${quantity === 1 ? "grid-cols-1 max-w-sm mx-auto" : "grid-cols-2"}`}>
              {Array.from({ length: quantity }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-lg bg-white/5 border border-white/5 animate-pulse ${loadingAspect}`}
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
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
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    reset();
                    generate("/api/ai/creative-ideas", { prompt, quantity, format: format || undefined });
                  }}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(isDone || isRestoredMode) && activeResult && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {isRestoredMode && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <p className="text-xs text-primary">Criativo restaurado de Projetos Salvos</p>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Imagens Geradas</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {isSaving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={() => { reset(); setRestoredResult(null); }}
                  className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Gerar novamente
                </button>
              </div>
            </div>

            <div className={`grid gap-4 ${
              (activeResult.concepts?.length ?? 0) === 1
                ? "grid-cols-1 max-w-sm mx-auto"
                : "md:grid-cols-2"
            }`}>
              {activeResult.concepts?.map((concept: CreativeConcept, i: number) => (
                <ConceptCard key={concept.id ?? i} concept={concept} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
