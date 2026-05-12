import { useState } from "react";
import { motion } from "framer-motion";
import { FolderOpen, Plus, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects,
  useCreateProject,
  useDeleteProject,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  draft: "bg-white/5 text-muted-foreground border-white/10",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  in_progress: "Em Andamento",
  completed: "Concluído",
};

const typeLabels: Record<string, string> = {
  product_discovery: "Descoberta de Produtos",
  product_validation: "Validação de Produtos",
  campaign: "Campanha",
  content: "Conteúdo",
  creative: "Criativo",
  video_script: "Script de Vídeo",
  marketing: "Marketing",
};

const createSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["product_discovery", "product_validation", "campaign", "content", "creative", "video_script", "marketing"]),
  status: z.enum(["draft", "in_progress", "completed"]).optional(),
  description: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function Projects() {
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteProject.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          setDeletingId(null);
        },
        onError: () => setDeletingId(null),
      }
    );
  };

  const filtered = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Espaço de Trabalho</p>
        <h2 className="text-2xl font-bold text-white mb-1">Projetos</h2>
        <p className="text-muted-foreground text-sm">Gerencie todos os seus projetos em um só lugar.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-center gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-project-search"
            placeholder="Buscar projetos..."
            className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          data-testid="button-create-project"
          onClick={() => setIsDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" /> Novo Projeto
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
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
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.07] flex items-center justify-center shadow-depth">
              <FolderOpen className="w-8 h-8 text-white/[0.15]" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary/[0.12] border border-primary/25 flex items-center justify-center glow-gold-sm">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <div className="absolute -top-2 -left-2 w-2 h-2 rounded-full bg-primary/30 animate-ambient-float" />
            <div className="absolute top-1 right-0 w-1.5 h-1.5 rounded-full bg-white/[0.08] animate-ambient-float" style={{ animationDelay: "1.2s" }} />
          </div>
          <p className="text-base font-semibold text-zinc-300 mb-1.5">
            {search ? "Nenhum projeto encontrado" : "Sem projetos ainda"}
          </p>
          <p className="text-sm text-zinc-600 max-w-[240px] leading-relaxed mb-5">
            {search
              ? "Tente outro termo de busca."
              : "Organize seu trabalho com IA em projetos para acompanhar o progresso e continuar de onde parou."}
          </p>
          {!search && (
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
          {filtered.map((project) => (
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
                          {typeLabels[project.type] ?? project.type}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] capitalize shrink-0 px-2 py-0 ${statusColors[project.status] ?? ""}`}>
                          {statusLabels[project.status] ?? project.status.replace("_", " ")}
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
                      onClick={() => handleDelete(project.id)}
                      disabled={deletingId === project.id}
                      className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 p-1.5 rounded-lg hover:bg-red-400/[0.08] opacity-0 group-hover:opacity-100"
                    >
                      {deletingId === project.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

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
                  {Object.entries(typeLabels).map(([val, label]) => (
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
    </div>
  );
}
