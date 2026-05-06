import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Search, CheckCircle, Megaphone, FileText, Sparkles, Video,
  ArrowRight, TrendingUp, Layers, Zap, Clock, FolderOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetDashboardSummary, useListProjects, useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

const quickActions = [
  {
    href: "/dashboard/find-products",
    label: "Find Products",
    icon: Search,
    desc: "Discover winning products",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    glow: "hover:shadow-[0_0_30px_-6px_rgba(201,168,76,0.2)]",
  },
  {
    href: "/dashboard/validate-products",
    label: "Validate Products",
    icon: CheckCircle,
    desc: "Test market demand",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
    glow: "hover:shadow-[0_0_30px_-6px_rgba(52,211,153,0.15)]",
  },
  {
    href: "/dashboard/create-campaign",
    label: "Create Campaign",
    icon: Megaphone,
    desc: "Launch targeted campaigns",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    glow: "hover:shadow-[0_0_30px_-6px_rgba(251,191,36,0.15)]",
  },
  {
    href: "/dashboard/create-content",
    label: "Create Content",
    icon: FileText,
    desc: "Generate compelling copy",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    glow: "hover:shadow-[0_0_30px_-6px_rgba(96,165,250,0.15)]",
  },
  {
    href: "/dashboard/creative-generator",
    label: "Creative Generator",
    icon: Sparkles,
    desc: "Design visual creatives",
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
    glow: "hover:shadow-[0_0_30px_-6px_rgba(192,132,252,0.15)]",
  },
  {
    href: "/dashboard/video-scripts",
    label: "Video Scripts",
    icon: Video,
    desc: "Write viral video scripts",
    color: "text-rose-400",
    bg: "bg-rose-400/10 border-rose-400/20",
    glow: "hover:shadow-[0_0_30px_-6px_rgba(251,113,133,0.15)]",
  },
];

const statusStyles: Record<string, { dot: string; badge: string }> = {
  draft: { dot: "bg-zinc-600", badge: "bg-white/5 text-zinc-500 border-white/[0.08]" },
  in_progress: { dot: "bg-primary", badge: "bg-primary/10 text-primary border-primary/25" },
  completed: { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

const typeLabels: Record<string, string> = {
  product_discovery: "Product Discovery",
  product_validation: "Product Validation",
  campaign: "Campaign",
  content: "Content",
  creative: "Creative",
  video_script: "Video Script",
  marketing: "Marketing",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
  loading: boolean;
}) {
  return (
    <div className="group relative p-5 bg-[#0f0f0f] border border-white/[0.06] rounded-2xl hover:border-white/[0.10] transition-all duration-300 overflow-hidden">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(255,255,255,0.015),transparent)]" />
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
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

export function DashboardHome() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  const { data: creditsData } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), retry: false, staleTime: 30_000 },
  });
  const { user, isLoaded } = useUser();

  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || "there";
  const plan = creditsData ? (creditsData as { plan?: string }).plan as string | undefined : undefined;

  const statCards = [
    { label: "Total Projects", value: summary?.totalProjects ?? 0, icon: Layers, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { label: "In Progress", value: summary?.activeProjects ?? 0, icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
    { label: "Completed", value: summary?.completedProjects ?? 0, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
    { label: "AI Actions", value: summary?.totalActions ?? 0, icon: Zap, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  ];

  return (
    <div className="space-y-10 pb-2">

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start justify-between gap-4"
      >
        <div className="space-y-1">
          <p className="text-[10px] text-primary font-bold tracking-widest uppercase">
            {getGreeting()}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {isLoaded ? `Welcome back, ${firstName}.` : "Welcome back."}
          </h2>
          <p className="text-sm text-zinc-500">
            Your intelligence platform is ready. What are we building today?
          </p>
        </div>
        {plan && (
          <div className="shrink-0 hidden sm:flex flex-col items-end gap-1">
            <Badge className="bg-primary/10 text-primary border-primary/25 text-[10px] font-bold uppercase tracking-wider capitalize px-2.5">
              {plan} plan
            </Badge>
            <Link href="/dashboard/billing" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
              Manage billing
            </Link>
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {statCards.map((stat) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <StatCard {...stat} loading={summaryLoading} />
          </motion.div>
        ))}
      </motion.div>

      {/* AI Modules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">AI Modules</p>
          <span className="text-[10px] text-zinc-700">6 available</span>
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
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Recent Projects</p>
          <Link href="/dashboard/projects" className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors">
            View all
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
                        {project.status.replace("_", " ")}
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
            <p className="text-sm font-semibold text-zinc-500">No projects yet</p>
            <p className="text-xs text-zinc-700 mt-1 max-w-[200px] leading-relaxed">
              Run an AI module to automatically create your first project
            </p>
            <Link href="/dashboard/projects" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-3 font-semibold transition-colors">
              Create a project <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>
        )}
      </div>

      {/* Recent activity hint */}
      <div className="flex items-center justify-between py-1">
        <Link
          href="/dashboard/history"
          className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <Clock className="w-3.5 h-3.5" />
          View full activity history
        </Link>
        <Link
          href="/dashboard/credits"
          className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          {creditsData ? `${creditsData.balance.toLocaleString()} credits remaining` : "View credits"}
        </Link>
      </div>

    </div>
  );
}
