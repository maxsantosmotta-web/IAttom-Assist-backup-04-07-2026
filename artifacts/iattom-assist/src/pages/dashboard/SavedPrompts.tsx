import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Plus, Save, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSavedItems } from "@/hooks/useSavedItems";
import { CreditsGate } from "@/components/CreditsGate";
import { ModuleLockGate } from "@/components/ModuleLockGate";
import { useUserAccess } from "@/hooks/useUserAccess";

const TIPO_OPTIONS = [
  "Imagem",
  "Vídeo com Imagem",
  "Vídeo",
  "Copy",
  "Anúncio",
  "Marketplace",
  "Pesquisa",
  "Estratégia",
  "Automação",
  "Personalizado",
];

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

export function SavedPrompts() {
  const { planSlug, isAdmin } = useUserAccess();
  const { toast } = useToast();
  const { saveItem } = useSavedItems();
  const [creating, setCreating] = useState(false);
  const [guidedTipo, setGuidedTipo] = useState("");
  const [guidedSubject, setGuidedSubject] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const chargedRef = useRef(false);
  const generateTriggerRef = useRef<(() => void) | null>(null);

  const resetCreateForm = () => {
    setCreating(false);
    setGuidedTipo("");
    setGuidedSubject("");
    setGenerated(false);
    setNewTitle("");
    setNewPrompt("");
  };

  const startNewPrompt = () => {
    setCreating(true);
    setGuidedTipo("");
    setGuidedSubject("");
    setGenerated(false);
    setNewTitle("");
    setNewPrompt("");
  };

  const generatePromptCore = async () => {
    setGenerating(true);
    setGenerated(false);
    try {
      const res = await fetch("/api/prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: guidedTipo, subject: guidedSubject.trim() }),
      });
      const data = await res.json() as { title?: string; prompt?: string; error?: string };
      if (res.ok && data.title && data.prompt) {
        setNewTitle(data.title);
        setNewPrompt(data.prompt);
        setGenerated(true);
        toast({ description: "Prompt gerado. Revise e salve." });
      } else {
        if (chargedRef.current) {
          void fetch("/api/credits/refund", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feature: "prompt_creation" }),
          });
        }
        toast({ description: data.error ?? "Erro ao gerar prompt. Tente novamente.", variant: "destructive" });
      }
    } catch {
      if (chargedRef.current) {
        void fetch("/api/credits/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feature: "prompt_creation" }),
        });
      }
      toast({ description: "Erro de conexão. Tente novamente.", variant: "destructive" });
    } finally {
      setGenerating(false);
      chargedRef.current = false;
    }
  };

  const copyAll = async () => {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    await navigator.clipboard.writeText(`${newTitle.trim()}\n\n${newPrompt.trim()}`);
    toast({ description: "Prompt copiado" });
  };

  const savePrompt = async () => {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const title = newTitle.trim();
      const content = newPrompt.trim();
      const data = JSON.stringify({
        briefing: { tipo: guidedTipo, subject: guidedSubject.trim() },
        result: { title, prompt: content },
      });
      try {
        const raw = localStorage.getItem("iattom_saved_items_v1");
        const existing = raw ? (JSON.parse(raw) as object[]) : [];
        existing.unshift({ id, title, type: "prompt", content, data, createdAt: new Date().toISOString() });
        localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
      } catch {}
      await saveItem({ id, title, type: "prompt", content, data });
      toast({ description: "Prompt salvo na Biblioteca" });
    } catch {
      toast({ description: "Não foi possível salvar na Biblioteca.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canGenerate = !!guidedTipo && guidedSubject.trim().length > 0;
  const canUseResult = newTitle.trim().length > 0 && newPrompt.trim().length > 0;

  if (!isAdmin && !["pro", "business", "agency"].includes(planSlug)) {
    return <ModuleLockGate allowedPlans={["pro", "business", "agency"]} moduleName="Criar Prompt" />;
  }

  return (
    <div className="space-y-6 pb-4">
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }} className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Biblioteca</p>
          <h2 className="text-2xl font-black tracking-tight text-white">Criar Prompt</h2>
          <p className="text-sm text-zinc-500">Crie, salve e reutilize seus prompts.</p>
        </div>
        <div className="shrink-0">
          <Button onClick={startNewPrompt} size="sm" className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-8">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Prompt
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="bg-[#0f0f0f] border border-primary/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">Novo Prompt</p>
                <button onClick={resetCreateForm} className="text-zinc-600 hover:text-zinc-400 transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Tipo de Prompt</label>
                <div className="flex flex-wrap gap-1.5">
                  {TIPO_OPTIONS.map((tipo) => (
                    <button key={tipo} onClick={() => setGuidedTipo(tipo)} className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150 ${guidedTipo === tipo ? "bg-primary/20 text-primary border-primary/40" : "text-zinc-500 border-white/[0.07] hover:text-zinc-300 hover:border-white/15"}`}>
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Assunto</label>
                <Textarea
                  value={guidedSubject}
                  onChange={(event) => setGuidedSubject(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && canGenerate && !generating) { event.preventDefault(); generateTriggerRef.current?.(); } }}
                  placeholder="Digite o assunto principal do prompt"
                  className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 min-h-24 resize-none text-xs"
                />
                <p className="text-[10px] text-zinc-700 px-0.5">Ex: scooter, cadeira gamer, proteção veicular, emagrecimento...</p>
              </div>

              <CreditsGate
                feature="prompt_creation"
                onSuccess={(charge) => {
                  charge();
                  chargedRef.current = true;
                  void generatePromptCore();
                }}
                disabled={!canGenerate || generating}
              >
                {({ trigger, isLoading }) => {
                  generateTriggerRef.current = trigger;
                  return (
                    <Button onClick={trigger} disabled={!canGenerate || generating || isLoading} size="sm" className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-9 w-full gap-2 disabled:opacity-40">
                      <Wand2 className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
                      {generating ? "Gerando prompt..." : "Gerar Prompt"}
                    </Button>
                  );
                }}
              </CreditsGate>

              <AnimatePresence>
                {generated && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Prompt gerado — revise e salve</p>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Título</label>
                      <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="bg-[#111111] border-white/[0.08] text-zinc-200 h-9 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Prompt</label>
                      <Textarea value={newPrompt} onChange={(event) => setNewPrompt(event.target.value)} className="bg-[#111111] border-white/[0.08] text-zinc-200 h-40 resize-none text-xs leading-relaxed" />
                    </div>
                    <div className="flex justify-end items-center gap-3">
                      <button onClick={() => void copyAll()} disabled={!canUseResult} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1 disabled:opacity-40">
                        <Copy className="w-3 h-3" /> Copiar tudo
                      </button>
                      <button onClick={() => void savePrompt()} disabled={!canUseResult || saving} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-40">
                        <Save className="w-3 h-3" /> {saving ? "Salvando..." : "Salvar"}
                      </button>
                      <button onClick={startNewPrompt} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Novo
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
