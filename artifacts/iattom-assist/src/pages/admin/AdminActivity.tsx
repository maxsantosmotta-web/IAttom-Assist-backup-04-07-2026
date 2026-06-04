import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Search, Clock, User, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useListAdminActivity } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { translateAction, translateModule } from "@/lib/eventTranslations";

const moduleColors: Record<string, string> = {
  campaign: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  content: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  creative: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  video_script: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  product_discovery: "text-primary bg-primary/10 border-primary/20",
  product_validation: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  marketing: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

function timeAgo(date: string | Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "agora mesmo";
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)}h`;
  return new Date(date).toLocaleDateString("pt-BR");
}

export function AdminActivity() {
  const [search, setSearch] = useState("");
  const { data: activity, isLoading, refetch } = useListAdminActivity({ limit: 100 });

  const filtered = (activity ?? []).filter((item) => {
    const q = search.toLowerCase();
    return (
      item.action.toLowerCase().includes(q) ||
      item.module.toLowerCase().includes(q) ||
      (item.userEmail ?? "").toLowerCase().includes(q) ||
      (item.projectName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Monitoramento</p>
            <h2 className="text-2xl font-bold text-white mb-1">Atividade da Plataforma</h2>
            <p className="text-muted-foreground text-sm">Todas as ações dos usuários em todos os espaços de trabalho — feed em tempo real.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isLoading} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por ação, módulo, usuário ou projeto..."
              className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Activity className="w-4 h-4" />
            <span>{isLoading ? "..." : filtered.length} eventos</span>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="bg-[#111111] border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Ação</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Módulo</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Usuário</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Projeto</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Horário</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="px-5 py-3"><Skeleton className="h-4 w-40 bg-white/5" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-24 bg-white/5" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32 bg-white/5" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28 bg-white/5" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16 bg-white/5" /></td>
                    </tr>
                  ))
                ) : !filtered.length ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16">
                      <Activity className="w-8 h-8 text-white/10 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Nenhuma atividade encontrada.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, i) => {
                    const colorClass = moduleColors[item.module] ?? "text-muted-foreground bg-white/5 border-white/10";
                    return (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3">
                          <p className="text-white text-sm font-medium">{translateAction(item.action)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${colorClass}`}>
                            {translateModule(item.module)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate max-w-40">
                              {item.userName ?? item.userEmail ?? "Desconhecido"}
                            </span>
                          </div>
                          {item.userName && item.userEmail && (
                            <p className="text-[10px] text-muted-foreground/60 ml-4.5 truncate max-w-40">{item.userEmail}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-muted-foreground truncate max-w-36">
                            {item.projectName ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                            <Clock className="w-3 h-3 shrink-0" />
                            {timeAgo(item.createdAt)}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
