import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Search, CheckCircle, Megaphone, FileText, Sparkles, Video,
  ArrowRight, TrendingUp, Layers, Zap, Clock, FolderOpen,
  Rocket, Trophy, BarChart2, BookMarked,
  Award,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetDashboardSummary, useListProjects,
  useListHistory, getListHistoryQueryKey,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { UpgradeNudge } from "@/components/UpgradeNudge";
import { useUserAccess } from "@/hooks/useUserAccess";

const quickActions = [
  { href: "/dashboard/find-products", label: "Buscar Produtos", icon: Search, desc: "Descubra produtos vencedores", color: "text-primary", bg: "bg-primary/10 border-primary/20", glow: "hover:shadow-[0_0_30px_-6px_rgba(201,168,76,0.2)]", module: "product_discovery" },
  { href: "/dashboard/validate-products", label: "Validar Produtos", icon: CheckCircle, desc: "Teste a demanda do mercado", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", glow: "hover:shadow-[0_0_30px_-6px_rgba(52,211,153,0.15)]", module: "product_validation" },
  { href: "/dashboard/create-campaign", label: "Criar Campanha", icon: Megaphone, desc: "Lance campanhas direcionadas", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", glow: "hover:shadow-[0_0_30px_-6px_rgba(251,191,36,0.15)]", module: "campaign" },
  { href: "/dashboard/create-content", label: "Criar Conteúdo", icon: FileText, desc: "Gere textos persuasivos", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", glow: "hover:shadow-[0_0_30px_-6px_rgba(96,165,250,0.15)]", module: "content" },
  { href: "/dashboard/creative-generator", label: "Gerador Criativo", icon: Sparkles, desc: "Crie materiais visuais", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20", glow: "hover:shadow-[0_0_30px_-6px_rgba(192,132,252,0.15)]", module: "creative" },
  { href: "/dashboard/video-scripts", label: "Scripts de Vídeo", icon: Video, desc: "Escreva scripts virais", color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20", glow: "hover:shadow-[0_0_30px_-6px_rgba(251,113,133,0.15)]", module: "video_script" },
];

const MODULE_TO_ACTION: Record<string, string> = {
  product_discovery: "find-products",
  find_products: "find-products",
  product_validation: "validate-products",
  validate_products: "validate-products",
  campaign: "create-campaign",
  content: "create-content",
  creative: "creative-generator",
  video_script: "video-scripts",
  marketing: "create-campaign",
};

const statusStyles: Record<string, { dot: string; badge: string }> = {
  draft: { dot: "bg-zinc-600", badge: "bg-white/5 text-zinc-500 border-white/[0.08]" },
  in_progress: { dot: "bg-primary", badge: "bg-primary/10 text-primary border-primary/25" },
  completed: { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
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

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 17) return "Boa tarde";
  return "Boa noite";
}

function StatCard({ label, value, icon: Icon, color, bg, loading }: {
  label: string; value: number; icon: React.ElementType; color: string; bg: string; loading: boolean;
}) {
  return (
    <div className="group relative p-5 bg-[#0f0f0f] border border-white/[0.06] rounded-2xl hover:border-white/[0.10] transition-all duration-300 overflow-hidden">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(255,255,255,0.015),transparent)]" />
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-4 ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      {loading ? (
        <Skeleton className="h-9 w-14 bg-white/[0.04] mb-1.5 rounded-lg" />
      ) : (
        <p className="text-3xl font-black text-white tabular-nums tracking-tight">{value}</p>
      )}
      <p className="text-xs text-zinc-600 mt-1 font-medium">{label}</p>
    </div>
  );
}

const ACHIEVEMENTS = [
  { id: "first_action", label: "Primeiro Passo", desc: "Executou seu primeiro módulo", icon: Zap, color: "text-primary bg-primary/10 border-primary/20", check: (s: { totalActions: number }) => s.totalActions >= 1 },
  { id: "first_project", label: "Construtor", desc: "Criou seu primeiro projeto", icon: FolderOpen, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", check: (s: { totalProjects: number }) => s.totalProjects >= 1 },
  { id: "five_actions", label: "Em Ritmo", desc: "Completou 5 execuções", icon: TrendingUp, color: "text-amber-400 bg-amber-400/10 border-amber-400/20", check: (s: { totalActions: number }) => s.totalActions >= 5 },
  { id: "ten_actions", label: "Avançado", desc: "Completou 10 execuções", icon: Trophy, color: "text-purple-400 bg-purple-400/10 border-purple-400/20", check: (s: { totalActions: number }) => s.totalActions >= 10 },
  { id: "three_projects", label: "Prolífico", desc: "Criou 3 ou mais projetos", icon: Layers, color: "text-blue-400 bg-blue-400/10 border-blue-400/20", check: (s: { totalProjects: number }) => s.totalProjects >= 3 },
  { id: "completed_project", label: "Finalizador", desc: "Concluiu seu primeiro projeto", icon: Award, color: "text-rose-400 bg-rose-400/10 border-rose-400/20", check: (s: { completedProjects: number }) => s.completedProjects >= 1 },
];

export function DashboardHome() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  const { data: historyData } = useListHistory(
    { limit: 10 },
    { query: { queryKey: getListHistoryQueryKey({ limit: 10 }), retry: false, staleTime: 60_000 } },
  );
  const { user, isLoaded } = useUser();
  const { planName, credits, balance } = useUserAccess();

  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || "você";
  const planLabel = planName;

  // Recently used tools — derive unique modules from history
  const recentModules = historyData
    ? Array.from(new Map(
        historyData
          .map((h) => MODULE_TO_ACTION[h.module])
          .filter(Boolean)
          .map((slug) => [slug, quickActions.find((a) => a.href === `/dashboard/${slug}`)])
          .filter((entry): entry is [string, typeof quickActions[0]] => !!entry[1])
      ).values()).slice(0, 3)
    : [];

  // Quick resume — last in-progress project
  const resumeProject = projects?.find((p) => p.status === "in_progress");

  // Achievements
  const summaryForBadges = {
    totalActions: summary?.totalActions ?? 0,
    totalProjects: summary?.totalProjects ?? 0,
    completedProjects: summary?.completedProjects ?? 0,
  };
  const unlockedAchievements = ACHIEVEMENTS.filter((a) => a.check(summaryForBadges));

  const statCards = [
    { label: "Projetos", value: summary?.totalProjects ?? 0, icon: Layers, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { label: "Em Andamento", value: summary?.activeProjects ?? 0, icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
    { label: "Concluídos", value: summary?.completedProjects ?? 0, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
    { label: "Execuções", value: summary?.totalActions ?? 0, icon: Zap, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  ];

  return (
    <div className="space-y-10 pb-2">

      <UpgradeNudge totalActions={summary?.totalActions ?? 0} />

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start justify-between gap-4"
      >
        <div className="space-y-1">
          <p className="text-[10px] text-primary font-bold tracking-widest uppercase">{getGreeting()}</p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {isLoaded ? `Bem-vindo, ${firstName}.` : "Bem-vindo."}
          </h2>
          <p className="text-sm text-zinc-500">Sua plataforma está pronta. O que vamos construir hoje?</p>
        </div>
        {planLabel && (
          <div className="shrink-0 hidden sm:flex flex-col items-end gap-1">
            <Badge className="bg-primary/10 text-primary border-primary/25 text-[10px] font-bold uppercase tracking-wider px-2.5">
              {planLabel}
            </Badge>
            <Link href="/dashboard/billing" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
              Gerenciar plano
            </Link>
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <StatCard {...stat} loading={summaryLoading} />
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Resume + Recently Used (side by side when both exist) */}
      {(resumeProject || recentModules.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Quick Resume */}
          {resumeProject && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38 }}
              className="group relative bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-4 hover:border-primary/20 hover:bg-[#111111] transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_80%_80%_at_0%_0%,rgba(201,168,76,0.04),transparent)]" />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Rocket className="w-3 h-3 text-primary" />
                </div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Retomar</span>
              </div>
              <p className="text-sm font-bold text-zinc-200 truncate mb-1">{resumeProject.name}</p>
              <p className="text-xs text-zinc-600 mb-3">{typeLabels[resumeProject.type] ?? resumeProject.type}</p>
              <Link href="/dashboard/projects">
                <button className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                  Continuar projeto <ArrowRight className="w-3 h-3" />
                </button>
              </Link>
            </motion.div>
          )}

          {/* Recently Used Tools */}
          {recentModules.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.06 }}
              className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <Clock className="w-3 h-3 text-zinc-500" />
                </div>
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Usado Recentemente</span>
              </div>
              <div className="space-y-2">
                {recentModules.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.href} href={action.href}>
                      <div className="flex items-center gap-2.5 py-1.5 group cursor-pointer">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${action.bg}`}>
                          <Icon className={`w-3.5 h-3.5 ${action.color}`} />
                        </div>
                        <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">{action.label}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-500 ml-auto transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Achievements */}
      {unlockedAchievements.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Conquistas</p>
            <span className="text-[10px] text-zinc-700">{unlockedAchievements.length} / {ACHIEVEMENTS.length} desbloqueadas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ACHIEVEMENTS.map((badge) => {
              const unlocked = badge.check(summaryForBadges);
              const Icon = badge.icon;
              return (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  title={badge.desc}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                    unlocked
                      ? badge.color
                      : "text-zinc-700 bg-white/[0.02] border-white/[0.05] opacity-40"
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  {badge.label}
                  {!unlocked && <span className="ml-1 opacity-50">bloqueada</span>}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Módulos</p>
          <span className="text-[10px] text-zinc-700">6 disponíveis</span>
        </div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
        >
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.div key={action.href} variants={itemVariants}>
                <Link href={action.href} data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className={`group flex items-center gap-4 p-4 rounded-xl bg-[#0f0f0f] border border-white/[0.06] hover:border-white/[0.12] hover:bg-[#131313] transition-all duration-250 cursor-pointer ${action.glow}`}>
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 ${action.bg}`}>
                      <Icon className={`w-4.5 h-4.5 ${action.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">{action.label}</p>
                      <p className="text-xs text-zinc-600 truncate mt-0.5">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Projetos Recentes</p>
          <Link href="/dashboard/projects" className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors">
            Ver todos
          </Link>
        </div>

        {projectsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[62px] w-full bg-white/[0.025] rounded-xl" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-2">
            {projects.slice(0, 5).map((project) => {
              const style = statusStyles[project.status] ?? statusStyles.draft;
              return (
                <motion.div key={project.id} variants={itemVariants}>
                  <div
                    data-testid={`project-row-${project.id}`}
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.06] hover:border-white/[0.09] hover:bg-[#111111] transition-all duration-200"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{project.name}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{typeLabels[project.type] ?? project.type}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className={`text-[10px] capitalize ${style.badge}`}>
                        {({ draft: "Rascunho", in_progress: "Em Andamento", completed: "Concluído" } as Record<string, string>)[project.status] ?? project.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-white/[0.07] rounded-2xl bg-white/[0.01]"
          >
            <div className="relative mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-zinc-700" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                <span className="text-[9px] text-primary font-bold">0</span>
              </div>
            </div>
            <p className="text-sm font-semibold text-zinc-500">Sem projetos ainda</p>
            <p className="text-xs text-zinc-700 mt-1 max-w-[200px] leading-relaxed">
              Use um módulo para criar seu primeiro projeto
            </p>
            <Link href="/dashboard/projects" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-3 font-semibold transition-colors">
              Criar um projeto <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>
        )}
      </div>

      {/* Footer links row */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/history" className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            <Clock className="w-3.5 h-3.5" />
            Histórico
          </Link>
          <Link href="/dashboard/analytics" className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            <BarChart2 className="w-3.5 h-3.5" />
            Análises
          </Link>
          <Link href="/dashboard/prompts" className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            <BookMarked className="w-3.5 h-3.5" />
            Prompts Salvos
          </Link>
        </div>
        <Link href="/dashboard/credits" className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          <Zap className="w-3.5 h-3.5" />
          {balance ? `${credits.toLocaleString()} créditos restantes` : "Ver créditos"}
        </Link>
      </div>

    </div>
  );
}
