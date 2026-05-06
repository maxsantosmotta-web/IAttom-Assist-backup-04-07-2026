import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Search, CheckCircle, Megaphone, FileText, Sparkles, Video,
  ArrowRight, TrendingUp, Layers, Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetDashboardSummary, useListProjects } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

const quickActions = [
  { href: "/dashboard/find-products", label: "Find Products", icon: Search, desc: "Discover winning products", color: "text-primary bg-primary/10 border-primary/20" },
  { href: "/dashboard/validate-products", label: "Validate Products", icon: CheckCircle, desc: "Test market demand", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  { href: "/dashboard/create-campaign", label: "Create Campaign", icon: Megaphone, desc: "Launch targeted campaigns", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  { href: "/dashboard/create-content", label: "Create Content", icon: FileText, desc: "Generate compelling copy", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  { href: "/dashboard/creative-generator", label: "Creative Generator", icon: Sparkles, desc: "Design visual creatives", color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  { href: "/dashboard/video-scripts", label: "Video Scripts", icon: Video, desc: "Write viral video scripts", color: "text-rose-400 bg-rose-400/10 border-rose-400/20" },
];

const statusColors: Record<string, string> = {
  draft: "bg-white/5 text-zinc-500 border-white/10",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
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
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHome() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  const { user, isLoaded } = useUser();

  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || "there";

  const stats = [
    { label: "Total Projects", value: summary?.totalProjects ?? 0, icon: Layers, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { label: "Active Projects", value: summary?.activeProjects ?? 0, icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
    { label: "Completed", value: summary?.completedProjects ?? 0, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
    { label: "Total Actions", value: summary?.totalActions ?? 0, icon: Zap, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="space-y-1"
      >
        <p className="text-xs text-primary font-semibold tracking-widest uppercase">
          {getGreeting()}
        </p>
        <h2 className="text-3xl font-bold tracking-[-0.02em] text-white">
          Welcome back, {isLoaded ? firstName : "—"}.
        </h2>
        <p className="text-sm text-zinc-500">
          Your intelligence platform is ready. What are we building today?
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={itemVariants}>
              <Card className="bg-[#0f0f0f] border-white/[0.06] hover:border-white/10 transition-all duration-200 group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${stat.bg}`}>
                      <Icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                  </div>
                  {summaryLoading ? (
                    <Skeleton className="h-8 w-12 bg-white/5 mb-1.5" />
                  ) : (
                    <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
                      {stat.value}
                    </p>
                  )}
                  <p className="text-xs text-zinc-600 mt-1 font-medium">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
            AI Modules
          </h3>
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
                <Link
                  href={action.href}
                  data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="group flex items-center gap-4 p-4 rounded-xl bg-[#0f0f0f] border border-white/[0.06] hover:border-white/[0.12] hover:bg-[#131313] transition-all duration-200 cursor-pointer">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${action.color}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                        {action.label}
                      </p>
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
          <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
            Recent Projects
          </h3>
          <Link
            href="/dashboard/projects"
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {projectsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-white/[0.03] rounded-xl" />
            ))
          ) : projects && projects.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {(projects ?? []).slice(0, 5).map((project) => (
                <motion.div key={project.id} variants={itemVariants}>
                  <div
                    data-testid={`project-row-${project.id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-[#0f0f0f] border border-white/[0.06] hover:border-white/[0.10] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-primary/60 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{project.name}</p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {typeLabels[project.type] ?? project.type}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize shrink-0 ml-4 ${statusColors[project.status] ?? ""}`}
                    >
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                <Layers className="w-5 h-5 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-600">No projects yet.</p>
              <Link
                href="/dashboard/projects"
                className="text-xs text-primary hover:text-primary/80 mt-1 font-medium transition-colors"
              >
                Create your first project
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
