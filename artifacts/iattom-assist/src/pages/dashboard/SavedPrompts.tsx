import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookMarked, Copy, Trash2, Plus, Search, Check, X,
  Sparkles, FileText, Megaphone, CheckCircle, Video,
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
  { value: "all", label: "All Modules" },
  { value: "product_discovery", label: "Find Products" },
  { value: "product_validation", label: "Validate Products" },
  { value: "campaign", label: "Create Campaign" },
  { value: "content", label: "Create Content" },
  { value: "creative", label: "Creative Generator" },
  { value: "video_script", label: "Video Scripts" },
];

const MODULE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  product_discovery: { label: "Find Products", color: "text-primary bg-primary/10 border-primary/20", icon: Search },
  product_validation: { label: "Validate", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle },
  campaign: { label: "Campaign", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: Megaphone },
  content: { label: "Content", color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: FileText },
  creative: { label: "Creative", color: "text-purple-400 bg-purple-400/10 border-purple-400/20", icon: Sparkles },
  video_script: { label: "Video Script", color: "text-rose-400 bg-rose-400/10 border-rose-400/20", icon: Video },
};

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

export function SavedPrompts() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newModule, setNewModule] = useState("product_discovery");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prompts");
      if (res.ok) setPrompts(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrompts(); }, []);

  const filtered = prompts.filter((p) => {
    const matchModule = filter === "all" || p.module === filter;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.prompt.toLowerCase().includes(search.toLowerCase());
    return matchModule && matchSearch;
  });

  const copyPrompt = (p: SavedPrompt) => {
    navigator.clipboard.writeText(p.prompt).then(() => {
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ description: "Copied to clipboard" });
    });
  };

  const deletePrompt = async (id: number) => {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    toast({ description: "Prompt deleted" });
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
        const created = await res.json();
        setPrompts((prev) => [created, ...prev]);
        setCreating(false);
        setNewTitle("");
        setNewPrompt("");
        toast({ description: "Prompt saved" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-4"
      >
        <div className="space-y-1">
          <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Library</p>
          <h2 className="text-2xl font-black tracking-tight text-white">Saved Prompts</h2>
          <p className="text-sm text-zinc-500">Your personal prompt library across all AI modules</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          size="sm"
          className="bg-primary text-black hover:bg-primary/90 font-bold text-xs shrink-0 h-8"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Prompt
        </Button>
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
            <div className="bg-[#0f0f0f] border border-primary/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-white">New Prompt</p>
                <button onClick={() => setCreating(false)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Prompt title..."
                className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-9"
              />
              <Textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Paste your prompt here..."
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
                  onClick={savePrompt}
                  disabled={!newTitle.trim() || !newPrompt.trim() || saving}
                  size="sm"
                  className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-9 px-4"
                >
                  {saving ? "Saving..." : "Save Prompt"}
                </Button>
              </div>
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
            placeholder="Search prompts..."
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
          <p className="text-sm font-semibold text-zinc-500">No prompts saved yet</p>
          <p className="text-xs text-zinc-700 mt-1 max-w-[220px] leading-relaxed">
            Save prompts you use regularly to build your personal library
          </p>
          <Button onClick={() => setCreating(true)} size="sm" variant="outline"
            className="mt-4 text-xs border-white/[0.10] text-zinc-400 hover:text-white h-8"
          >
            <Plus className="w-3 h-3 mr-1.5" /> Save your first prompt
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
                    {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button
                      onClick={() => copyPrompt(p)}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                    >
                      {copiedId === p.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === p.id ? "Copied" : "Copy"}
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
