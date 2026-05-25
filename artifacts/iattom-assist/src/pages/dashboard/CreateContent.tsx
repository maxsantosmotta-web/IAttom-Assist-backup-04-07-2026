import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2, Copy, RefreshCw, AlertCircle, Hash, Mail, MessageSquare, Twitter, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import type { ContentResult } from "@/types/ai";

function ContentTab({ content, label, icon: Icon }: { content: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  const { toast } = useToast();
  return (
    <Card className="bg-[#111111] border-primary/20">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(content); toast({ description: "Copiado!" }); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar
          </button>
        </div>
        <Textarea
          className="min-h-[280px] bg-transparent border-0 text-sm text-muted-foreground leading-relaxed resize-none focus-visible:ring-0 p-4"
          value={content}
          readOnly
        />
      </CardContent>
    </Card>
  );
}

export function CreateContent() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const { status, result, error, generate, reset } = useAiStream<ContentResult>();
  const { toast } = useToast();

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const [restoredResult, setRestoredResult] = useState<ContentResult | null>(null);
  const isRestoredMode = !!restoredResult && status === "idle";
  const activeResult = result ?? restoredResult;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("iattom_restore_content_v1");
      if (!raw) return;
      sessionStorage.removeItem("iattom_restore_content_v1");
      const saved = JSON.parse(raw) as { briefing?: { topic?: string; tone?: string; additionalContext?: string }; result?: ContentResult };
      if (saved.briefing?.topic) setTopic(saved.briefing.topic);
      if (saved.briefing?.tone) setTone(saved.briefing.tone);
      if (saved.briefing?.additionalContext) setAdditionalContext(saved.briefing.additionalContext);
      if (saved.result) setRestoredResult(saved.result);
    } catch {}
  }, []);

  const runGenerate = (charge: () => void) => {
    generate("/api/ai/create-content", { topic, tone: tone || undefined, additionalContext: additionalContext || undefined }).then((res) => {
      if (res !== null) charge();
    });
  };

  const handleSave = () => {
    if (!activeResult) return;
    const lines: string[] = [];
    if (activeResult.seoTitle) lines.push(`TÍTULO SEO: ${activeResult.seoTitle}`);
    if (activeResult.seoDescription) lines.push(`META DESCRIÇÃO: ${activeResult.seoDescription}`);
    if (activeResult.blog) lines.push(`\nBLOG:\n${activeResult.blog}`);
    if (activeResult.social) lines.push(`\nSOCIAL:\n${activeResult.social}`);
    if (activeResult.email) lines.push(`\nE-MAIL:\n${activeResult.email}`);
    if (activeResult.tweetThread) lines.push(`\nTHREAD:\n${activeResult.tweetThread}`);
    if (activeResult.smsText) lines.push(`\nSMS:\n${activeResult.smsText}`);
    const content = lines.join("\n");
    const title = topic.trim() || activeResult.seoTitle || "Conteúdo gerado";
    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift({
        id: crypto.randomUUID(),
        title,
        type: "content",
        content,
        data: JSON.stringify({ briefing: { topic, tone, additionalContext }, result: activeResult }),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
      toast({ description: "Salvo com sucesso." });
    } catch {
      toast({ description: "Erro ao salvar.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Estúdio de Conteúdo IA</p>
        <h2 className="text-2xl font-bold text-white mb-1">Criar Conteúdo</h2>
        <p className="text-muted-foreground text-sm">Gere um pacote completo de conteúdo — blog, redes sociais, e-mail, SMS — com um único prompt.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Briefing de Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Tópico / Produto</Label>
                <Input placeholder="ex: Lançamento da Garrafa HydroElite" className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" value={topic} onChange={(e) => setTopic(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Tom de Voz</Label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-1 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                >
                  <option value="" disabled>Escolha o tom</option>
                  <option value="Bold and direct">Direto e Impactante</option>
                  <option value="Professional">Profissional</option>
                  <option value="Conversational">Conversacional</option>
                  <option value="Inspirational">Inspiracional</option>
                  <option value="Witty and humorous">Espirituoso e Humorístico</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Contexto Adicional (opcional)</Label>
              <Textarea placeholder="Público-alvo, benefícios principais, diferenciais, faixa de preço..." className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50 resize-none" rows={2} value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} />
            </div>
            <CreditsGate feature="content" onSuccess={runGenerate} disabled={!topic.trim() || isGenerating}>
              {({ trigger, isLoading }) => (
                <Button onClick={trigger} disabled={isLoading || isGenerating || !topic.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
                  {isLoading || isGenerating ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando pacote de conteúdo...</>) : "Gerar Pacote de Conteúdo"}
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
              <span className="text-sm">Escrevendo seu pacote de conteúdo para <span className="text-white">"{topic}"</span>...</span>
            </div>
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="h-48 rounded-lg bg-white/5 border border-white/5 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />))}</div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-red-950/20 border-red-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1"><p className="text-sm font-semibold text-red-400">Falha na geração</p><p className="text-xs text-muted-foreground">{error}</p></div>
                <Button size="sm" variant="outline" onClick={() => { reset(); generate("/api/ai/create-content", { topic, tone: tone || undefined, additionalContext: additionalContext || undefined }); }} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(isDone || isRestoredMode) && activeResult && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            {isRestoredMode && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <p className="text-xs text-primary">Conteúdo restaurado de Projetos Salvos</p>
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Pacote de Conteúdo Pronto</h3>
              <div className="flex items-center gap-3">
                <button onClick={handleSave} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"><Save className="w-3 h-3" /> Salvar</button>
                <button onClick={() => { reset(); setRestoredResult(null); }} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> Novo conteúdo</button>
              </div>
            </div>

            {activeResult.seoTitle && (
              <div className="mb-4 grid md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs text-primary font-medium mb-0.5">Título SEO</p>
                  <p className="text-sm text-white">{activeResult.seoTitle}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs text-primary font-medium mb-0.5">Meta Descrição</p>
                  <p className="text-sm text-muted-foreground">{activeResult.seoDescription}</p>
                </div>
              </div>
            )}

            <Tabs defaultValue="blog">
              <TabsList className="bg-[#111111] border border-white/5 flex-wrap h-auto gap-1 p-1 mb-4">
                {[
                  { value: "blog", label: "Blog", icon: FileText },
                  { value: "social", label: "Social", icon: Hash },
                  { value: "email", label: "E-mail", icon: Mail },
                  { value: "tweet", label: "Thread", icon: Twitter },
                  { value: "sms", label: "SMS", icon: MessageSquare },
                ].map(({ value, label, icon: Icon }) => (
                  activeResult[value === "tweet" ? "tweetThread" : value === "sms" ? "smsText" : value as keyof ContentResult] && (
                    <TabsTrigger key={value} value={value} className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs">
                      <Icon className="w-3 h-3 mr-1" />{label}
                    </TabsTrigger>
                  )
                ))}
              </TabsList>

              {activeResult.blog && <TabsContent value="blog"><ContentTab content={activeResult.blog} label="Post de Blog" icon={FileText} /></TabsContent>}
              {activeResult.social && <TabsContent value="social"><ContentTab content={activeResult.social} label="Legenda Social" icon={Hash} /></TabsContent>}
              {activeResult.email && <TabsContent value="email"><ContentTab content={activeResult.email} label="Copy de E-mail" icon={Mail} /></TabsContent>}
              {activeResult.tweetThread && <TabsContent value="tweet"><ContentTab content={activeResult.tweetThread} label="Thread de Tweets" icon={Twitter} /></TabsContent>}
              {activeResult.smsText && <TabsContent value="sms"><ContentTab content={activeResult.smsText} label="Mensagem SMS" icon={MessageSquare} /></TabsContent>}
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
