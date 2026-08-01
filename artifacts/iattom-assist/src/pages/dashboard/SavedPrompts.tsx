import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Plus, Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSavedItems } from "@/hooks/useSavedItems";
import { CreditsGate } from "@/components/CreditsGate";
import { ModuleLockGate } from "@/components/ModuleLockGate";
import { useUserAccess } from "@/hooks/useUserAccess";
import { PromptImageReferencePicker, type PromptImageReference } from "@/components/prompts/PromptImageReferencePicker";

interface LegacyPrompt {
  id: number;
  title: string;
  prompt: string;
  module: string;
  createdAt: string;
}

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

const TIPO_INFO: Record<string, { description: string; example: string }> = {
  "Imagem": {
    description: "Cria prompts para gerar imagens profissionais, definindo cenário, composição, iluminação, estilo visual e acabamento.",
    example: "Exemplo: uma moto esportiva preta em uma rua molhada à noite, com luzes neon.",
  },
  "Vídeo com Imagem": {
    description: "Cria prompts para dar movimento a uma imagem pronta, definindo câmera, efeitos, elementos que podem se mover e o que deve permanecer fixo.",
    example: "Exemplo: movimentar a fumaça e os reflexos, mantendo a moto e o enquadramento preservados.",
  },
  "Vídeo": {
    description: "Cria prompts para vídeos completos, com cenas, ações, narrativa, ritmo, enquadramento e direção visual.",
    example: "Exemplo: vídeo curto apresentando uma scooter elétrica em um cenário urbano.",
  },
  "Copy": {
    description: "Cria prompts para textos persuasivos de vendas, com headline, benefícios, objeções e chamada para ação.",
    example: "Exemplo: copy para vender proteção veicular com economia e assistência 24 horas.",
  },
  "Anúncio": {
    description: "Cria prompts para anúncios pagos ou orgânicos, considerando público, plataforma, objetivo, oferta e formato.",
    example: "Exemplo: anúncio para Instagram de uma scooter elétrica seminova.",
  },
  "Marketplace": {
    description: "Cria prompts para títulos, descrições e apresentações de produtos em marketplaces, com foco em clareza e conversão.",
    example: "Exemplo: anúncio completo de uma scooter elétrica para marketplace.",
  },
  "Pesquisa": {
    description: "Cria prompts para pesquisar mercado, concorrência, tendências, demanda, oportunidades e comportamento do público.",
    example: "Exemplo: analisar a demanda por scooters elétricas em uma cidade específica.",
  },
  "Estratégia": {
    description: "Cria prompts para planejar posicionamento, vendas, canais, precificação, diferenciação e crescimento.",
    example: "Exemplo: estratégia para lançar um serviço regional de proteção veicular.",
  },
  "Automação": {
    description: "Cria prompts para organizar fluxos automáticos de mensagens, condições e ações em ferramentas de atendimento e marketing.",
    example: "Exemplo: enviar uma mensagem no direct quando alguém comentar EU QUERO.",
  },
  "Personalizado": {
    description: "Cria um prompt sob medida para uma necessidade específica que não se encaixe nas outras categorias.",
    example: "Exemplo: montar um plano personalizado de organização, estudo, análise ou planejamento.",
  },
};

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

export function SavedPrompts() {
  const { planSlug, isAdmin } = useUserAccess();
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const { toast } = useToast();
  const { saveItem, getItems } = useSavedItems();
  const [guidedTipo, setGuidedTipo] = useState("");
  const [pendingTipo, setPendingTipo] = useState<string | null>(null);
  const [guidedSubject, setGuidedSubject] = useState("");
  const [referenceImage, setReferenceImage] = useState<PromptImageReference | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const pendingChargeRef = useRef<(() => Promise<void>) | null>(null);
  const generateTriggerRef = useRef<(() => void) | null>(null);
  const migrationStartedRef = useRef(false);
  const subjectInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || migrationStartedRef.current) return;
    migrationStartedRef.current = true;

    const migrateLegacyPrompts = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const response = await fetch("/api/prompts", {
          credentials: "include",
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const legacyPrompts = await response.json() as LegacyPrompt[];
        if (!Array.isArray(legacyPrompts) || legacyPrompts.length === 0) return;

        const currentItems = await getItems();
        const existingPromptKeys = new Set(
          currentItems
            .filter((item) => item.type === "prompt")
            .map((item) => `${item.title.trim()}\n${(item.content ?? "").trim()}`),
        );

        let migrated = 0;
        for (const prompt of legacyPrompts) {
          const title = prompt.title.trim();
          const content = prompt.prompt.trim();
          const key = `${title}\n${content}`;
          if (!title || !content || existingPromptKeys.has(key)) continue;

          const id = `legacy-prompt-${prompt.id}`;
          const data = JSON.stringify({
            briefing: { tipo: prompt.module || "Personalizado", subject: "" },
            result: { title, prompt: content },
            legacyPromptId: prompt.id,
            migratedAt: new Date().toISOString(),
          });

          await saveItem({ id, title, type: "prompt", content, data });
          existingPromptKeys.add(key);
          migrated += 1;
        }

        if (migrated > 0) {
          const refreshed = await getItems();
          try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify(refreshed)); } catch {}
          toast({ description: `${migrated} prompt${migrated > 1 ? "s" : ""} antigo${migrated > 1 ? "s" : ""} restaurado${migrated > 1 ? "s" : ""} na Biblioteca.` });
        }
      } catch {
        migrationStartedRef.current = false;
      }
    };

    void migrateLegacyPrompts();
  }, [authLoaded, isSignedIn, getToken, getItems, saveItem, toast]);

  const clearForm = () => {
    setGuidedTipo("");
    setPendingTipo(null);
    setGuidedSubject("");
    setReferenceImage(null);
    setGenerated(false);
    setNewTitle("");
    setNewPrompt("");
    pendingChargeRef.current = null;
  };

  const selectPromptType = (tipo: string) => {
    setGuidedTipo(tipo);
    setPendingTipo(tipo);
    if (tipo !== "Vídeo com Imagem") setReferenceImage(null);
  };

  const continueWithType = () => {
    setPendingTipo(null);
    if (guidedTipo !== "Vídeo com Imagem") {
      window.setTimeout(() => subjectInputRef.current?.focus(), 0);
    }
  };

  const generatePromptCore = async () => {
    if (generating) return;
    setGenerating(true);
    setGenerated(false);
    try {
      const res = await fetch("/api/prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: guidedTipo,
          subject: guidedTipo === "Vídeo com Imagem" ? "" : guidedSubject.trim(),
          ...(guidedTipo === "Vídeo com Imagem" && referenceImage
            ? { referenceImage: { base64: referenceImage.base64, mimeType: referenceImage.mimeType } }
            : {}),
        }),
      });
      const data = await res.json() as { title?: string; prompt?: string; error?: string };
      if (res.ok && data.title?.trim() && data.prompt?.trim()) {
        const charge = pendingChargeRef.current;
        pendingChargeRef.current = null;
        if (charge) await charge();
        setNewTitle(data.title.trim());
        setNewPrompt(data.prompt.trim());
        setGenerated(true);
        toast({ description: "Prompt gerado. Revise e salve." });
      } else {
        pendingChargeRef.current = null;
        toast({ description: data.error ?? "Erro ao gerar prompt. Tente novamente.", variant: "destructive" });
      }
    } catch {
      pendingChargeRef.current = null;
      toast({ description: "Não foi possível concluir a geração e a cobrança do prompt. Tente novamente.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyAll = async () => {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    await navigator.clipboard.writeText(`${newTitle.trim()}\n\n${newPrompt.trim()}`);
    toast({ description: "Prompt copiado" });
  };

  const savePrompt = async () => {
    if (!newTitle.trim() || !newPrompt.trim() || saving) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const title = newTitle.trim();
      const content = newPrompt.trim();
      const data = JSON.stringify({
        briefing: {
          tipo: guidedTipo,
          subject: guidedTipo === "Vídeo com Imagem" ? "" : guidedSubject.trim(),
          referenceImageName: referenceImage?.name,
          referenceImageOrigin: referenceImage?.origin,
        },
        result: { title, prompt: content },
      });
      await saveItem({ id, title, type: "prompt", content, data });
      toast({ description: "Prompt salvo na Biblioteca" });
    } catch {
      toast({ description: "Não foi possível salvar na Biblioteca.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const requiresReferenceImage = guidedTipo === "Vídeo com Imagem";
  const canGenerate = !!guidedTipo
    && (requiresReferenceImage ? referenceImage !== null : guidedSubject.trim().length > 0);
  const canUseResult = newTitle.trim().length > 0 && newPrompt.trim().length > 0;

  if (!isAdmin && !["pro", "business", "agency"].includes(planSlug)) {
    return <ModuleLockGate allowedPlans={["pro", "business", "agency"]} moduleName="Criar Prompt" />;
  }

  return (
    <div className="space-y-6 pb-4">
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}>
        <div className="space-y-1">
          <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Biblioteca</p>
          <h2 className="text-2xl font-black tracking-tight text-white">Criar Prompt</h2>
          <p className="text-sm text-zinc-500">Crie, salve e reutilize seus prompts.</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div className="bg-[#0f0f0f] border border-primary/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">Novo Prompt</p>
            <button type="button" onClick={clearForm} disabled={generating || saving} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40">Limpar</button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Tipo de Prompt</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPO_OPTIONS.map((tipo) => (
                <button type="button" key={tipo} onClick={() => selectPromptType(tipo)} disabled={generating || saving} className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150 disabled:opacity-40 ${guidedTipo === tipo ? "bg-primary/20 text-primary border-primary/40" : "text-zinc-500 border-white/[0.07] hover:text-zinc-300 hover:border-white/15"}`}>
                  {tipo}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {pendingTipo && (
                <motion.div
                  key={pendingTipo}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-xl border border-primary/25 bg-primary/[0.07] p-4 space-y-3"
                >
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-primary">{pendingTipo}</p>
                    <p className="text-sm leading-relaxed text-white">{TIPO_INFO[pendingTipo]?.description}</p>
                    <p className="text-xs leading-relaxed text-zinc-300">{TIPO_INFO[pendingTipo]?.example}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setPendingTipo(null)} className="h-8 border-white/20 text-xs font-semibold text-white hover:bg-white/5 hover:text-white">
                      Sair
                    </Button>
                    <Button type="button" size="sm" onClick={continueWithType} className="h-8 bg-primary px-4 text-xs font-bold text-black hover:bg-primary/90">
                      Continuar
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {guidedTipo === "Vídeo com Imagem" && (
            <PromptImageReferencePicker
              value={referenceImage}
              onChange={setReferenceImage}
              disabled={generating || saving}
            />
          )}

          {guidedTipo !== "Vídeo com Imagem" && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Assunto</label>
              <Textarea
                ref={subjectInputRef}
                value={guidedSubject}
                onChange={(event) => setGuidedSubject(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && canGenerate && !generating) { event.preventDefault(); generateTriggerRef.current?.(); } }}
                placeholder="Digite o assunto principal do prompt"
                disabled={generating || saving}
                className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 min-h-24 resize-none text-xs"
              />
              <p className="text-[10px] text-zinc-700 px-0.5">Ex: scooter, cadeira gamer, proteção veicular, emagrecimento...</p>
            </div>
          )}

          <CreditsGate
            feature="prompt_creation"
            onSuccess={(charge) => {
              pendingChargeRef.current = charge;
              void generatePromptCore();
            }}
            disabled={!canGenerate || generating || saving}
          >
            {({ trigger, isLoading }) => {
              generateTriggerRef.current = trigger;
              return (
                <Button type="button" onClick={trigger} disabled={!canGenerate || generating || saving || isLoading} size="sm" className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-9 w-full gap-2 disabled:opacity-40">
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
                  <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} disabled={saving} className="bg-[#111111] border-white/[0.08] text-zinc-200 h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Prompt</label>
                  <Textarea value={newPrompt} onChange={(event) => setNewPrompt(event.target.value)} disabled={saving} className="bg-[#111111] border-white/[0.08] text-zinc-200 h-40 resize-none text-xs leading-relaxed" />
                </div>
                <div className="flex justify-end items-center gap-3">
                  <button type="button" onClick={() => void copyAll()} disabled={!canUseResult || saving} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1 disabled:opacity-40">
                    <Copy className="w-3 h-3" /> Copiar tudo
                  </button>
                  <button type="button" onClick={() => void savePrompt()} disabled={!canUseResult || saving} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-40">
                    <Save className="w-3 h-3" /> {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button type="button" onClick={clearForm} disabled={generating || saving} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1 disabled:opacity-40">
                    <Plus className="w-3 h-3" /> Novo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
