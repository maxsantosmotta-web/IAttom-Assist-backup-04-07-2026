import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Copy, RefreshCw, AlertCircle, Monitor, Smartphone, Image, Palette, Type, Save, Download, ChevronDown, ChevronUp } from "lucide-react";
import { saveProjectAssets } from "@/lib/assetStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import type { CreativeIdeasResult, CreativeConcept } from "@/types/ai";

const formatIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "1:1 quadrado": Monitor,
  "9:16 story": Smartphone,
  "16:9 banner": Monitor,
  "1080x1080 square": Monitor,
  "9:16 story (legacy)": Smartphone,
  default: Image,
};

const gradients = [
  "from-primary/30 to-amber-900/20",
  "from-blue-900/30 to-purple-900/20",
  "from-emerald-900/30 to-teal-900/20",
  "from-rose-900/30 to-orange-900/20",
];

const FORMAT_PACK_OPTIONS = [
  {
    value: "social",
    label: "Pacote Social",
    description: "2 quadrados + 1 story + 1 banner",
    formats: ["1:1", "1:1", "9:16", "16:9"],
  },
] as const;

function downloadImageBase64(base64: string, filename: string) {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  const blob = new Blob([arr], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ConceptCard({ concept, index }: { concept: CreativeConcept; index: number }) {
  const { toast } = useToast();
  const [showTechnical, setShowTechnical] = useState(false);
  const FormatIcon = formatIcons[concept.format] ?? formatIcons.default;

  const copyAll = () => {
    const text = `HOOK: ${concept.copyHook}\n\nCOPY: ${concept.bodyText}\n\nCTA: ${concept.cta}\n\nVISUAL: ${concept.visualDirection}\n\nPROMPT DE IMAGEM: ${concept.imagePrompt}`;
    navigator.clipboard.writeText(text);
    toast({ description: "Conceito criativo copiado" });
  };

  const handleDownload = () => {
    if (!concept.imageBase64) return;
    const slug = concept.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    downloadImageBase64(concept.imageBase64, `criativo-${index + 1}-${slug}.png`);
    toast({ description: "Imagem baixada." });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
      <Card className="bg-[#111111] border-white/5 hover:border-primary/20 transition-colors overflow-hidden">
        {concept.imageBase64 ? (
          <div className="relative group">
            <img
              src={`data:image/png;base64,${concept.imageBase64}`}
              alt={concept.label}
              className="h-48 w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black/70 border border-white/20 text-white text-xs font-medium hover:bg-black/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Baixar imagem
              </button>
            </div>
          </div>
        ) : (
          <div className={`h-24 bg-gradient-to-br ${gradients[index % gradients.length]} flex items-center justify-center`}>
            <FormatIcon className="w-8 h-8 text-white/20" />
          </div>
        )}
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">{concept.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{concept.format} &middot; {concept.bestPlatform}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {concept.imageBase64 && (
                <button onClick={handleDownload} className="text-muted-foreground hover:text-white transition-colors">
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={copyAll} className="text-muted-foreground hover:text-white transition-colors">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Hook</p>
            <p className="text-sm font-semibold text-white leading-snug">{concept.copyHook}</p>
          </div>

          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Copy</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{concept.bodyText}</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">CTA</p>
              <p className="text-xs text-primary font-semibold">{concept.cta}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Gatilho</p>
              <p className="text-xs text-amber-400">{concept.emotionalTrigger}</p>
            </div>
          </div>

          {concept.visualDirection && (
            <div className="p-2.5 rounded bg-white/5 border border-white/5">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Direção Visual</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{concept.visualDirection}</p>
            </div>
          )}

          {concept.imagePrompt && (
            <div>
              <button
                onClick={() => setShowTechnical((v) => !v)}
                className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                {showTechnical ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Detalhes técnicos
              </button>
              {showTechnical && (
                <div className="mt-1.5 p-2 rounded bg-white/3 border border-white/5">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Prompt de Imagem IA</p>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed italic">{concept.imagePrompt}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function CreativeGenerator() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [formatPack, setFormatPack] = useState<"social">("social");
  const { status, result, error, generate, reset } = useAiStream<CreativeIdeasResult>();
  const { toast } = useToast();

  useEffect(() => {
    const saved = sessionStorage.getItem("iattom_creative_prefill");
    if (saved) {
      try {
        const d = JSON.parse(saved) as { prompt?: string; targetAudience?: string; style?: string };
        if (d.prompt) setPrompt(d.prompt);
        if (d.targetAudience) setTargetAudience(d.targetAudience);
        if (d.style) setStyle(d.style);
      } catch { /* ignore */ }
      sessionStorage.removeItem("iattom_creative_prefill");
    }
  }, []);

  const [restoredResult, setRestoredResult] = useState<CreativeIdeasResult | null>(null);
  const isRestoredMode = !!restoredResult && status === "idle";
  const activeResult = result ?? restoredResult;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("iattom_restore_creative_v1");
      if (!raw) return;
      sessionStorage.removeItem("iattom_restore_creative_v1");
      const saved = JSON.parse(raw) as { briefing?: { prompt?: string; style?: string; targetAudience?: string; formatPack?: string }; result?: CreativeIdeasResult };
      if (saved.briefing?.prompt) setPrompt(saved.briefing.prompt);
      if (saved.briefing?.style) setStyle(saved.briefing.style);
      if (saved.briefing?.targetAudience) setTargetAudience(saved.briefing.targetAudience);
      if (saved.briefing?.formatPack === "social") setFormatPack("social");
      if (saved.result) setRestoredResult(saved.result);
    } catch {}
  }, []);

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const runGenerate = (charge: () => void) => {
    generate("/api/ai/creative-ideas", {
      prompt,
      style: style || undefined,
      targetAudience: targetAudience || undefined,
      formatPack,
    }).then((res) => {
      if (res !== null) charge();
    });
  };

  const handleSave = () => {
    if (!activeResult) return;

    const lines: string[] = [];
    if (activeResult.overarchingTheme) lines.push(`TEMA: ${activeResult.overarchingTheme}`);
    if (activeResult.colorPalette) lines.push(`PALETA: ${activeResult.colorPalette}`);
    if (activeResult.typographyDirection) lines.push(`TIPOGRAFIA: ${activeResult.typographyDirection}`);
    activeResult.concepts?.forEach((c: CreativeConcept, i: number) => {
      lines.push(`\nCONCEITO ${i + 1}: ${c.label}`);
      if (c.copyHook) lines.push(`Hook: ${c.copyHook}`);
      if (c.bodyText) lines.push(`Copy: ${c.bodyText}`);
      if (c.cta) lines.push(`CTA: ${c.cta}`);
      if (c.visualDirection) lines.push(`Visual: ${c.visualDirection}`);
      if (c.imagePrompt) lines.push(`Prompt IA: ${c.imagePrompt}`);
    });
    if (activeResult.brandVoiceNotes) lines.push(`\nVoz da Marca: ${activeResult.brandVoiceNotes}`);
    const content = lines.join("\n");

    const resultWithoutImages: CreativeIdeasResult = {
      ...activeResult,
      concepts: activeResult.concepts?.map(({ imageBase64: _removed, ...rest }) => rest) ?? [],
    };

    const data = JSON.stringify({
      briefing: { prompt: prompt.trim(), style, targetAudience, formatPack },
      result: resultWithoutImages,
    });

    const imageAssets = (activeResult.concepts ?? [])
      .map((c, i) => c.imageBase64
        ? { conceptIndex: i, base64: c.imageBase64, label: c.label ?? `Criativo ${i + 1}`, format: c.format ?? "PNG" }
        : null)
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const projectId = crypto.randomUUID();
    const title = prompt.trim() || activeResult.overarchingTheme || "Criativo gerado";
    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift({
        id: projectId,
        title,
        type: "creative",
        content,
        data,
        hasImages: imageAssets.length > 0,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
      if (imageAssets.length > 0) {
        void saveProjectAssets(projectId, imageAssets);
      }
      toast({ description: "Salvo com sucesso." });
    } catch {
      toast({ description: "Erro ao salvar.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Inteligência Visual</p>
        <h2 className="text-2xl font-bold text-white mb-1">Gerador Criativo</h2>
        <p className="text-muted-foreground text-sm">Gere conceitos criativos premium — copy, hooks, direções visuais e imagens prontas para publicação.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardContent className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-sm text-muted-foreground">Briefing Criativo</Label>
                <Input placeholder="ex: Garrafa premium para atletas ao ar livre, estética minimalista" className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Estilo Visual</Label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-1 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                >
                  <option value="" disabled>Selecionar estilo</option>
                  <option value="Photorealistic lifestyle">Lifestyle Fotorrealista</option>
                  <option value="Minimalist clean">Minimalista e Limpo</option>
                  <option value="Bold graphic">Arrojado e Gráfico</option>
                  <option value="Luxury editorial">Editorial de Luxo</option>
                  <option value="Raw authentic UGC">UGC Autêntico e Bruto</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Público-alvo (opcional)</Label>
                <Input placeholder="ex: Entusiastas de fitness 25-35" className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Pacote de Formatos</Label>
              <div className="grid grid-cols-3 gap-2">
                {FORMAT_PACK_OPTIONS.map((pack) => (
                  <button
                    key={pack.value}
                    onClick={() => setFormatPack(pack.value)}
                    className={[
                      "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all",
                      formatPack === pack.value
                        ? "border-primary/60 bg-primary/10 text-white"
                        : "border-white/8 bg-white/3 text-muted-foreground hover:border-white/20 hover:text-white",
                    ].join(" ")}
                  >
                    <span className="text-xs font-semibold">{pack.label}</span>
                    <span className="text-xs opacity-70">{pack.description}</span>
                    <div className="flex gap-1 mt-0.5">
                      {pack.formats.map((f, i) => (
                        <span
                          key={i}
                          className={[
                            "text-[9px] px-1 py-0.5 rounded font-mono",
                            formatPack === pack.value ? "bg-primary/20 text-primary" : "bg-white/8 text-white/40",
                          ].join(" ")}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <CreditsGate feature="creative" onSuccess={runGenerate} disabled={!prompt.trim() || isGenerating}>
              {({ trigger, isLoading }) => (
                <Button onClick={trigger} disabled={isLoading || isGenerating || !prompt.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
                  {isLoading || isGenerating ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando conceitos...</>) : (<><Sparkles className="w-4 h-4 mr-2" /> Gerar Conceitos Criativos</>)}
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
              <div className="flex gap-1">{[0, 1, 2].map((i) => (<span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />))}</div>
              <span className="text-sm">Criando conceitos e gerando imagens...</span>
            </div>
            <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-64 rounded-lg bg-white/5 border border-white/5 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />))}</div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-red-950/20 border-red-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1"><p className="text-sm font-semibold text-red-400">Falha na geração</p><p className="text-xs text-muted-foreground">{error}</p></div>
                <Button size="sm" variant="outline" onClick={() => { reset(); generate("/api/ai/creative-ideas", { prompt, style: style || undefined, targetAudience: targetAudience || undefined, formatPack }); }} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(isDone || isRestoredMode) && activeResult && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            {isRestoredMode && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <p className="text-xs text-primary">Criativo restaurado de Projetos Salvos</p>
              </div>
            )}
            {activeResult.overarchingTheme && (
              <div className="mb-5 p-4 rounded-lg bg-primary/5 border border-primary/15">
                <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Tema Criativo</p>
                <p className="text-sm text-white">{activeResult.overarchingTheme}</p>
                <div className="flex flex-wrap gap-4 mt-3">
                  {activeResult.colorPalette && (
                    <div className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{activeResult.colorPalette}</p>
                    </div>
                  )}
                  {activeResult.typographyDirection && (
                    <div className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{activeResult.typographyDirection}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Conceitos Criativos</h3>
              <div className="flex items-center gap-3">
                <button onClick={handleSave} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"><Save className="w-3 h-3" /> Salvar</button>
                <button onClick={() => { reset(); setRestoredResult(null); }} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> Novos conceitos</button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {activeResult.concepts?.map((concept: CreativeConcept, i: number) => (
                <ConceptCard key={concept.id ?? i} concept={concept} index={i} />
              ))}
            </div>

            {activeResult.brandVoiceNotes && (
              <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/5">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">Notas de Voz da Marca</p>
                <p className="text-sm text-muted-foreground">{activeResult.brandVoiceNotes}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
