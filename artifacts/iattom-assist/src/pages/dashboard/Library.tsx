import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Megaphone, FileText, Image, Video, BookOpen, BadgeCheck,
  Trash2, RefreshCw, Loader2, Search, Calendar, Globe,
} from "lucide-react";
import { useAuth } from "@clerk/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

type SavedItem = {
  id: string;
  title: string;
  type: string;
  platform: string | null;
  content: string;
  data: string | null;
  hasImages: boolean;
  createdAt: string;
};

type TabKey = "all" | "campaign" | "content" | "creative" | "video_script" | "product_validation";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all",                label: "Todos",           icon: BookOpen   },
  { key: "campaign",           label: "Campanhas",       icon: Megaphone  },
  { key: "content",            label: "Conteúdos",       icon: FileText   },
  { key: "creative",           label: "Imagens",         icon: Image      },
  { key: "video_script",       label: "Vídeos",          icon: Video      },
  { key: "product_validation", label: "Validar Produto", icon: BadgeCheck },
];

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  campaign:           { label: "Campanha",          color: "text-primary bg-primary/10 border-primary/20",          icon: Megaphone  },
  content:            { label: "Conteúdo",          color: "text-blue-400 bg-blue-500/10 border-blue-500/20",       icon: FileText   },
  creative:           { label: "Imagem",            color: "text-violet-400 bg-violet-500/10 border-violet-500/20", icon: Image      },
  video_script:       { label: "Vídeo",             color: "text-pink-400 bg-pink-500/10 border-pink-500/20",       icon: Video      },
  product_validation: { label: "Validar Produto",   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: BadgeCheck },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function Library() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [items, setItems]       = useState<SavedItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<TabKey>("all");
  const [search, setSearch]     = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/saved-items`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      setItems(await res.json() as SavedItem[]);
    } catch {
      toast({ title: "Erro ao carregar biblioteca", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/saved-items/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ description: "Item movido para a lixeira." });
    } catch {
      toast({ title: "Erro ao excluir item", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const filtered = items.filter((item) => {
    const matchTab    = tab === "all" || item.type === tab;
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const counts = TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.key] = t.key === "all" ? items.length : items.filter((i) => i.type === t.key).length;
    return acc;
  }, {});

  return (
    <div className="space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Biblioteca</p>
            <h2 className="text-2xl font-bold text-white mb-1">Minha Biblioteca</h2>
            <p className="text-muted-foreground text-sm">
              Suas campanhas, conteúdos, imagens, vídeos e validações de produto em um só lugar.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
            disabled={loading}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-wrap gap-2"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "text-zinc-500 border-white/8 hover:border-white/20 hover:text-zinc-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              <span className={`text-[10px] ${active ? "text-primary/70" : "text-zinc-700"}`}>
                {counts[t.key] ?? 0}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Pesquisar na biblioteca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50"
        />
      </motion.div>

      {/* Grid */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando biblioteca...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-[#111111] border-white/5">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/8 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500 text-center">
                {search ? "Nenhum item encontrado para esta pesquisa." : "Nenhum item salvo nesta categoria."}
              </p>
              <p className="text-[11px] text-zinc-700 text-center max-w-xs">
                Salve seus trabalhos nos módulos de campanhas, conteúdos, imagens, vídeos e validação de produto para encontrá-los aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const cfg = TYPE_CONFIG[item.type] ?? {
                label: item.type,
                color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
                icon: BookOpen,
              };
              const Icon = cfg.icon;
              const preview = item.content.slice(0, 120).trim();
              const isDeleting = deleting === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="bg-[#111111] border-white/5 hover:border-white/10 transition-colors group h-full flex flex-col">
                    <CardContent className="p-4 flex flex-col gap-3 flex-1">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                        </div>
                        <button
                          onClick={() => void handleDelete(item.id)}
                          disabled={isDeleting}
                          className="text-zinc-700 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100 shrink-0"
                          title="Mover para lixeira"
                        >
                          {isDeleting
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                        {item.platform && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 bg-white/[0.03] border-white/10">
                            <Globe className="w-2.5 h-2.5 mr-1" />
                            {item.platform}
                          </Badge>
                        )}
                        {item.hasImages && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-violet-400 bg-violet-500/8 border-violet-500/15">
                            imagens
                          </Badge>
                        )}
                      </div>

                      {/* Preview */}
                      {preview && (
                        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3 flex-1">
                          {preview}{item.content.length > 120 ? "…" : ""}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-1 text-[10px] text-zinc-700 mt-auto pt-1">
                        <Calendar className="w-3 h-3" />
                        {fmtDate(item.createdAt)}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

    </div>
  );
}
