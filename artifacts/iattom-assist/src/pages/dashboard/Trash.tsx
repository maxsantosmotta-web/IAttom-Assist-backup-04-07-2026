import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trash2, RotateCcw, RefreshCw, Loader2,
  Megaphone, FileText, Sparkles, Video, Search, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  readTrash, restoreFromTrash, deleteFromTrash, purgeExpired,
  timeUntilExpiry, type TrashedItem,
} from "@/lib/trashStorage";
import { deleteProjectAssets } from "@/lib/assetStorage";

// ── API integration types ────────────────────────────────────────
interface TrashItemData {
  id: number;
  originalId: number;
  platform: string;
  itemType: string;
  name?: string | null;
  previousStatus?: string | null;
  deletedAt?: string | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Unified item ─────────────────────────────────────────────────
type UnifiedKind = "project" | "integration";
type FilterCategory = "all" | "campaign" | "content" | "creative" | "video_script" | "integration";

interface UnifiedItem {
  uid: string;
  kind: UnifiedKind;
  displayName: string;
  category: FilterCategory;
  deletedAt: string;
  expiresAt?: string;          // project only — 48h TTL
  badge: string;               // CSS classes
  icon: React.ElementType;
  label: string;               // category label
  subLabel?: string;           // platform or extra info
  rawProject?: TrashedItem;
  rawIntegration?: TrashItemData;
}

// ── Config maps ──────────────────────────────────────────────────
const PROJECT_CFG: Record<string, { label: string; icon: React.ElementType; badge: string; category: FilterCategory }> = {
  campaign:          { label: "Campanha",  icon: Megaphone, badge: "bg-amber-400/10 text-amber-400 border-amber-400/20",  category: "campaign"     },
  content:           { label: "Conteúdo",  icon: FileText,  badge: "bg-blue-400/10 text-blue-400 border-blue-400/20",    category: "content"      },
  creative:          { label: "Criativo",  icon: Sparkles,  badge: "bg-purple-400/10 text-purple-400 border-purple-400/20", category: "creative"  },
  video_script:      { label: "Script",    icon: Video,     badge: "bg-rose-400/10 text-rose-400 border-rose-400/20",    category: "video_script" },
  product_discovery: { label: "Produto",   icon: Search,    badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", category: "campaign" },
  product_validation:{ label: "Validação", icon: Search,    badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", category: "campaign" },
};

const PLATFORM_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre", hotmart: "Hotmart", shopee: "Shopee",
  kiwify: "Kiwify", meta: "Meta", whatsapp: "WhatsApp",
};

const TYPE_LABELS: Record<string, string> = {
  listing: "Anúncio", product: "Produto", offer: "Oferta",
  campaign: "Campanha", event: "Evento",
};

const FILTER_LABELS: { key: FilterCategory; label: string }[] = [
  { key: "all",          label: "Todos"       },
  { key: "campaign",     label: "Campanhas"   },
  { key: "content",      label: "Conteúdos"   },
  { key: "creative",     label: "Criativos"   },
  { key: "video_script", label: "Scripts"     },
  { key: "integration",  label: "Integrações" },
];

function toUnified(p: TrashedItem): UnifiedItem {
  const cfg = PROJECT_CFG[p.type] ?? PROJECT_CFG.campaign;
  return {
    uid: `proj_${p.id}`,
    kind: "project",
    displayName: p.title,
    category: cfg.category,
    deletedAt: p.deletedAt,
    expiresAt: p.expiresAt,
    badge: cfg.badge,
    icon: cfg.icon,
    label: cfg.label,
    rawProject: p,
  };
}

function toUnifiedInt(i: TrashItemData): UnifiedItem {
  return {
    uid: `int_${i.id}`,
    kind: "integration",
    displayName: i.name ?? "—",
    category: "integration",
    deletedAt: i.deletedAt ?? new Date().toISOString(),
    badge: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
    icon: Trash2,
    label: TYPE_LABELS[i.itemType] ?? i.itemType,
    subLabel: PLATFORM_LABELS[i.platform] ?? i.platform,
    rawIntegration: i,
  };
}

const fmt = (d: string) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

// ── Component ────────────────────────────────────────────────────
export function Trash() {
  const { toast } = useToast();

  const [integrationItems, setIntegrationItems] = useState<TrashItemData[]>([]);
  const [projectItems, setProjectItems]         = useState<TrashedItem[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [filter, setFilter]                     = useState<FilterCategory>("all");

  // Confirm-delete state — uid identifies which item
  const [confirmUid, setConfirmUid]             = useState<string | null>(null);
  const [actionUid, setActionUid]               = useState<string | null>(null);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<TrashItemData[]>("/api/me/trash");
      setIntegrationItems(data);
    } catch { setIntegrationItems([]); }
    finally { setLoading(false); }
  };

  const loadProjects = () => {
    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});
    setProjectItems(readTrash());
  };

  useEffect(() => {
    void loadIntegrations();
    loadProjects();
  }, []);

  // ── Unified list ────────────────────────────────────────────────
  const all: UnifiedItem[] = [
    ...projectItems.map(toUnified),
    ...integrationItems.map(toUnifiedInt),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const filtered = filter === "all" ? all : all.filter(i => i.category === filter);

  // Counts per filter
  const counts: Record<FilterCategory, number> = {
    all: all.length,
    campaign:     all.filter(i => i.category === "campaign").length,
    content:      all.filter(i => i.category === "content").length,
    creative:     all.filter(i => i.category === "creative").length,
    video_script: all.filter(i => i.category === "video_script").length,
    integration:  all.filter(i => i.category === "integration").length,
  };

  // ── Actions ─────────────────────────────────────────────────────
  const handleRestore = async (item: UnifiedItem) => {
    setActionUid(item.uid);
    try {
      if (item.kind === "project" && item.rawProject) {
        await new Promise<void>(r => setTimeout(r, 200));
        restoreFromTrash(item.rawProject.id);
        loadProjects();
        toast({ description: `"${item.displayName}" restaurado para Projetos Salvos.` });
      } else if (item.kind === "integration" && item.rawIntegration) {
        const result = await apiFetch<{ ok: boolean; platformLabel?: string }>(
          `/api/me/trash/${item.rawIntegration.id}/restore`, { method: "POST" },
        );
        setIntegrationItems(prev => prev.filter(i => i.id !== item.rawIntegration!.id));
        toast({
          title: "Item restaurado.",
          description: `"${item.displayName}" voltou para ${result.platformLabel ?? item.subLabel ?? "origem"}.`,
        });
      }
    } catch (e) {
      toast({ title: "Erro ao restaurar.", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    } finally { setActionUid(null); }
  };

  const handlePermDelete = async (item: UnifiedItem) => {
    setActionUid(item.uid);
    try {
      if (item.kind === "project" && item.rawProject) {
        await new Promise<void>(r => setTimeout(r, 200));
        deleteFromTrash(item.rawProject.id);
        void deleteProjectAssets(item.rawProject.id).catch(() => {});
        loadProjects();
        toast({ description: `"${item.displayName}" excluído definitivamente.` });
      } else if (item.kind === "integration" && item.rawIntegration) {
        await apiFetch(`/api/me/trash/${item.rawIntegration.id}`, { method: "DELETE" });
        setIntegrationItems(prev => prev.filter(i => i.id !== item.rawIntegration!.id));
        toast({ description: `"${item.displayName}" excluído definitivamente.` });
      }
    } catch (e) {
      toast({ title: "Erro ao excluir.", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setActionUid(null);
      setConfirmUid(null);
    }
  };

  const confirmItem = confirmUid ? all.find(i => i.uid === confirmUid) : null;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-1">
          <Trash2 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Lixeira</h1>
          <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">
            {all.length} {all.length === 1 ? "item" : "itens"}
          </Badge>
        </div>
        <p className="text-sm text-zinc-500 ml-8">
          Itens excluídos. Restaure para devolver ao local de origem.
        </p>
      </motion.div>

      {/* Card */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            {/* Filtros horizontais */}
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTER_LABELS.filter(f => f.key === "all" || counts[f.key] > 0).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filter === key
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-white/3 text-zinc-500 border border-white/8 hover:text-zinc-300"
                  }`}
                >
                  {label}{counts[key] > 0 ? ` (${counts[key]})` : ""}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { void loadIntegrations(); loadProjects(); }}
              disabled={loading}
              className="h-7 px-2.5 text-zinc-500 hover:text-white gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              <Trash2 className="w-10 h-10 mx-auto mb-3 text-zinc-800" />
              <p className="text-sm text-zinc-600">Lixeira vazia.</p>
              <p className="text-xs text-zinc-700 mt-1">
                Itens excluídos aparecerão aqui antes da remoção definitiva.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => {
                const Icon = item.icon;
                const isActing = actionUid === item.uid;
                return (
                  <div
                    key={item.uid}
                    className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5"
                  >
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 opacity-70 ${item.badge}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-300 truncate">{item.displayName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge className={`text-[10px] ${item.badge}`}>{item.label}</Badge>
                        {item.subLabel && (
                          <Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-600/30 text-[10px]">
                            {item.subLabel}
                          </Badge>
                        )}
                        {item.expiresAt ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-500/70" />
                            <span className="text-[10px] text-amber-500/70">{timeUntilExpiry(item.expiresAt)}</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-700">{fmt(item.deletedAt)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => void handleRestore(item)}
                        disabled={isActing}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {isActing
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RotateCcw className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">Restaurar</span>
                      </button>
                      <button
                        onClick={() => setConfirmUid(item.uid)}
                        disabled={isActing}
                        className="flex items-center gap-1.5 text-xs text-zinc-700 hover:text-red-400 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info footer */}
      <div className="bg-primary/5 border border-primary/15 rounded-lg p-4 space-y-1.5">
        <p className="text-xs font-medium text-primary">Sobre a Lixeira</p>
        <p className="text-[11px] text-zinc-500">
          Projetos IA são excluídos definitivamente após 48h. Itens de integração ficam ocultos nas listas principais mesmo após sincronização.
          Restaurar devolve o item ao módulo de origem.
        </p>
      </div>

      {/* ── Confirm perm delete dialog ───────────────────────────── */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">Excluir definitivamente</h3>
            <p className="text-sm text-zinc-400 mb-1">Esta ação não pode ser desfeita.</p>
            <p className="text-sm font-medium text-zinc-300 truncate mb-5">{confirmItem.displayName}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmUid(null)}
                disabled={actionUid === confirmItem.uid}
                className="px-4 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handlePermDelete(confirmItem)}
                disabled={actionUid === confirmItem.uid}
                className="px-4 py-2 text-sm rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 hover:text-red-300 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {actionUid === confirmItem.uid && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
