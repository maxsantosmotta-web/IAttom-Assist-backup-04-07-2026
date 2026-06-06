import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookMarked, Copy, Trash2, Plus, Search, Check, X, RefreshCw,
  Wand2, Pencil, ChevronLeft, AlertTriangle,
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

// Colors per spec: Roxo / Rosa / Dourado / Laranja / Azul / Verde-Teal / Lilás / Ciano / Cinza Premium
const TIPO_COLORS: Record<string, string> = {
  "Imagem":       "text-violet-400 bg-violet-400/10 border-violet-400/20",
  "Vídeo":        "text-rose-400 bg-rose-400/10 border-rose-400/20",
  "Copy":         "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  "Anúncio":      "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "Marketplace":  "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Pesquisa":     "text-teal-400 bg-teal-400/10 border-teal-400/20",
  "Estratégia":   "text-purple-300 bg-purple-300/10 border-purple-300/20",
  "Automação":    "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  "Personalizado":"text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
};

// Map old module keys (legacy DB values) to PT-BR display labels
const LEGACY_MODULE_LABEL: Record<string, string> = {
  creative:          "Imagem",
  video_script:      "Vídeo",
  campaign:          "Anúncio",
  content:           "Personalizado",
  product_discovery: "Pesquisa",
  product_validation:"Pesquisa",
};

function resolveLabel(module: string): string {
  if (TIPO_OPTIONS.includes(module)) return module;
  return LEGACY_MODULE_LABEL[module] ?? module;
}

function resolveColor(module: string): string {
  const label = resolveLabel(module);
  return TIPO_COLORS[label] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
}

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

export function SavedPrompts() {
  const [prompts, setPrompts]     = useState<SavedPrompt[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [creating, setCreating]   = useState(false);

  // creation fields
  const [guidedTipo, setGuidedTipo]       = useState("");
  const [guidedSubject, setGuidedSubject] = useState("");
  const [generating, setGenerating]       = useState(false);
  const [generated, setGenerated]         = useState(false);
  const [newTitle, setNewTitle]           = useState("");
  const [newPrompt, setNewPrompt]         = useState("");
  const [saving, setSaving]               = useState(false);

  // modal: view / edit
  const [viewPrompt, setViewPrompt]   = useState<SavedPrompt | null>(null);
  const [editMode, setEditMode]       = useState(false);
  const [editTitle, setEditTitle]     = useState("");
  const [editPrompt, setEditPrompt]   = useState("");
  const [savingEdit, setSavingEdit]   = useState(false);
  const [modalCopied, setModalCopied] = useState(false);

  // card-level copy feedback
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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
    const label = resolveLabel(p.module).toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.prompt.toLowerCase().includes(q) ||
      label.includes(q)
    );
  });

  const resetCreateForm = () => {
    setCreating(false);
    setGuidedTipo("");
    setGuidedSubject("");
    setNewTitle("");
    setNewPrompt("");
    setGenerated(false);
  };

  // ── Copy helpers ────────────────────────────────────────────────────
  const copyPromptOnly = (p: SavedPrompt) => {
    const text = `${p.title}\n\n${p.prompt}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ description: "Copiado para a área de transferência" });
    });
  };

  // ── Delete with confirmation ─────────────────────────────────────────
  const requestDelete = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (confirmDeleteId === null) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    if (viewPrompt?.id === id) setViewPrompt(null);
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    toast({ description: "Prompt movido para a Lixeira" });
  };

  const cancelDelete = () => setConfirmDeleteId(null);

  // ── Modal ───────────────────────────────────────────────────────────
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

  const startEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const modalCopyOnly = () => {
    if (!viewPrompt) return;
    const text = `${viewPrompt.title}\n\n${viewPrompt.prompt}`;
    navigator.clipboard.writeText(text).then(() => {
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2000);
      toast({ description: "Copiado para a área de transferência" });
    });
  };

  // ── Generate + Save ─────────────────────────────────────────────────
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
        body: JSON.stringify({ title: newTitle.trim(), prompt: newPrompt.trim(), module: guidedTipo }),
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
  const canSave     = newTitle.trim().length > 0 && newPrompt.trim().length > 0;

  return (
    <div className="space-y-6 pb-4">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-4"
      >
        <div className="space-y-1">
          <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Biblioteca</p>
          <h2 className="text-2xl font-black tracking-tight text-white">Prompts Salvos</h2>
          <p className="text-sm text-zinc-500">Sua biblioteca pessoal de prompts prontos para uso.</p>
        </div>
        <div className="shrink-0">
          <Button
            onClick={() => setCreating(true)}
            size="sm"
            className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Prompt
          </Button>
        </div>
      </motion.div>

      {/* ── Create Form ─────────────────────────────────────────────── */}
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

              {/* Tipo de Prompt */}
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

              {/* Assunto */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                  Assunto
                </label>
                <Input
                  value={guidedSubject}
                  onChange={(e) => setGuidedSubject(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canGenerate && !generating) void generatePrompt(); }}
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

              {/* Generated result */}
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
                        size="sm" variant="outline"
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
                        {saving ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search bar + Atualizar ───────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar prompts..."
            className="pl-9 h-8 text-xs bg-[#0f0f0f] border-white/[0.07] placeholder:text-zinc-700"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <Button
          size="sm" variant="outline"
          onClick={() => void fetchPrompts()}
          disabled={loading}
          className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 h-8 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        {!loading && (
          <span className="text-[10px] text-zinc-700 shrink-0">
            {filtered.length} prompt{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Prompts Grid ─────────────────────────────────────────────── */}
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
              : "Gere e salve prompts para construir sua biblioteca pessoal"}
          </p>
          {!search && (
            <Button onClick={() => setCreating(true)} size="sm" variant="outline"
              className="mt-4 text-xs border-white/[0.10] text-zinc-400 hover:text-white h-8"
            >
              <Plus className="w-3 h-3 mr-1.5" /> Criar primeiro prompt
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
            const label = resolveLabel(p.module);
            const color = resolveColor(p.module);
            return (
              <motion.div
                key={p.id}
                variants={fadeUp}
                onClick={() => openView(p)}
                className="group relative bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.12] hover:bg-[#111111] transition-all duration-200 cursor-pointer"
              >
                {/* Title — up to 2 lines */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-bold text-zinc-200 line-clamp-2 leading-snug flex-1">{p.title}</p>
                  <Badge variant="outline" className={`text-[9px] shrink-0 mt-0.5 ${color}`}>
                    {label}
                  </Badge>
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2 mb-3">{p.prompt}</p>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-700">
                    {new Date(p.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <div
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => copyPromptOnly(p)}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                    >
                      {copiedId === p.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === p.id ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      onClick={(e) => { openView(p); startEdit(e); }}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.05]"
                    >
                      <Pencil className="w-3 h-3" />
                      Editar
                    </button>
                    <button
                      onClick={(e) => requestDelete(p.id, e)}
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

      {/* ── Delete Confirmation Modal ────────────────────────────────── */}
      <AnimatePresence>
        {confirmDeleteId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={cancelDelete}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Tem certeza que deseja excluir este item?</p>
                <p className="text-xs text-zinc-600">Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex items-center gap-2 justify-center pt-1">
                <Button
                  size="sm" variant="outline"
                  onClick={cancelDelete}
                  className="border-white/10 text-zinc-400 hover:text-white text-xs h-8 px-4"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => void confirmDelete()}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs h-8 px-4"
                >
                  Excluir
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── View / Edit Modal ────────────────────────────────────────── */}
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
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {editMode && (
                    <button
                      onClick={() => setEditMode(false)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 mt-0.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    {editMode ? (
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-[#111111] border-white/[0.08] text-zinc-200 h-8 text-sm font-bold"
                        autoFocus
                      />
                    ) : (
                      <>
                        {/* Full title — no truncation in modal */}
                        <p className="text-sm font-bold text-white leading-snug">{viewPrompt.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${resolveColor(viewPrompt.module)}`}
                          >
                            {resolveLabel(viewPrompt.module)}
                          </Badge>
                          <span className="text-[10px] text-zinc-700">
                            {new Date(viewPrompt.createdAt).toLocaleDateString("pt-BR", {
                              day: "numeric", month: "long", year: "numeric",
                            })}
                          </span>
                        </div>
                      </>
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
                      size="sm" variant="outline"
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
                      onClick={modalCopyOnly}
                      className="flex flex-1 items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/10 border border-white/[0.07] hover:border-primary/30"
                    >
                      {modalCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {modalCopied ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      onClick={startEdit}
                      className="flex flex-1 items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.05] border border-white/[0.07]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => requestDelete(viewPrompt.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 text-xs text-zinc-600 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-400/10 border border-white/[0.07] hover:border-red-400/20"
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
