import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookMarked, Copy, Trash2, Plus, Search, Check, X, RefreshCw,
  Sparkles, FileText, Wand2, Pencil, ChevronLeft,
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

const TIPO_OPTIONS = [
  "Imagem",
  "Vídeo",
  "Copy",
  "Anúncio",
  "Marketplace",
  "Pesquisa",
  "Estratégia",
  "Automação",
  "Personalizado",
];

const TIPO_COLORS: Record<string, string> = {
  "Imagem": "text-purple-400 bg-purple-400/10 border-purple-400/20",
  "Vídeo": "text-rose-400 bg-rose-400/10 border-rose-400/20",
  "Copy": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Anúncio": "text-amber-400 bg-amber-400/10 border-amber-400/20",
  "Marketplace": "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  "Pesquisa": "text-primary bg-primary/10 border-primary/20",
  "Estratégia": "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  "Automação": "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "Personalizado": "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
};

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

type CreateMode = "manual" | "guided";

export function SavedPrompts() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("guided");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // shared save fields
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newModule, setNewModule] = useState("Personalizado");
  const [saving, setSaving] = useState(false);

  // guided-mode fields
  const [guidedTipo, setGuidedTipo] = useState("");
  const [guidedSubject, setGuidedSubject] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // manual-mode tipo
  const [manualTipo, setManualTipo] = useState("Personalizado");

  // modal state
  const [viewPrompt, setViewPrompt] = useState<SavedPrompt | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [modalCopied, setModalCopied] = useState(false);

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
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.prompt.toLowerCase().includes(q) ||
      p.module.toLowerCase().includes(q)
    );
  });

  const resetCreateForm = () => {
    setCreating(false);
    setNewTitle("");
    setNewPrompt("");
    setNewModule("Personalizado");
    setGuidedTipo("");
    setGuidedSubject("");
    setGenerated(false);
    setManualTipo("Personalizado");
  };

  const switchMode = (mode: CreateMode) => {
    setCreateMode(mode);
    setNewTitle("");
    setNewPrompt("");
    setGenerated(false);
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
    if (viewPrompt?.id === id) setViewPrompt(null);
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    toast({ description: "Prompt excluído" });
  };

  const openView = (p: SavedPrompt) => {
    setViewPrompt(p);
    setEditMode(false);
    setEditTitle(p.title);
    setEditPrompt(p.prompt);
    setModalCopied(false);
  };

  const closeView = () => {
    setViewPrompt(null);
    setEditMode(false);
  };

  const startEdit = () => {
    if (!viewPrompt) return;
    setEditTitle(viewPrompt.title);
    setEditPrompt(viewPrompt.prompt);
    setEditMode(true);
  };

  const saveEdit = async () => {
    if (!viewPrompt || !editTitle.trim() || !editPrompt.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/prompts/${viewPrompt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), prompt: editPrompt.trim() }),
      });
      if (res.ok) {
        const updated = await res.json() as SavedPrompt;
        setPrompts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
        setViewPrompt(updated);
        setEditMode(false);
        toast({ description: "Prompt atualizado" });
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const modalCopy = () => {
    if (!viewPrompt) return;
    navigator.clipboard.writeText(viewPrompt.prompt).then(() => {
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2000);
      toast({ description: "Copiado para a área de transferência" });
    });
  };

  const generatePrompt = async () => {
    if (!guidedTipo || !guidedSubject.trim()) return;
    setGenerating(true);
    setGenerated(false);
    try {
      const res = await fetch("/api/prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: guidedTipo, subject: guidedSubject.trim() }),
      });
      const data = await res.json() as { title?: string; prompt?: string; module?: string; error?: string };
      if (res.ok && data.title && data.prompt) {
        setNewTitle(data.title);
        setNewPrompt(data.prompt);
        setNewModule(guidedTipo);
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

  const saveManualPrompt = async () => {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), prompt: newPrompt.trim(), module: manualTipo }),
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

  const canGenerate = !!guidedTipo && guidedSubject.trim().length > 0;
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
          <p className="text-sm text-zinc-500">Sua biblioteca pessoal de prompts prontos para uso.</p>
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
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                      Tipo de Prompt
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {TIPO_OPTIONS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setGuidedTipo(t)}
                          className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150 ${
                            guidedTipo === t
                              ? "bg-primary/20 text-primary border-primary/40"
                              : "text-zinc-500 border-white/[0.07] hover:text-zinc-300 hover:border-white/15"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                      Assunto
                    </label>
                    <Input
                      value={guidedSubject}
                      onChange={(e) => setGuidedSubject(e.target.value)}
                      placeholder="Digite o assunto principal do prompt"
                      className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-9 text-xs"
                    />
                    <p className="text-[10px] text-zinc-700 px-0.5">
                      Ex: scooter, cadeira gamer, proteção veicular, emagrecimento...
                    </p>
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
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                      Tipo
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {TIPO_OPTIONS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setManualTipo(t)}
                          className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150 ${
                            manualTipo === t
                              ? "bg-primary/20 text-primary border-primary/40"
                              : "text-zinc-500 border-white/[0.07] hover:text-zinc-300 hover:border-white/15"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
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
                  <div className="flex justify-end">
                    <Button
                      onClick={() => void saveManualPrompt()}
                      disabled={!newTitle.trim() || !newPrompt.trim() || saving}
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

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, conteúdo ou tipo..."
            className="pl-9 h-8 text-xs bg-[#0f0f0f] border-white/[0.07] placeholder:text-zinc-700"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!loading && (
          <span className="text-[10px] text-zinc-700 shrink-0">
            {filtered.length} prompt{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
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
          <p className="text-sm font-semibold text-zinc-500">
            {search ? "Nenhum prompt encontrado" : "Nenhum prompt salvo ainda"}
          </p>
          <p className="text-xs text-zinc-700 mt-1 max-w-[220px] leading-relaxed">
            {search
              ? "Tente buscar por outros termos"
              : "Salve os prompts que você usa regularmente para construir sua biblioteca pessoal"}
          </p>
          {!search && (
            <Button onClick={() => setCreating(true)} size="sm" variant="outline"
              className="mt-4 text-xs border-white/[0.10] text-zinc-400 hover:text-white h-8"
            >
              <Plus className="w-3 h-3 mr-1.5" /> Salvar seu primeiro prompt
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-3 sm:grid-cols-2"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
          initial="hidden" animate="show"
        >
          {filtered.map((p) => {
            const tipoColor = TIPO_COLORS[p.module] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
            return (
              <motion.div
                key={p.id}
                variants={fadeUp}
                onClick={() => openView(p)}
                className="group relative bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.12] hover:bg-[#111111] transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-bold text-zinc-200 truncate leading-snug">{p.title}</p>
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${tipoColor}`}>
                    {p.module}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed line-clamp-3 mb-3">{p.prompt}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-700">
                    {new Date(p.createdAt).toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => copyPrompt(p)}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                    >
                      {copiedId === p.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === p.id ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      onClick={() => { openView(p); startEdit(); }}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.05]"
                    >
                      <Pencil className="w-3 h-3" />
                      Editar
                    </button>
                    <button
                      onClick={() => void deletePrompt(p.id)}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-400/10"
                    >
                      <Trash2 className="w-3 h-3" />
                      Excluir
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* View Modal */}
      <AnimatePresence>
        {viewPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={closeView}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#0f0f0f] border border-white/[0.08] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 p-5 pb-4 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {editMode && (
                    <button
                      onClick={() => setEditMode(false)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className="min-w-0">
                    {editMode ? (
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-[#111111] border-white/[0.08] text-zinc-200 h-8 text-sm font-bold"
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm font-bold text-white truncate">{viewPrompt.title}</p>
                    )}
                    {!editMode && (
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${TIPO_COLORS[viewPrompt.module] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20"}`}
                        >
                          {viewPrompt.module}
                        </Badge>
                        <span className="text-[10px] text-zinc-700">
                          {new Date(viewPrompt.createdAt).toLocaleDateString("pt-BR", {
                            day: "numeric", month: "long", year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeView}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {editMode ? (
                  <Textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="bg-[#111111] border-white/[0.08] text-zinc-200 min-h-52 resize-none text-xs leading-relaxed w-full"
                  />
                ) : (
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {viewPrompt.prompt}
                  </p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-2 p-4 pt-3 border-t border-white/[0.06] shrink-0">
                {editMode ? (
                  <>
                    <Button
                      onClick={() => setEditMode(false)}
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-zinc-400 hover:text-white text-xs h-8"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => void saveEdit()}
                      disabled={savingEdit || !editTitle.trim() || !editPrompt.trim()}
                      size="sm"
                      className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-8 ml-auto"
                    >
                      {savingEdit ? "Salvando..." : "Salvar"}
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={modalCopy}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/10 border border-white/[0.07] hover:border-primary/30"
                    >
                      {modalCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {modalCopied ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.05] border border-white/[0.07]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => void deletePrompt(viewPrompt.id)}
                      className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-400/10 border border-white/[0.07] hover:border-red-400/20 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
