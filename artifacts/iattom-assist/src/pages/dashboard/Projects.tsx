import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen, Plus, Trash2, Loader2, Search,
  Megaphone, FileText, Sparkles, Video, RefreshCw,
  BookOpen, Calendar, Globe, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { purgeExpired, type SavedItemBase } from "@/lib/trashStorage";
import { deleteProjectAssets } from "@/lib/assetStorage";
import { useSavedItems } from "@/hooks/useSavedItems";

interface SavedItem extends SavedItemBase {
  type: "campaign" | "content" | "creative" | "video_script" | "product_discovery" | "product_validation";
}

type TabKey = "all" | "campaign" | "content" | "creative" | "video_script" | "product_discovery";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "all",               label: "Todos",           icon: BookOpen   },
  { key: "campaign",          label: "Campanhas",       icon: Megaphone  },
  { key: "content",           label: "Conteúdos",       icon: FileText   },
  { key: "creative",          label: "Criativos",       icon: Sparkles   },
  { key: "video_script",      label: "Scripts de Vídeo", icon: Video      },
  { key: "product_discovery", label: "Produtos",        icon: Search     },
];

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; badge: string; cardIcon: string }> = {
  campaign:           { label: "Campanha",        icon: Megaphone, badge: "text-primary bg-primary/10 border-primary/20",           cardIcon: "text-primary" },
  content:            { label: "Conteúdo",         icon: FileText,  badge: "text-blue-400 bg-blue-500/10 border-blue-500/20",         cardIcon: "text-blue-400" },
  creative:           { label: "Criativo",         icon: Sparkles,  badge: "text-violet-400 bg-violet-500/10 border-violet-500/20",   cardIcon: "text-violet-400" },
  video_script:       { label: "Script de Vídeo",  icon: Video,     badge: "text-pink-400 bg-pink-500/10 border-pink-500/20",         cardIcon: "text-pink-400" },
  product_discovery:  { label: "Produtos",         icon: Search,    badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", cardIcon: "text-emerald-400" },
  product_validation: { label: "Validação",        icon: Search,    badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", cardIcon: "text-emerald-400" },
};

const platformLabels: Record<string, string> = {
  hotmart: "Hotmart", kiwify: "Kiwify", shopee: "Shopee",
  mercado_livre: "Mercado Livre", tiktok: "TikTok",
  instagram: "Instagram", facebook: "Facebook",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function readStorage(): SavedItem[] {
  try {
    const raw = localStorage.getItem("iattom_saved_items_v1");
    return raw ? (JSON.parse(raw) as SavedItem[]) : [];
  } catch { return []; }
}

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, scale: 0.97 }, show: { opacity: 1, scale: 1, transition: { duration: 0.2 } } };

export function Projects() {
  const { getItems, trashItem, saveItem } = useSavedItems();
  const [savedItems, setSavedItems] = useState<SavedItem[]>(readStorage);
  const [tab, setTab]               = useState<TabKey>("all");
  const [search, setSearch]         = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  async function syncFromDB(showSpinner = false) {
    if (showSpinner) setIsRefreshing(true);
    try {
      const apiItems = await getItems();
      setSavedItems(apiItems as SavedItem[]);

      if (apiItems.length > 0) {
        // Banco tem dados → banco é a fonte da verdade, sincroniza localStorage
        try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify(apiItems)); } catch { /* noop */ }
      } else {
        // Banco retornou vazio — lê localStorage ANTES de modificá-lo
        const local = readStorage();
        // Limpa localStorage imediatamente: banco é fonte da verdade, evita re-inserção futura de itens deletados
        try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify([])); } catch { /* noop */ }

        if (local.length > 0) {
          // Migração one-time: sobe itens locais ao banco
          // ON CONFLICT DO UPDATE não toca deletedAt → itens já excluídos no banco não ressurgem
          try {
            await Promise.all(
              local.map(item =>
                saveItem({ id: item.id, title: item.title, type: item.type, platform: item.platform, content: item.content, data: item.data, hasImages: item.hasImages })
              )
            );
            const migrated = await getItems();
            setSavedItems(migrated as SavedItem[]);
            try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify(migrated)); } catch { /* noop */ }
          } catch { /* migração falhou — mantém visão local */ }
        }
      }
    } catch { /* API offline — mantém dados do localStorage */ }
    finally { if (showSpinner) setIsRefreshing(false); }
  }

  useEffect(() => {
    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});
    void syncFromDB();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncFromDB();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = savedItems.filter((item) => {
    const matchTab    = tab === "all" || item.type === tab;
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const counts = TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.key] = t.key === "all" ? savedItems.length : savedItems.filter((i) => i.type === t.key).length;
    return acc;
  }, {});

  const handleOpenItem = (item: SavedItem) => navigate(`/dashboard/projects/${item.id}`);

  const handleConfirmTrash = async (id: string) => {
    const item = savedItems.find(i => i.id === id);
    if (!item) return;
    setDeletingId(id);
    try {
      await trashItem(id);
      const updated = savedItems.filter(i => i.id !== id);
      setSavedItems(updated);
      try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify(updated)); } catch { /* noop */ }
      setConfirmDeleteId(null);
      toast({ description: "Projeto enviado para a lixeira. Acesse a Lixeira para restaurar." });
    } catch {
      toast({ title: "Erro ao mover para lixeira.", description: "Não foi possível excluir o projeto. Tente novamente.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const confirmItem = confirmDeleteId ? savedItems.find(i => i.id === confirmDeleteId) : null;

  return (
    <div className="space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Espaço de Trabalho</p>
            <h2 className="text-2xl font-bold text-white mb-1">Biblioteca</h2>
            <p className="text-muted-foreground text-sm">
              Campanhas, conteúdos, criativos e scripts gerados e salvos.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void syncFromDB(true)}
            disabled={isRefreshing}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </motion.div>

      {/* Tabs com contadores */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-wrap gap-2"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          const count = counts[t.key] ?? 0;
          if (t.key !== "all" && count === 0) return null;
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
                {count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Busca */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar projetos salvos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50"
        />
      </motion.div>

      {/* Grid de cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
        className={`transition-opacity duration-150 ${isRefreshing ? "opacity-50 pointer-events-none" : ""}`}
      >
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.07] flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-white/[0.15]" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary/[0.12] border border-primary/25 flex items-center justify-center">
                <Plus className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-base font-semibold text-zinc-300 mb-1.5">
              {search || tab !== "all" ? "Nenhum item encontrado" : "Sem projetos salvos ainda"}
            </p>
            <p className="text-sm text-zinc-600 max-w-[260px] leading-relaxed">
              {search || tab !== "all"
                ? "Tente outro filtro ou termo de busca."
                : "Gere e salve campanhas, criativos, conteúdos e scripts."}
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredItems.map((item) => {
              const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.campaign;
              const Icon = cfg.icon;
              const preview = item.content?.slice(0, 120).trim() ?? "";
              return (
                <motion.div key={item.id} variants={itemVariants}>
                  <Card className="bg-[#111111] border-white/5 hover:border-white/10 transition-colors group h-full flex flex-col">
                    <CardContent className="p-4 flex flex-col gap-3 flex-1">

                      {/* Topo: ícone + título + botão lixeira */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${cfg.badge}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                        </div>
                        <button
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="text-zinc-700 hover:text-red-400 transition-colors p-1 opacity-100 shrink-0"
                          title="Mover para lixeira"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.badge}`}>
                          {cfg.label}
                        </Badge>
                        {item.platform && platformLabels[item.platform] && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 bg-white/[0.03] border-white/10">
                            <Globe className="w-2.5 h-2.5 mr-1" />
                            {platformLabels[item.platform]}
                          </Badge>
                        )}
                        {item.hasImages && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-violet-400 bg-violet-500/8 border-violet-500/15">
                            imagens
                          </Badge>
                        )}
                      </div>

                      {/* Preview do conteúdo */}
                      {preview && (
                        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3 flex-1">
                          {preview}{(item.content?.length ?? 0) > 120 ? "…" : ""}
                        </p>
                      )}

                      {/* Rodapé: data + botão Abrir */}
                      <div className="flex items-center justify-between mt-auto pt-1">
                        <div className="flex items-center gap-1 text-[10px] text-zinc-700">
                          <Calendar className="w-3 h-3" />
                          {fmtDate(item.createdAt)}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleOpenItem(item)}
                          className="h-6 px-2.5 text-[10px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30 gap-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Abrir
                        </Button>
                      </div>

                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>

      {/* Dialog: confirmar lixeira */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <DialogContent className="bg-[#0f0f0f] border-white/[0.10] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Enviar para lixeira?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400 leading-relaxed">
            O projeto <span className="text-zinc-200 font-medium">"{confirmItem?.title}"</span> será movido para a lixeira e excluído definitivamente após 48 horas.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-zinc-400 hover:text-white"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => confirmDeleteId && void handleConfirmTrash(confirmDeleteId)}
              disabled={!!deletingId}
              className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
            >
              {deletingId ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Enviar para lixeira
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
