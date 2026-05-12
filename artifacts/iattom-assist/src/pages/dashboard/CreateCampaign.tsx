import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Target, Globe, Loader2, Copy, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import type { CampaignResult } from "@/types/ai";

const platformIcons: Record<string, string> = {
  facebook: "fb", instagram: "ig", google: "g", email: "em", tiktok: "tk",
};

function CopyBlock({ label, content }: { label: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const preview = content.slice(0, 120);
  const hasMore = content.length > 120;

  return (
    <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-primary capitalize">{label}</p>
        <button
          onClick={() => { navigator.clipboard.writeText(content); toast({ description: `Copy de ${label} copiado` }); }}
          className="text-muted-foreground hover:text-white transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {expanded ? content : preview}
        {hasMore && !expanded && "..."}
      </p>
      {hasMore && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary/60 hover:text-primary mt-1.5 flex items-center gap-1">
          {expanded ? <><ChevronUp className="w-3 h-3" /> Menos</> : <><ChevronDown className="w-3 h-3" /> Ver mais</>}
        </button>
      )}
    </div>
  );
}

export function CreateCampaign() {
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const { status, result, error, generate, reset } = useAiStream<CampaignResult>();
  const { toast } = useToast();

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const runGenerate = (charge: () => void) => {
    generate("/api/ai/create-campaign", { product, audience: audience || undefined, goal: goal || undefined }).then((res) => {
      if (res !== null) charge();
    });
  };

  const copyAll = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copiado para a área de transferência" });
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Construtor de Campanha</p>
        <h2 className="text-2xl font-bold text-white mb-1">Criar Campanha</h2>
        <p className="text-muted-foreground text-sm">Gere uma estratégia completa de campanha com copy criado para cada plataforma.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-white">Briefing da Campanha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Produto / Marca</Label>
                <Input placeholder="ex: Garrafa HydroElite" className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" value={product} onChange={(e) => setProduct(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Objetivo da Campanha</Label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-1 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                >
                  <option value="" disabled>Selecionar objetivo</option>
                  <option value="Drive sales">Gerar Vendas</option>
                  <option value="Brand Awareness">Reconhecimento de Marca</option>
                  <option value="Lead Generation">Geração de Leads</option>
                  <option value="Website Traffic">Tráfego para o Site</option>
                  <option value="App Installs">Instalações de App</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Público-alvo (opcional)</Label>
              <Input placeholder="ex: Atletas 25-40, entusiastas de atividades ao ar livre" className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <CreditsGate feature="campaign" onSuccess={runGenerate} disabled={!product.trim() || isGenerating}>
              {({ trigger, isLoading }) => (
                <Button onClick={trigger} disabled={isLoading || isGenerating || !product.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
                  {isLoading || isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Construindo sua campanha...</>
                  ) : "Gerar Campanha"}
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
              <span className="text-sm">Criando sua estratégia de campanha...</span>
            </div>
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="h-40 rounded-lg bg-white/5 border border-white/5 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />))}</div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-red-950/20 border-red-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1"><p className="text-sm font-semibold text-red-400">Falha na geração</p><p className="text-xs text-muted-foreground mt-0.5">{error}</p></div>
                <Button size="sm" variant="outline" onClick={() => { reset(); generate("/api/ai/create-campaign", { product, audience: audience || undefined, goal: goal || undefined }); }} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isDone && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
            <Card className="bg-[#111111] border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base text-white">Estratégia de Campanha</CardTitle>
                  <button onClick={reset} className="ml-auto text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Nova campanha
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/15">
                  <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Manchete</p>
                  <p className="text-white font-bold text-lg leading-snug">{result.headline}</p>
                  <p className="text-muted-foreground text-sm mt-1">{result.subheadline}</p>
                  {result.cta && <p className="text-primary text-sm font-semibold mt-2">CTA: {result.cta}</p>}
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1"><Target className="w-3 h-3" /> Público</p>
                    <p className="text-sm text-white">{result.audience}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1"><Globe className="w-3 h-3" /> Canais</p>
                    <div className="flex flex-wrap gap-1">
                      {result.channels?.map((c) => (<span key={c} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{c}</span>))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Orçamento</p>
                    <p className="text-sm text-white">{result.budget}</p>
                  </div>
                </div>

                {result.uniqueAngle && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/5">
                    <Zap className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div><p className="text-xs text-primary font-medium mb-0.5">Ângulo Único</p><p className="text-xs text-muted-foreground">{result.uniqueAngle}</p></div>
                  </div>
                )}

                {result.copy && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-medium">Copy por Plataforma</p>
                    <div className="grid md:grid-cols-2 gap-3">
                      {Object.entries(result.copy).map(([platform, copy]) => (
                        <CopyBlock key={platform} label={platform} content={copy} />
                      ))}
                    </div>
                  </div>
                )}

                {result.keyMessages?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-medium">Mensagens-chave</p>
                    <div className="space-y-1.5">
                      {result.keyMessages.map((msg, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary font-bold shrink-0 text-xs mt-0.5">{i + 1}</span>
                          <p className="text-muted-foreground text-xs">{msg}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.launchTimeline && (
                  <div className="border-t border-white/5 pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Cronograma de Lançamento</p>
                    <p className="text-sm text-muted-foreground">{result.launchTimeline}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
