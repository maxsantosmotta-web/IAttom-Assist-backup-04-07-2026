import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookMarked, Copy, Trash2, Plus, Search, Check, X, RefreshCw,
  Sparkles, FileText, Megaphone, CheckCircle, Video, Wand2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface SavedPrompt {
  id: number;
  title: string;
  prompt: string;
  module: string;
  createdAt: string;
}

const MODULE_OPTIONS = [
  { value: "all", label: "Todos os Módulos" },
  { value: "product_discovery", label: "Buscar Produtos" },
  { value: "product_validation", label: "Validar Produtos" },
  { value: "campaign", label: "Criar Campanha" },
  { value: "content", label: "Criar Conteúdo" },
  { value: "creative", label: "Gerador Criativo" },
  { value: "video_script", label: "Scripts de Vídeo" },
];

const MODULE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  product_discovery: { label: "Buscar Produtos", color: "text-primary bg-primary/10 border-primary/20", icon: Search },
  product_validation: { label: "Validar", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle },
  campaign: { label: "Campanha", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: Megaphone },
  content: { label: "Conteúdo", color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: FileText },
  creative: { label: "Criativo", color: "text-purple-400 bg-purple-400/10 border-purple-400/20", icon: Sparkles },
  video_script: { label: "Script de Vídeo", color: "text-rose-400 bg-rose-400/10 border-rose-400/20", icon: Video },
};

interface ObjectiveOption {
  label: string;
  objective: string;
  module: string;
}

const OBJECTIVE_OPTIONS: ObjectiveOption[] = [
  {
    label: "Encontrar produtos para vender",
    objective: "Identificar produtos com alta demanda, margem de lucro viável e baixa concorrência para vender online",
    module: "product_discovery",
  },
  {
    label: "Validar se um produto vale a pena",
    objective: "Analisar se o produto tem demanda real, concorrência saudável, margem de lucro e público-alvo definido",
    module: "product_validation",
  },
  {
    label: "Criar campanha de venda",
    objective: "Criar campanha de vendas completa com ângulos, copies, audiência e estratégia de tráfego pago",
    module: "campaign",
  },
  {
    label: "Criar conteúdo para redes sociais",
    objective: "Criar conteúdo engajante para redes sociais que gere autoridade, tráfego orgânico e conversão",
    module: "content",
  },
  {
    label: "Criar imagem/anúncio visual",
    objective: "Criar descrição detalhada para imagem publicitária premium com foco em conversão, visual atraente e benefícios principais do produto",
    module: "creative",
  },
  {
    label: "Criar script de vídeo",
    objective: "Criar roteiro completo de vídeo de vendas com gancho forte, desenvolvimento, prova social e chamada para ação",
    module: "video_script",
  },
  {
    label: "Criar descrição para marketplace",
    objective: "Criar descrição persuasiva para marketplace com título otimizado, benefícios, especificações e palavras-chave de busca",
    module: "content",
  },
  {
    label: "Criar copy de anúncio",
    objective: "Criar copy de anúncio de alta conversão com headline impactante, benefícios claros, objeções respondidas e CTA forte",
    module: "campaign",
  },
  {
    label: "Criar ideias de posts",
    objective: "Criar lista de ideias de posts originais e relevantes para construir audiência e autoridade no nicho",
    module: "content",
  },
  {
    label: "Criar estratégia de venda",
    objective: "Criar estratégia de vendas completa com posicionamento, canais, funil, precificação e diferenciação competitiva",
    module: "campaign",
  },
];

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

type CreateMode = "manual" | "guided";

export function SavedPrompts() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("guided");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // shared fields
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newModule, setNewModule] = useState("product_discovery");
  const [saving, setSaving] = useState(false);

  // guided-mode fields
  const [guidedProduct, setGuidedProduct] = useState("");
  const [selectedObjective, setSelectedObjective] = useState<ObjectiveOption | null>(null);
  const [guidedObservations, setGuidedObservations] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const { toast } = useToast();

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prompts");
      if (res.ok) setPrompts(await res.json() as SavedPrompt[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchPrompts(); }, []);

  const filtered = prompts.filter((p) => {
    const matchModule = filter === "all" || p.module === filter;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.prompt.toLowerCase().includes(search.toLowerCase());
    return matchModule && matchSearch;
  });

  const resetCreateForm = () => {
    setCreating(false);
    setNewTitle("");
    setNewPrompt("");
    setNewModule("product_discovery");
    setGuidedProduct("");
    setSelectedObjective(null);
    setGuidedObservations("");
    setGenerated(false);
  };

  const switchMode = (mode: CreateMode) => {
    setCreateMode(mode);
    setNewTitle("");
    setNewPrompt("");
    setGenerated(false);
  };

  const handleObjectiveSelect = (opt: ObjectiveOption) => {
    setSelectedObjective(opt);
    setNewModule(opt.module);
  };

  const copyPrompt = (p: SavedPrompt) => {
    navigator.clipboard.writeText(p.prompt).then(() => {
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ description: "Copiado para a área de transferência" });
    });
  };

  const deletePrompt = async (id: number) => {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    toast({ description: "Prompt excluído" });
  };

  const generatePrompt = async () => {
    if (!guidedProduct.trim() || !selectedObjective) return;
    setGenerating(true);
    setGenerated(false);
    try {
      const res = await fetch("/api/prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: guidedProduct.trim(),
          objective: selectedObjective.objective,
          module: newModule,
          observations: guidedObservations.trim() || undefined,
        }),
      });
      const data = await res.json() as { title?: string; prompt?: string; error?: string };
      if (res.ok && data.title && data.prompt) {
        setNewTitle(data.title);
        setNewPrompt(data.prompt);
        setGenerated(true);
        toast({ description: "Prompt gerado. Revise e salve." });
      } else {
        toast({ description: data.error ?? "Erro ao gerar prompt. Tente novamente.", variant: "destructive" });
      }
    } catch {
      toast({ description: "Erro de conexão. Tente novamente.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const savePrompt = async () => {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), prompt: newPrompt.trim(), module: newModule }),
      });
      if (res.ok) {
        const created = await res.json() as SavedPrompt;
        setPrompts((prev) => [created, ...prev]);
        resetCreateForm();
        toast({ description: "Prompt salvo" });
      }
    } finally {
      setSaving(false);
    }
  };

  const canGenerate = guidedProduct.trim().length > 0 && selectedObjective !== null;
  const canSave = newTitle.trim().length > 0 && newPrompt.trim().length > 0;

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-4"
      >
        <div className="space-y-1">
          <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Biblioteca</p>
          <h2 className="text-2xl font-black tracking-tight text-white">Prompts Salvos</h2>
          <p className="text-sm text-zinc-500">Sua biblioteca pessoal de prompts em todos os módulos.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void fetchPrompts()}
            disabled={loading}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            onClick={() => setCreating(true)}
            size="sm"
            className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Prompt
          </Button>
        </div>
      </motion.div>

      {/* Create Form */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-[#0f0f0f] border border-primary/20 rounded-2xl p-5 space-y-4">
              {/* Form header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">Novo Prompt</p>
                <button onClick={resetCreateForm} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode toggle */}
              <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg w-fit">
                <button
                  onClick={() => switchMode("guided")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                    createMode === "guided" ? "bg-primary text-black" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Wand2 className="w-3 h-3" />
                  Criação Guiada
                </button>
                <button
                  onClick={() => switchMode("manual")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                    createMode === "manual" ? "bg-primary text-black" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  Manual
                </button>
              </div>

              {/* GUIDED MODE */}
              {createMode === "guided" && (
                <motion.div
                  key="guided"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  {/* Step 1: Module */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                      1. Módulo de destino
                    </label>
                    <select
                      value={newModule}
                      onChange={(e) => setNewModule(e.target.value)}
                      className="w-full h-9 text-xs rounded-lg bg-[#111111] border border-white/[0.08] text-zinc-300 px-3 outline-none"
                    >
                      {MODULE_OPTIONS.filter((m) => m.value !== "all").map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Product */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                      2. Produto / Nicho
                    </label>
                    <Input
                      value={guidedProduct}
                      onChange={(e) => setGuidedProduct(e.target.value)}
                      placeholder="Ex: suplementos fitness, curso de inglês, Scooter X11..."
                      className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-9 text-xs"
                    />
                  </div>

                  {/* Step 3: Objective selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                      3. O que você quer criar?
                    </label>
                    <div className="relative">
                      <select
                        value={selectedObjective?.label ?? ""}
                        onChange={(e) => {
                          const opt = OBJECTIVE_OPTIONS.find((o) => o.label === e.target.value) ?? null;
                          if (opt) handleObjectiveSelect(opt);
                        }}
                        className="w-full h-9 text-xs rounded-lg bg-[#111111] border border-white/[0.08] text-zinc-300 px-3 pr-8 outline-none appearance-none"
                      >
                        <option value="" disabled>Selecione o objetivo...</option>
                        {OBJECTIVE_OPTIONS.map((opt) => (
                          <option key={opt.label} value={opt.label}>{opt.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
                    </div>
                    {selectedObjective && (
                      <p className="text-[10px] text-zinc-700 leading-relaxed px-1">
                        Módulo ajustado para: <span className="text-zinc-500">{MODULE_OPTIONS.find((m) => m.value === newModule)?.label}</span>
                      </p>
                    )}
                  </div>

                  {/* Observations (optional) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                      Observações <span className="text-zinc-700 normal-case tracking-normal font-normal">(opcional)</span>
                    </label>
                    <Input
                      value={guidedObservations}
                      onChange={(e) => setGuidedObservations(e.target.value)}
                      placeholder="Ex: público iniciante, sem investimento inicial, tom descontraído..."
                      className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-9 text-xs"
                    />
                  </div>

                  <Button
                    onClick={() => void generatePrompt()}
                    disabled={!canGenerate || generating}
                    size="sm"
                    className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-9 w-full gap-2 disabled:opacity-40"
                  >
                    <Wand2 className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
                    {generating ? "Gerando prompt..." : "Gerar Prompt"}
                  </Button>

                  {/* Generated result — editable before save */}
                  <AnimatePresence>
                    {generated && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3 pt-3 border-t border-white/[0.06]"
                      >
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">
                          Prompt gerado — revise e salve
                        </p>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Título</label>
                          <Input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="bg-[#111111] border-white/[0.08] text-zinc-200 h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Prompt</label>
                          <Textarea
                            value={newPrompt}
                            onChange={(e) => setNewPrompt(e.target.value)}
                            className="bg-[#111111] border-white/[0.08] text-zinc-200 h-40 resize-none text-xs leading-relaxed"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => void generatePrompt()}
                            disabled={generating}
                            size="sm"
                            variant="outline"
                            className="border-white/10 text-zinc-400 hover:text-white text-xs h-9 gap-1.5"
                          >
                            <Wand2 className="w-3 h-3" />
                            Gerar novamente
                          </Button>
                          <Button
                            onClick={() => void savePrompt()}
                            disabled={!canSave || saving}
                            size="sm"
                            className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-9 px-5 ml-auto"
                          >
                            {saving ? "Salvando..." : "Salvar Prompt"}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* MANUAL MODE */}
              {createMode === "manual" && (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Título do prompt..."
                    className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-9"
                  />
                  <Textarea
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="Cole seu prompt aqui..."
                    className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-28 resize-none text-sm"
                  />
                  <div className="flex items-center gap-3">
                    <select
                      value={newModule}
                      onChange={(e) => setNewModule(e.target.value)}
                      className="flex-1 h-9 text-xs rounded-lg bg-[#111111] border border-white/[0.08] text-zinc-300 px-3 outline-none"
                    >
                      {MODULE_OPTIONS.filter((m) => m.value !== "all").map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <Button
                      onClick={() => void savePrompt()}
                      disabled={!canSave || saving}
                      size="sm"
                      className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-9 px-4"
                    >
                      {saving ? "Salvando..." : "Salvar Prompt"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar prompts..."
            className="pl-9 h-8 text-xs bg-[#0f0f0f] border-white/[0.07] placeholder:text-zinc-700"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {MODULE_OPTIONS.map((m) => (
            <button
              key={m.value}
              onClick={() => setFilter(m.value)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 ${
                filter === m.value
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-zinc-600 hover:text-zinc-300 border border-white/[0.06]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompts Grid */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 bg-white/[0.025] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/[0.07] rounded-2xl"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mx-auto mb-4">
            <BookMarked className="w-5 h-5 text-zinc-700" />
          </div>
          <p className="text-sm font-semibold text-zinc-500">Nenhum prompt salvo ainda</p>
          <p className="text-xs text-zinc-700 mt-1 max-w-[220px] leading-relaxed">
            Salve os prompts que você usa regularmente para construir sua biblioteca pessoal
          </p>
          <Button onClick={() => setCreating(true)} size="sm" variant="outline"
            className="mt-4 text-xs border-white/[0.10] text-zinc-400 hover:text-white h-8"
          >
            <Plus className="w-3 h-3 mr-1.5" /> Salvar seu primeiro prompt
          </Button>
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-3 sm:grid-cols-2"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
          initial="hidden" animate="show"
        >
          {filtered.map((p) => {
            const meta = MODULE_META[p.module];
            const Icon = meta?.icon ?? BookMarked;
            return (
              <motion.div key={p.id} variants={fadeUp}
                className="group relative bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.10] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center shrink-0">
                      <Icon className="w-3 h-3 text-zinc-500" />
                    </div>
                    <p className="text-xs font-bold text-zinc-200 truncate">{p.title}</p>
                  </div>
                  {meta && (
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${meta.color}`}>
                      {meta.label}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed line-clamp-3 mb-3">{p.prompt}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-700">
                    {new Date(p.createdAt).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button
                      onClick={() => copyPrompt(p)}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                    >
                      {copiedId === p.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === p.id ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      onClick={() => deletePrompt(p.id)}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-400/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
