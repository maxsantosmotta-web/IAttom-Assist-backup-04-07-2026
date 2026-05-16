import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trash2,
  RotateCcw,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface TrashItemData {
  id: number;
  originalId: number;
  platform: string;
  itemType: string;
  name?: string | null;
  previousStatus?: string | null;
  snapshot?: string | null;
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

const PLATFORM_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  hotmart: "Hotmart",
  shopee: "Shopee",
  kiwify: "Kiwify",
  meta: "Meta",
  whatsapp: "WhatsApp",
};

const PLATFORM_COLORS: Record<string, string> = {
  mercado_livre: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  hotmart: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  shopee: "bg-orange-600/15 text-orange-500 border-orange-600/30",
  kiwify: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  meta: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  whatsapp: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  listing: "Anúncio",
  product: "Produto",
  offer: "Oferta",
  campaign: "Campanha",
  event: "Evento",
};

export function AdminTrash() {
  const { toast } = useToast();
  const [items, setItems] = useState<TrashItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmPermDelete, setConfirmPermDelete] = useState<TrashItemData | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<TrashItemData[]>("/api/admin/trash");
      setItems(data);
    } catch { setItems([]); } finally { setLoading(false); }
  };

  useEffect(() => { void loadItems(); }, []);

  const handleRestore = async (item: TrashItemData) => {
    setRestoringId(item.id);
    try {
      const result = await apiFetch<{ ok: boolean; platformLabel?: string }>(
        `/api/admin/trash/${item.id}/restore`, { method: "POST" },
      );
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast({
        title: "Item restaurado com sucesso.",
        description: `"${item.name ?? "—"}" voltou para ${result.platformLabel ?? PLATFORM_LABELS[item.platform] ?? item.platform}.`,
      });
    } catch (e) {
      toast({ title: "Não foi possível concluir a ação.", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    } finally { setRestoringId(null); }
  };

  const handlePermDelete = async (item: TrashItemData) => {
    setDeletingId(item.id);
    try {
      await apiFetch(`/api/admin/trash/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setConfirmPermDelete(null);
      toast({
        title: "Item excluído definitivamente.",
        description: `"${item.name ?? "—"}" removido permanentemente.`,
      });
    } catch (e) {
      toast({ title: "Não foi possível concluir a ação.", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  const platforms = [...new Set(items.map((i) => i.platform))];
  const filtered = filter === "all" ? items : items.filter((i) => i.platform === filter);

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-1">
          <Trash2 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Lixeira Global</h1>
          <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">
            {items.length} {items.length === 1 ? "item" : "itens"}
          </Badge>
        </div>
        <p className="text-sm text-zinc-500 ml-8">
          Itens removidos de integrações. Restaure para devolver ao módulo original, ou exclua definitivamente.
        </p>
      </motion.div>

      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-white/3 text-zinc-500 border border-white/8 hover:text-zinc-300"
                }`}
              >
                Todos{items.length > 0 ? ` (${items.length})` : ""}
              </button>
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filter === p
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-white/3 text-zinc-500 border border-white/8 hover:text-zinc-300"
                  }`}
                >
                  {PLATFORM_LABELS[p] ?? p}{` (${items.filter((i) => i.platform === p).length})`}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void loadItems()}
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
              <Loader2 className="w-4 h-4 animate-spin" />Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              <Trash2 className="w-10 h-10 mx-auto mb-3 text-zinc-800" />
              <p className="text-sm text-zinc-600">Lixeira vazia.</p>
              <p className="text-xs text-zinc-700 mt-1">
                Itens excluídos de integrações aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-300 truncate">{item.name || "—"}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge
                        className={`text-[10px] ${PLATFORM_COLORS[item.platform] ?? "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"}`}
                      >
                        {PLATFORM_LABELS[item.platform] ?? item.platform}
                      </Badge>
                      <Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-600/30 text-[10px]">
                        {TYPE_LABELS[item.itemType] ?? item.itemType}
                      </Badge>
                      {item.previousStatus && (
                        <span className="text-[10px] text-zinc-700">
                          Status anterior: {item.previousStatus}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-700">{fmt(item.deletedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => void handleRestore(item)}
                      disabled={restoringId === item.id}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {restoringId === item.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RotateCcw className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Restaurar</span>
                    </button>
                    <button
                      onClick={() => setConfirmPermDelete(item)}
                      className="flex items-center gap-1.5 text-xs text-zinc-700 hover:text-red-400 transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-primary/5 border border-primary/15 rounded-lg p-4 space-y-1.5">
        <p className="text-xs font-medium text-primary">Como funciona a Lixeira Global</p>
        <p className="text-[11px] text-zinc-500">
          Itens arquivados permanecem ocultos nas listas principais mesmo após sincronização com as plataformas.
          Restaurar devolve o item ao módulo de origem e reativa sua exibição.
        </p>
        <p className="text-[11px] text-zinc-600">
          Suporte futuro: Shopee, Kiwify, Meta, WhatsApp, campanhas e criativos serão integrados automaticamente.
        </p>
      </div>

      {/* ─── CONFIRM PERM DELETE DIALOG ───────────────────────────────── */}
      {confirmPermDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">Excluir definitivamente</h3>
            <p className="text-sm text-zinc-400 mb-1">Esta ação não pode ser desfeita.</p>
            <p className="text-sm font-medium text-zinc-300 truncate mb-5">
              {confirmPermDelete.name ?? "—"}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmPermDelete(null)}
                disabled={deletingId === confirmPermDelete.id}
                className="px-4 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handlePermDelete(confirmPermDelete)}
                disabled={deletingId === confirmPermDelete.id}
                className="px-4 py-2 text-sm rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 hover:text-red-300 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deletingId === confirmPermDelete.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
