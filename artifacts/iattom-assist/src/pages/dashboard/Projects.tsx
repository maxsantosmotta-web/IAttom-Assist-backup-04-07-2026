import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen, Plus, Trash2, Loader2, Search,
  Megaphone, FileText, Sparkles, Video, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface SavedItem {
  id: string;
  title: string;
  type: "campaign" | "content" | "creative" | "video_script" | "product_discovery";
  platform?: string;
  content: string;
  data?: string;
  createdAt: string;
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string; badge: string }> = {
  campaign:         { label: "Campanhas",  icon: Megaphone, color: "text-amber-400",   badge: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  content:          { label: "Conteúdos",  icon: FileText,  color: "text-blue-400",    badge: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
  creative:         { label: "Criativos",  icon: Sparkles,  color: "text-purple-400",  badge: "bg-purple-400/10 text-purple-400 border-purple-400/20" },
  video_script:     { label: "Scripts",    icon: Video,     color: "text-rose-400",    badge: "bg-rose-400/10 text-rose-400 border-rose-400/20" },
  product_discovery:{ label: "Produtos",   icon: Search,    color: "text-emerald-400", badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
};

const typeLabels: Record<string, string> = {
  campaign: "Campanhas", content: "Conteúdos", creative: "Criativos", video_script: "Scripts", product_discovery: "Produtos",
};

const platformLabels: Record<string, string> = {
  hotmart: "Hotmart", kiwify: "Kiwify", shopee: "Shopee",
  mercado_livre: "Mercado Livre", tiktok: "TikTok",
  whatsapp: "WhatsApp", instagram: "Instagram", meta: "Meta",
};

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "agora mesmo";
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

function readStorage(): SavedItem[] {
  try {
    const raw = localStorage.getItem("iattom_saved_items_v1");
    return raw ? (JSON.parse(raw) as SavedItem[]) : [];
  } catch { return []; }
}

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function Projects() {
  const [savedItems, setSavedItems] = useState<SavedItem[]>(readStorage);
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewingItem, setViewingItem] = useState<SavedItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    setSavedItems(readStorage());
  }, []);

  const filteredItems = savedItems.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleOpenItem = (item: SavedItem) => {
    if (item.type === "campaign") {
      if (item.data) sessionStorage.setItem("iattom_reopen_campaign_v1", item.data);
      navigate("/dashboard/create-campaign");
      return;
    }
    if (item.data) {
      const keyMap: Record<string, string> = {
        content:          "iattom_restore_content_v1",
        video_script:     "iattom_restore_video_v1",
        product_discovery:"iattom_restore_products_v1",
        creative:         "iattom_restore_creative_v1",
      };
      const routeMap: Record<string, string> = {
        content:          "/dashboard/create-content",
        video_script:     "/dashboard/video-scripts",
        product_discovery:"/dashboard/find-products",
        creative:         "/dashboard/creative-generator",
      };
      const key = keyMap[item.type];
      const route = routeMap[item.type];
      if (key && route) {
        sessionStorage.setItem(key, item.data);
        navigate(route);
        return;
      }
    }
    setViewingItem(item);
  };

  const handleDeleteItem = (id: string) => {
    setDeletingId(id);
    setTimeout(() => {
      const updated = savedItems.filter((i) => i.id !== id);
      setSavedItems(updated);
      try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify(updated)); } catch {}
      toast({ description: "Item removido dos projetos salvos." });
      setDeletingId(null);
    }, 200);
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Espaço de Trabalho</p>
        <h2 className="text-2xl font-bold text-white mb-1">Projetos Salvos</h2>
        <p className="text-muted-foreground text-sm">Campanhas, conteúdos, criativos e scripts gerados e salvos.</p>
      </motion.div>

      {/* Filtros */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar projetos salvos..."
            className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 bg-[#111111] border border-white/[0.06] rounded-lg shrink-0">
          {[{ val: "all", label: "Todos" }, ...Object.entries(typeLabels).map(([val, label]) => ({ val, label }))].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setTypeFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                typeFilter === val
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Lista */}
      {filteredItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.07] flex items-center justify-center shadow-depth">
              <FolderOpen className="w-8 h-8 text-white/[0.15]" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary/[0.12] border border-primary/25 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-base font-semibold text-zinc-300 mb-1.5">
            {search || typeFilter !== "all" ? "Nenhum item encontrado" : "Sem projetos salvos ainda"}
          </p>
          <p className="text-sm text-zinc-600 max-w-[260px] leading-relaxed">
            {search || typeFilter !== "all"
              ? "Tente outro filtro ou termo de busca."
              : "Use os módulos de IA para gerar e salvar campanhas, criativos, conteúdos e scripts."}
          </p>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-2">
          {filteredItems.map((item) => {
            const cfg = typeConfig[item.type] ?? typeConfig.campaign;
            const Icon = cfg.icon;
            return (
              <motion.div key={item.id} variants={itemVariants}>
                <Card className="bg-[#0f0f0f] border-white/[0.055] hover:border-white/[0.10] hover:bg-[#111111] transition-all duration-200 group overflow-hidden shadow-depth-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${cfg.badge}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate max-w-[300px]">{item.title}</p>
                          <Badge variant="outline" className={`text-[10px] shrink-0 px-1.5 py-0 ${cfg.badge}`}>
                            {cfg.label}
                          </Badge>
                          {item.platform && platformLabels[item.platform] && (
                            <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0 bg-white/[0.04] text-zinc-500 border-white/[0.08]">
                              {platformLabels[item.platform]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-600">{timeAgo(item.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleOpenItem(item)}
                          className="h-7 px-3 text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30"
                        >
                          Abrir
                        </Button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingId === item.id}
                          className="w-7 h-7 flex items-center justify-center text-zinc-700 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/[0.08] opacity-0 group-hover:opacity-100"
                        >
                          {deletingId === item.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Visualizador de item (conteúdo / criativo / script) */}
      <Dialog open={!!viewingItem} onOpenChange={(open) => { if (!open) setViewingItem(null); }}>
        <DialogContent className="bg-[#0f0f0f] border-white/[0.10] text-white max-w-2xl shadow-depth-lg animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-white text-base">{viewingItem?.title}</DialogTitle>
          </DialogHeader>
          {!viewingItem?.data && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              <p className="text-xs text-zinc-500">Projeto antigo — dados completos indisponíveis. Exibindo texto salvo.</p>
            </div>
          )}
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">{viewingItem?.content}</pre>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-zinc-400 hover:text-white"
              onClick={() => {
                if (viewingItem?.content) {
                  void navigator.clipboard.writeText(viewingItem.content);
                  toast({ description: "Copiado para a área de transferência." });
                }
              }}
            >
              Copiar texto
            </Button>
            <Button
              size="sm"
              className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
              onClick={() => setViewingItem(null)}
            >
              <X className="w-3.5 h-3.5 mr-1.5" /> Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
