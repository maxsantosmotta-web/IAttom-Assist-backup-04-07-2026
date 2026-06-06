import { motion } from "framer-motion";
import { Clock, Search, Megaphone, FileText, Sparkles, Video, CheckCircle, FolderOpen, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useListHistory, getListHistoryQueryKey } from "@workspace/api-client-react";
import { translateAction, translateDemoName } from "@/lib/eventTranslations";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const moduleIcons: Record<string, React.ElementType> = {
  campaign: Megaphone,
  content: FileText,
  creative: Sparkles,
  video_script: Video,
  product_discovery: Search,
  product_validation: CheckCircle,
  marketing: FolderOpen,
};

const moduleColors: Record<string, string> = {
  campaign: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  content: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  creative: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  video_script: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  product_discovery: "text-primary bg-primary/10 border-primary/20",
  product_validation: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  marketing: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

const moduleLabels: Record<string, string> = {
  campaign: "campanha",
  content: "conteúdo",
  creative: "criativo",
  video_script: "script de vídeo",
  product_discovery: "busca de produto",
  product_validation: "validação",
  marketing: "marketing",
};

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "agora mesmo";
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)}h`;
  return `há ${Math.floor(seconds / 86400)}d`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

async function historyFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
}

export function History() {
  const { data: history, isLoading, isFetching, refetch } = useListHistory(
    { limit: 50 },
    { query: { queryKey: getListHistoryQueryKey({ limit: 50 }), staleTime: 0 } },
  );
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmClearAll, setConfirmClearAll]   = useState(false);
  const [deletingId, setDeletingId]             = useState<number | null>(null);
  const [clearingAll, setClearingAll]           = useState(false);

  const filtered = (history ?? []).filter((h) =>
    h.action.toLowerCase().includes(search.toLowerCase()) ||
    h.module.toLowerCase().includes(search.toLowerCase()) ||
    (h.projectName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const hasItems = (history ?? []).length > 0;

  const handleDeleteItem = async (id: number) => {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await historyFetch(`/api/history/${id}`, { method: "DELETE" });
      await refetch();
      toast({ description: "Atividade movida para a Lixeira." });
    } catch {
      toast({ description: "Erro ao excluir atividade.", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    setConfirmClearAll(false);
    try {
      await historyFetch("/api/history/clear", { method: "POST" });
      await refetch();
      toast({ description: "Histórico movido para a Lixeira." });
    } catch {
      toast({ description: "Erro ao limpar histórico.", variant: "destructive" });
    } finally { setClearingAll(false); }
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Registro de Atividades</p>
            <h2 className="text-2xl font-bold text-white mb-1">Atividades</h2>
            <p className="text-muted-foreground text-sm">Histórico completo de todas as ações realizadas no seu espaço de trabalho.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <Button
              size="sm" variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            {hasItems && (
              <Button
                size="sm" variant="outline"
                onClick={() => setConfirmClearAll(true)}
                disabled={clearingAll || isFetching}
                className="border-white/10 text-zinc-600 hover:text-red-400 hover:border-red-400/30 gap-1.5"
              >
                {clearingAll
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
                Limpar Tudo
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-history-search"
            placeholder="Buscar atividades..."
            className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </motion.div>

      <div className={`transition-opacity duration-150 ${isFetching && !isLoading ? "opacity-50 pointer-events-none" : ""}`}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.07] flex items-center justify-center">
                <Clock className="w-8 h-8 text-white/[0.12]" />
              </div>
              <div className="absolute inset-[-6px] rounded-full border border-white/[0.04] animate-ping" style={{ animationDuration: "3s" }} />
            </div>
            <p className="text-base font-semibold text-zinc-300 mb-1.5">
              {search ? "Nenhuma atividade encontrada" : "Nenhuma atividade ainda"}
            </p>
            <p className="text-sm text-zinc-600 max-w-[220px] leading-relaxed">
              {search
                ? "Tente outro termo de busca."
                : "Suas ações aparecerão aqui conforme você usar a plataforma."}
            </p>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="relative">
            <div className="absolute left-[18px] top-5 bottom-5 w-px bg-gradient-to-b from-transparent via-white/[0.05] to-transparent pointer-events-none" />
            <div className="space-y-2">
              {filtered.map((item) => {
                const Icon = moduleIcons[item.module] ?? Clock;
                const colorClass = moduleColors[item.module] ?? "text-zinc-500 bg-white/[0.05] border-white/[0.08]";
                const isDeleting   = deletingId === item.id;
                const isConfirming = confirmDeleteId === item.id;
                return (
                  <motion.div key={item.id} variants={itemVariants}>
                    <div
                      data-testid={`history-item-${item.id}`}
                      className="flex items-center gap-4 p-4 rounded-xl bg-[#0f0f0f] border border-white/[0.055] hover:border-white/[0.09] hover:bg-[#111111] transition-all duration-200 group"
                    >
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-zinc-200 group-hover:text-white transition-colors">{translateAction(item.action)}</p>
                        {item.projectName && (
                          <p className="text-xs text-zinc-600 truncate mt-0.5">{translateDemoName(item.projectName)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-zinc-500">{timeAgo(item.createdAt)}</p>
                          <p className="text-[10px] text-zinc-700 capitalize mt-0.5">{moduleLabels[item.module] ?? item.module.replace(/_/g, " ")}</p>
                        </div>
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => void handleDeleteItem(item.id)}
                              className="text-[10px] text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded bg-red-400/10 border border-red-400/20 whitespace-nowrap"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1 rounded bg-white/[0.03] border border-white/[0.07]"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(item.id)}
                            disabled={isDeleting}
                            className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-all duration-150 p-1 rounded hover:bg-red-400/10 disabled:opacity-50"
                            title="Mover para lixeira"
                          >
                            {isDeleting
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Confirm Clear All */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">Limpar histórico</h3>
            <p className="text-sm text-zinc-400 mb-5">
              Todas as atividades serão movidas para a Lixeira e excluídas definitivamente após 48h.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmClearAll(false)}
                className="px-4 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleClearAll()}
                className="px-4 py-2 text-sm rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 hover:text-red-300 transition-colors"
              >
                Limpar Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
