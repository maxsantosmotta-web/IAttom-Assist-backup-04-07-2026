import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Loader2, Copy, AlertCircle, RefreshCw, Music, Zap, Film, Share2, Save, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSavedItems } from "@/hooks/useSavedItems";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import { loadModuleState, saveModuleState, clearModuleState } from "@/hooks/useModulePersistence";
import type { VideoScriptResult, ScriptScene } from "@/types/ai";

export function VideoScripts() {
  const [product, setProduct] = useState("");
  const [format, setFormat] = useState("");
  const [duration, setDuration] = useState("");
  const [style, setStyle] = useState("");
  const [showProduction, setShowProduction] = useState(false);
  const { status, result, error, generate, reset } = useAiStream<VideoScriptResult>();
  const { toast } = useToast();
  const { saveItem } = useSavedItems();
  const { isFetching: fetchingCredits, refetch: refetchCredits } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), staleTime: 0 },
  });
  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const [restoredResult, setRestoredResult] = useState<VideoScriptResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRestoredMode = !!restoredResult && status === "idle";
  const activeResult = result ?? restoredResult;

  useEffect(() => {
    // Restaurar de Projetos Salvos (sessionStorage tem prioridade)
    try {
      const raw = sessionStorage.getItem("iattom_restore_video_v1");
      if (raw) {
        sessionStorage.removeItem("iattom_restore_video_v1");
        const saved = JSON.parse(raw) as { briefing?: { product?: string; format?: string; duration?: string; style?: string }; result?: VideoScriptResult };
        if (saved.briefing?.product) setProduct(saved.briefing.product);
        if (saved.briefing?.format) setFormat(saved.briefing.format);
        if (saved.briefing?.duration) setDuration(saved.briefing.duration);
        if (saved.briefing?.style) setStyle(saved.briefing.style);
        if (saved.result) setRestoredResult(saved.result);
        return;
      }
    } catch {}
    // Preservação global: restaurar último trabalho via localStorage
    try {
      const persisted = loadModuleState<{ form: { product: string; format: string; duration: string; style: string }; result: VideoScriptResult }>("video_script");
      if (persisted) {
        if (persisted.form.product) setProduct(persisted.form.product);
        if (persisted.form.format) setFormat(persisted.form.format);
        if (persisted.form.duration) setDuration(persisted.form.duration);
        if (persisted.form.style) setStyle(persisted.form.style);
        if (persisted.result) setRestoredResult(persisted.result);
      }
    } catch {}
  }, []);

  // Auto-salvar resultado no localStorage quando geração concluir
  useEffect(() => {
    if (status === "done" && result) {
      saveModuleState("video_script", { form: { product, format, duration, style }, result });
    }
  }, [status, result, product, format, duration, style]);

  const runGenerate = (charge: () => void) => {
    generate("/api/ai/video-script", { product, format: format || undefined, duration: duration || undefined, style: style || undefined }).then((res) => {
      if (res !== null) charge();
    });
  };

  const copyFull = () => {
    if (!activeResult) return;
    const scenes = activeResult.scenes?.map((s, i) =>
      `CENA ${i + 1} (${s.time})\nVisual: ${s.visual}\nScript: ${s.script}\nEmoção: ${s.emotion}`
    ).join("\n\n");
    const hooks = activeResult.hooks?.join("\n");
    const text = `${activeResult.title}\n\nHOOKS:\n${hooks}\n\nCENAS:\n${scenes}`;
    navigator.clipboard.writeText(text);
    toast({ description: "Script completo copiado" });
  };

  const handleSave = () => {
    if (!activeResult) return;
    const lines: string[] = [activeResult.title];
    if (activeResult.duration) lines.push(`Duração: ${activeResult.duration}`);
    if (activeResult.voiceoverStyle) lines.push(`Narração: ${activeResult.voiceoverStyle}`);
    if (activeResult.musicMood) lines.push(`Música: ${activeResult.musicMood}`);
    if (activeResult.editingPace) lines.push(`Edição: ${activeResult.editingPace}`);
    if (activeResult.hooks?.length) lines.push(`\nHOOKS:\n${activeResult.hooks.join("\n")}`);
    if (activeResult.viralTrigger) lines.push(`\nGATILHO VIRAL: ${activeResult.viralTrigger}`);
    if (activeResult.scenes?.length) {
      const scenes = activeResult.scenes.map((s: ScriptScene, i: number) =>
        `CENA ${i + 1} (${s.time})\nVisual: ${s.visual}\nNarração: ${s.script}${s.emotion ? `\nEmoção: ${s.emotion}` : ""}`
      ).join("\n\n");
      lines.push(`\nCENAS:\n${scenes}`);
    }
    const content = lines.join("\n");
    const title = product.trim() || activeResult.title || "Script gerado";
    const id = crypto.randomUUID();
    const data = JSON.stringify({ briefing: { product, format, duration, style }, result: activeResult });
    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift({ id, title, type: "video_script", content, data, createdAt: new Date().toISOString() });
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
    } catch {}
    void saveItem({ id, title, type: "video_script", content, data }).catch(() => {});
    toast({ description: "Salvo com sucesso." });
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Criação de Scripts com IA</p>
          <h2 className="text-2xl font-bold text-white mb-1">Scripts de Vídeo</h2>
          <p className="text-muted-foreground text-sm">Roteiros prontos com hooks, cenas e direção.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setIsRefreshing(true); void refetchCredits(); setTimeout(() => setIsRefreshing(false), 750); }} disabled={fetchingCredits || isRefreshing} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
          <RefreshCw className={`w-3.5 h-3.5 ${(fetchingCredits || isRefreshing) ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardContent className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Produto / Marca</Label>
                <Input placeholder="ex: Garrafa HydroElite" className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" value={product} onChange={(e) => setProduct(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Formato do Vídeo</Label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-1 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                >
                  <option value="" disabled>Selecionar formato</option>
                  <option value="TikTok / Reels hook ad">TikTok / Reels Hook Ad</option>
                  <option value="Facebook / Instagram ad">Facebook / Instagram Ad</option>
                  <option value="YouTube pre-roll ad">YouTube Pre-roll Ad</option>
                  <option value="UGC authentic review">UGC — Avaliação Autêntica</option>
                  <option value="Brand story video">Vídeo de História da Marca</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Duração</Label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-1 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                >
                  <option value="" disabled>Selecionar duração</option>
                  <option value="15s">15s — Hook Rápido</option>
                  <option value="30s">30s — Anúncio Padrão</option>
                  <option value="60s">60s — Formato Story</option>
                  <option value="90s">90s — Estendido</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Estilo (opcional)</Label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-1 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                >
                  <option value="" disabled>Selecionar estilo</option>
                  <option value="High energy fast-paced">Alta Energia e Dinâmico</option>
                  <option value="Cinematic storytelling">Narrativa Cinematográfica</option>
                  <option value="Conversational authentic">Conversacional Autêntico</option>
                  <option value="Problem-solution">Problema → Solução</option>
                  <option value="Testimonial social proof">Depoimento / Prova Social</option>
                </select>
              </div>
            </div>
            <CreditsGate feature="video_script" onSuccess={runGenerate} disabled={!product.trim() || isGenerating}>
              {({ trigger, isLoading }) => (
                <Button onClick={trigger} disabled={isLoading || isGenerating || !product.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
                  {isLoading || isGenerating ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" /> Escrevendo seu script...</>) : (<><Video className="w-4 h-4 mr-2" /> Gerar Script</>)}
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
              <div className="flex gap-1">{[0, 1, 2].map((i) => (<span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />))}</div>
              <span className="text-sm">{(["Estruturando seu roteiro...", "Criando direção cinematográfica...", "Montando cenas de conversão...", "Preparando narrativa visual..."])[Math.floor(Date.now() / 1000) % 4]}</span>
            </div>
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-28 rounded-lg bg-white/5 border border-white/5 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />))}</div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-red-950/20 border-red-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1"><p className="text-sm font-semibold text-red-400">Falha na geração</p><p className="text-xs text-muted-foreground">{error}</p></div>
                <Button size="sm" variant="outline" onClick={() => { reset(); generate("/api/ai/video-script", { product, format: format || undefined, duration: duration || undefined, style: style || undefined }); }} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(isDone || isRestoredMode) && activeResult && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
            {isRestoredMode && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <p className="text-xs text-primary">Script restaurado de Projetos Salvos</p>
              </div>
            )}
            <Card className="bg-[#111111] border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" />{activeResult.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {(activeResult.voiceoverStyle || activeResult.musicMood || activeResult.editingPace) && (
                  <div>
                    <button
                      onClick={() => setShowProduction((v) => !v)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors mb-2"
                    >
                      {showProduction ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Detalhes de Produção
                    </button>
                    {showProduction && (
                      <div className="grid grid-cols-3 gap-3">
                        {activeResult.voiceoverStyle && (
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Narração</p>
                            <p className="text-xs text-white">{activeResult.voiceoverStyle}</p>
                          </div>
                        )}
                        {activeResult.musicMood && (
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><Music className="w-3 h-3" />Música</p>
                            <p className="text-xs text-white">{activeResult.musicMood}</p>
                          </div>
                        )}
                        {activeResult.editingPace && (
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><Film className="w-3 h-3" />Edição</p>
                            <p className="text-xs text-white">{activeResult.editingPace}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeResult.hooks?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-medium">Variações de Hook</p>
                    <div className="w-full flex justify-end items-center gap-3 mb-3">
                      <button onClick={copyFull} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1 whitespace-nowrap"><Copy className="w-3 h-3" /> Copiar Tudo</button>
                      <button onClick={handleSave} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"><Save className="w-3 h-3" /> Salvar</button>
                      <button onClick={() => { reset(); setRestoredResult(null); setProduct(""); setFormat(""); setDuration(""); setStyle(""); clearModuleState("video_script"); }} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1 whitespace-nowrap"><Plus className="w-3 h-3" /> Novo</button>
                    </div>
                    <div className="space-y-2">
                      {activeResult.hooks.map((hook, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white/5 border border-white/5 rounded-lg group">
                          <span className="text-xs font-bold text-primary shrink-0 mt-0.5">H{i + 1}</span>
                          <p className="text-sm text-white flex-1 leading-snug">{hook}</p>
                          <button
                            onClick={() => { navigator.clipboard.writeText(hook); toast({ description: "Hook copiado" }); }}
                            className="text-muted-foreground hover:text-white transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeResult.viralTrigger && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15">
                    <Zap className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-primary font-medium mb-0.5">Gatilho Viral</p>
                      <p className="text-xs text-muted-foreground">{activeResult.viralTrigger}</p>
                    </div>
                  </div>
                )}

                {activeResult.scenes?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-medium">Estrutura do Vídeo</p>
                    <div className="space-y-3">
                      {activeResult.scenes.map((scene: ScriptScene, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="border border-white/5 rounded-lg overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-2.5 bg-white/5 border-b border-white/5">
                            <span className="text-xs font-bold text-primary">Cena {i + 1}</span>
                            <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground">{scene.time}</Badge>
                            {scene.emotion && <span className="text-xs text-amber-400 ml-auto">{scene.emotion}</span>}
                          </div>
                          <div className="p-4 grid md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Visual</p>
                              <p className="text-sm text-muted-foreground italic leading-relaxed">{scene.visual}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Texto da cena</p>
                              <p className="text-sm text-white leading-relaxed">{scene.script}</p>
                            </div>
                          </div>
                          {scene.direction && (
                            <div className="px-4 pb-3">
                              <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Orientação de filmagem</p>
                              <p className="text-xs text-muted-foreground/70 line-clamp-1">{scene.direction}</p>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {activeResult.distributionTips?.length > 0 && (
                  <div className="border-t border-white/5 pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-medium flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" /> Dicas de Distribuição</p>
                    <div className="space-y-1.5">
                      {activeResult.distributionTips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-primary font-bold text-xs shrink-0 mt-0.5">{i + 1}.</span>
                          <p className="text-xs text-muted-foreground">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      )}
    </div>
  );
}
