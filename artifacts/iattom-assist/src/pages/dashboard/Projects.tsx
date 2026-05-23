import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen, Plus, Trash2, Loader2, Search, BookOpen,
  Megaphone, FileText, Sparkles, Video, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects, useCreateProject, useDeleteProject, getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface SavedItem {
  id: string;
  title: string;
  type: "campaign" | "content" | "creative" | "video_script";
  platform?: string;
  content: string;
  data?: string;
  createdAt: string;
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string; badge: string }> = {
  campaign:     { label: "Campanhas",  icon: Megaphone, color: "text-amber-400",  badge: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  content:      { label: "Conteúdos",  icon: FileText,  color: "text-blue-400",   badge: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
  creative:     { label: "Criativos",  icon: Sparkles,  color: "text-purple-400", badge: "bg-purple-400/10 text-purple-400 border-purple-400/20" },
  video_script: { label: "Scripts",    icon: Video,     color: "text-rose-400",   badge: "bg-rose-400/10 text-rose-400 border-rose-400/20" },
};

const typeLabels: Record<string, string> = {
  campaign: "Campanhas", content: "Conteúdos", creative: "Criativos", video_script: "Scripts",
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

const projectStatusColors: Record<string, string> = {
  draft: "bg-white/5 text-muted-foreground border-white/10",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};
const projectStatusLabels: Record<string, string> = { draft: "Rascunho", in_progress: "Em Andamento", completed: "Concluído" };
const projectTypeLabels: Record<string, string> = {
  product_discovery: "Descoberta de Produtos", product_validation: "Validação de Produtos",
  campaign: "Campanha", content: "Conteúdo", creative: "Criativo",
  video_script: "Script de Vídeo", marketing: "Marketing",
};

const createSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["product_discovery", "product_validation", "campaign", "content", "creative", "video_script", "marketing"]),
  status: z.enum(["draft", "in_progress", "completed"]).optional(),
  description: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function Projects() {
  const [activeTab, setActiveTab] = useState<"library" | "projects">("library");

  /* ── Biblioteca state ── */
  const [savedItems, setSavedItems] = useState<SavedItem[]>(readStorage);
  const [typeFilter, setTypeFilter] = useState("all");
  const [libSearch, setLibSearch] = useState("");
  const [viewingItem, setViewingItem] = useState<SavedItem | null>(null);
  const [deletingLibId, setDeletingLibId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (activeTab === "library") setSavedItems(readStorage());
  }, [activeTab]);

  const filteredItems = savedItems.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (libSearch && !item.title.toLowerCase().includes(libSearch.toLowerCase())) return false;
    return true;
  });

  const handleOpenItem = (item: SavedItem) => {
    if (item.type === "campaign") {
      if (item.data) sessionStorage.setItem("iattom_reopen_campaign_v1", item.data);
      navigate("/dashboard/create-campaign");
    } else {
      setViewingItem(item);
    }
  };

  const handleDeleteItem = (id: string) => {
    setDeletingLibId(id);
    setTimeout(() => {
      const updated = savedItems.filter((i) => i.id !== id);
      setSavedItems(updated);
      try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify(updated)); } catch {}
      toast({ description: "Item removido da biblioteca." });
      setDeletingLibId(null);
    }, 200);
  };

  /* ── Projects state (API) ── */
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projSearch, setProjSearch] = useState("");
  const [deletingProjId, setDeletingProjId] = useState<number | null>(null);

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = (data: CreateForm) => {
    createProject.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          setIsDialogOpen(false);
          form.reset();
        },
      }
    );
  };

  const handleDeleteProj = (id: number) => {
    setDeletingProjId(id);
    deleteProject.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          setDeletingProjId(null);
        },
        onError: () => setDeletingProjId(null),
      }
    );
  };

  const filteredProjects = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(projSearch.toLowerCase())
  );

  /* ── Tab selector ── */
  const tabs = [
    { id: "library" as const, label: "Biblioteca", icon: BookOpen, count: savedItems.length },
    { id: "projects" as const, label: "Projetos", icon: FolderOpen, count: projects?.length ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Espaço de Trabalho</p>
        <h2 className="text-2xl font-bold text-white mb-1">Biblioteca & Projetos</h2>
        <p className="text-muted-foreground text-sm">Acesse campanhas, conteúdos, criativos e scripts salvos — além dos seus projetos.</p>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
        <div className="flex gap-1 p-1 bg-[#0d0d0d] border border-white/[0.06] rounded-xl w-fit">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === id ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── BIBLIOTECA TAB ── */}
      {activeTab === "library" && (
        <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-5">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar na biblioteca..."
                className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50"
                value={libSearch}
                onChange={(e) => setLibSearch(e.target.value)}
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
          </div>

          {/* Items */}
          {filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.07] flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-white/[0.15]" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary/[0.12] border border-primary/25 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="text-base font-semibold text-zinc-300 mb-1.5">
                {libSearch || typeFilter !== "all" ? "Nenhum item encontrado" : "Biblioteca vazia"}
              </p>
              <p className="text-sm text-zinc-600 max-w-[240px] leading-relaxed">
                {libSearch || typeFilter !== "all"
                  ? "Tente outro filtro ou termo de busca."
                  : "Salve campanhas, criativos, conteúdos e scripts para encontrá-los aqui."}
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
                              disabled={deletingLibId === item.id}
                              className="w-7 h-7 flex items-center justify-center text-zinc-700 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/[0.08] opacity-0 group-hover:opacity-100"
                            >
                              {deletingLibId === item.id
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
        </motion.div>
      )}

      {/* ── PROJETOS TAB ── */}
      {activeTab === "projects" && (
        <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="input-project-search"
                placeholder="Buscar projetos..."
                className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50"
                value={projSearch}
                onChange={(e) => setProjSearch(e.target.value)}
              />
            </div>
            <Button
              data-testid="button-create-project"
              onClick={() => setIsDialogOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" /> Novo Projeto
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.07] flex items-center justify-center shadow-depth">
                  <FolderOpen className="w-8 h-8 text-white/[0.15]" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary/[0.12] border border-primary/25 flex items-center justify-center glow-gold-sm">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="text-base font-semibold text-zinc-300 mb-1.5">
                {projSearch ? "Nenhum projeto encontrado" : "Sem projetos ainda"}
              </p>
              <p className="text-sm text-zinc-600 max-w-[240px] leading-relaxed mb-5">
                {projSearch
                  ? "Tente outro termo de busca."
                  : "Organize seu trabalho em projetos para acompanhar o progresso."}
              </p>
              {!projSearch && (
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  className="bg-primary/[0.10] text-primary border border-primary/25 hover:bg-primary/[0.16] hover:border-primary/35 transition-all duration-200 press-effect"
                >
                  <Plus className="w-4 h-4 mr-2" /> Criar primeiro projeto
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-2.5">
              {filteredProjects.map((project) => (
                <motion.div key={project.id} variants={itemVariants}>
                  <Card
                    data-testid={`card-project-${project.id}`}
                    className="bg-[#0f0f0f] border-white/[0.055] hover:border-white/[0.10] hover:bg-[#111111] transition-all duration-200 group overflow-hidden shadow-depth-sm"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                            <h4 className="font-semibold text-zinc-100 text-sm group-hover:text-white transition-colors">{project.name}</h4>
                            <Badge variant="outline" className="text-[10px] border-white/[0.08] text-zinc-500 shrink-0 px-2 py-0">
                              {projectTypeLabels[project.type] ?? project.type}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] capitalize shrink-0 px-2 py-0 ${projectStatusColors[project.status] ?? ""}`}>
                              {projectStatusLabels[project.status] ?? project.status.replace("_", " ")}
                            </Badge>
                          </div>
                          {project.description && (
                            <p className="text-xs text-zinc-600 truncate mb-1">{project.description}</p>
                          )}
                          <p className="text-[11px] text-zinc-700 mt-1">
                            Atualizado {new Date(project.updatedAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <button
                          data-testid={`button-delete-project-${project.id}`}
                          onClick={() => handleDeleteProj(project.id)}
                          disabled={deletingProjId === project.id}
                          className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 p-1.5 rounded-lg hover:bg-red-400/[0.08] opacity-0 group-hover:opacity-100"
                        >
                          {deletingProjId === project.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Novo Projeto dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#0f0f0f] border-white/[0.10] text-white max-w-md shadow-depth-lg animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-white">Novo Projeto</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Nome do Projeto</Label>
              <Input
                data-testid="input-new-project-name"
                placeholder="ex: Campanha de Verão"
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Tipo do Projeto</Label>
              <Select onValueChange={(v) => form.setValue("type", v as CreateForm["type"])}>
                <SelectTrigger data-testid="select-new-project-type" className="bg-[#0a0a0a] border-white/10">
                  <SelectValue placeholder="Selecionar tipo" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-white/10">
                  {Object.entries(projectTypeLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.type && (
                <p className="text-xs text-destructive">{form.formState.errors.type.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Descrição (opcional)</Label>
              <Textarea
                data-testid="input-new-project-description"
                placeholder="Breve descrição deste projeto..."
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50 resize-none"
                rows={2}
                {...form.register("description")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-muted-foreground">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createProject.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Projeto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Visualizador de item (conteúdo/criativo/script) */}
      <Dialog open={!!viewingItem} onOpenChange={(o) => { if (!o) setViewingItem(null); }}>
        {viewingItem && (
          <DialogContent className="bg-[#0f0f0f] border-white/[0.10] text-white max-w-2xl max-h-[80vh] shadow-depth-lg animate-scale-in flex flex-col">
            <DialogHeader className="shrink-0">
              <div className="flex items-start gap-3">
                {(() => {
                  const cfg = typeConfig[viewingItem.type] ?? typeConfig.campaign;
                  const Icon = cfg.icon;
                  return (
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cfg.badge}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-white text-base leading-snug">{viewingItem.title}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] text-zinc-600">{timeAgo(viewingItem.createdAt)}</span>
                    {viewingItem.platform && platformLabels[viewingItem.platform] && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/[0.04] text-zinc-500 border-white/[0.08]">
                        {platformLabels[viewingItem.platform]}
                      </Badge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setViewingItem(null)}
                  className="text-zinc-600 hover:text-white transition-colors p-1 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto mt-4 min-h-0">
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed font-mono bg-[#0a0a0a] border border-white/5 rounded-lg p-4">
                {viewingItem.content}
              </pre>
            </div>
            <div className="shrink-0 pt-4 flex justify-end gap-2 border-t border-white/5 mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(viewingItem.content);
                  toast({ description: "Conteúdo copiado." });
                }}
              >
                Copiar texto
              </Button>
              <Button
                size="sm"
                className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs"
                onClick={() => setViewingItem(null)}
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
