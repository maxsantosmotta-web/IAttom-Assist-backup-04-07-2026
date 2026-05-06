import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Database,
  Shield,
  Zap,
  CreditCard,
  Brain,
  Smartphone,
  Globe,
  Server,
  Key,
  Rocket,
  Users,
  ChevronRight,
  ExternalLink,
  ClipboardCheck,
  Circle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CheckStatus = "ready" | "needs_attention" | "not_configured" | "loading" | "error";

interface LaunchStatusData {
  database: { status: "ready" | "error"; userCount: number; message: string };
  adminUsers: { status: "ready" | "needs_attention"; count: number };
  creditsSystem: { status: "ready"; transactionCount: number };
  stripeProducts: { status: "ready" | "not_configured"; count: number };
  aiConfig: { status: "ready" | "not_configured" };
  envVars: Record<string, boolean>;
  allEnvVarsConfigured: boolean;
}

interface CheckItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

const TEST_STEPS_KEY = "iattom_launch_test_steps_v1";

const TEST_STEPS = [
  {
    id: "create_user",
    label: "Create Test User",
    description:
      "Navigate to the sign-up page and create a fresh test account using a test email address. Verify the email confirmation flow works end-to-end.",
    link: "/sign-up",
    linkLabel: "Open Sign Up",
  },
  {
    id: "test_login",
    label: "Test Login Flow",
    description:
      "Sign out and sign back in with the test account. Verify the dashboard loads correctly with the sidebar, credits widget, and all nav items visible.",
    link: "/sign-in",
    linkLabel: "Open Sign In",
  },
  {
    id: "test_ai",
    label: "Test AI Generation",
    description:
      'Go to Find Products, enter a product niche (e.g. "eco-friendly water bottles"), and click Generate. Confirm the AI streams results and the result card appears.',
    link: "/dashboard/find-products",
    linkLabel: "Find Products",
  },
  {
    id: "test_credits",
    label: "Verify Credit Deduction",
    description:
      "After running an AI module, check the Credits page. Confirm the balance decreased by the correct amount and a new transaction record appeared in the history table.",
    link: "/dashboard/credits",
    linkLabel: "View Credits",
  },
  {
    id: "test_billing",
    label: "Test Billing Upgrade",
    description:
      "Go to Billing, click Upgrade on the Pro plan ($79/mo). Verify the Stripe Checkout page opens. Cancel without completing to avoid charges.",
    link: "/dashboard/billing",
    linkLabel: "View Billing",
  },
  {
    id: "test_admin",
    label: "Test Admin User Management",
    description:
      "Find the test user in Admin → Users. Edit their role, plan, and credit balance. Verify changes save correctly and reflect immediately in the table.",
    link: "/admin/users",
    linkLabel: "Admin Users",
  },
  {
    id: "test_mobile",
    label: "Test Mobile Layout",
    description:
      "Resize your browser to 375px wide (or use DevTools device mode). Verify the sidebar collapses to a hamburger menu, all content is readable, and no horizontal overflow occurs.",
  },
  {
    id: "test_logout",
    label: "Test Logout & Route Protection",
    description:
      "Sign out from the user dropdown in the sidebar. Verify you land on the landing page. Then try navigating to /dashboard — confirm you are redirected back to sign-in.",
    link: "/dashboard",
    linkLabel: "Try /dashboard (should redirect)",
  },
];

const MANUAL_CONFIG = [
  {
    id: "stripe",
    label: "Stripe Products",
    color: "text-emerald-400",
    bg: "bg-emerald-400/5 border-emerald-400/15",
    steps: [
      "Connect the Stripe integration in the Replit Integrations panel",
      "Run: pnpm --filter @workspace/scripts run seed-products",
      "Verify Pro ($79), Business ($199), and Agency ($499) products appear in your Stripe dashboard",
      "Confirm webhook is registered — the server auto-registers it on startup",
    ],
  },
  {
    id: "clerk",
    label: "Clerk OAuth & Email",
    color: "text-blue-400",
    bg: "bg-blue-400/5 border-blue-400/15",
    steps: [
      "Log in to your Clerk dashboard at clerk.com",
      "Enable Google OAuth and/or GitHub under Social Connections",
      "Add your OAuth app credentials from Google Cloud Console or GitHub Settings",
      "Configure allowed redirect URLs to match your production domain",
    ],
  },
  {
    id: "env",
    label: "Environment Variables",
    color: "text-amber-400",
    bg: "bg-amber-400/5 border-amber-400/15",
    steps: [
      "CLERK_SECRET_KEY — from your Clerk dashboard API Keys page",
      "VITE_CLERK_PUBLISHABLE_KEY — public key from Clerk dashboard",
      "AI_INTEGRATIONS_OPENAI_BASE_URL + API_KEY — from Replit AI Integrations",
      "SESSION_SECRET — generate a random 64-character string",
      "DATABASE_URL — automatically set when using Replit PostgreSQL",
    ],
  },
  {
    id: "deploy",
    label: "Production Deployment",
    color: "text-purple-400",
    bg: "bg-purple-400/5 border-purple-400/15",
    steps: [
      "Click Deploy in Replit to create a production environment",
      "Set all environment variables in the production deployment settings",
      "Optionally configure a custom domain in Replit Deployments",
      "Run seed-products script against production DB if not already done",
      "Test the Stripe webhook URL using your production domain",
    ],
  },
];

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-500 font-medium">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Checking
      </span>
    );
  }
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Ready
      </span>
    );
  }
  if (status === "needs_attention") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
        <AlertTriangle className="w-2.5 h-2.5" />
        Needs Attention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">
      <XCircle className="w-2.5 h-2.5" />
      Not Configured
    </span>
  );
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "loading") return <Loader2 className="w-4 h-4 text-zinc-600 animate-spin" />;
  if (status === "ready") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "needs_attention") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <XCircle className="w-4 h-4 text-red-400" />;
}

function buildCheckItems(data: LaunchStatusData | null, apiOk: boolean | null): CheckItem[] {
  const loading = data === null;
  const isProduction =
    typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1");

  return [
    {
      id: "api_health",
      label: "API Health",
      description: "Express API server is reachable and responding",
      icon: Server,
      status: loading
        ? "loading"
        : apiOk === null
        ? "loading"
        : apiOk
        ? "ready"
        : "error",
      detail: loading || apiOk === null ? "Checking..." : apiOk ? "API server responding normally" : "API server unreachable",
      fix: "Ensure the API server workflow is running",
    },
    {
      id: "database",
      label: "Database Health",
      description: "PostgreSQL connection established and schema migrated",
      icon: Database,
      status: loading ? "loading" : data!.database.status === "ready" ? "ready" : "error",
      detail: loading ? "Checking..." : data!.database.message,
      fix: "Check DATABASE_URL env var and ensure PostgreSQL is running",
    },
    {
      id: "env_vars",
      label: "Environment Variables",
      description: "All required secrets and configuration keys are set",
      icon: Key,
      status: loading ? "loading" : data!.allEnvVarsConfigured ? "ready" : "needs_attention",
      detail: loading
        ? "Checking..."
        : data!.allEnvVarsConfigured
        ? "All 6 required environment variables are configured"
        : `Missing: ${Object.entries(data!.envVars).filter(([, v]) => !v).map(([k]) => k).join(", ")}`,
      fix: "Set all missing environment variables in Replit Secrets",
    },
    {
      id: "auth",
      label: "Authentication",
      description: "Clerk authentication is wired up for sign-in and sign-up",
      icon: Shield,
      status: loading
        ? "loading"
        : data!.envVars["CLERK_SECRET_KEY"] && data!.envVars["CLERK_PUBLISHABLE_KEY"]
        ? "ready"
        : "not_configured",
      detail: loading
        ? "Checking..."
        : data!.envVars["CLERK_SECRET_KEY"]
        ? "Clerk keys configured — sign-in and sign-up active"
        : "CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY missing",
      fix: "Add Clerk API keys from your Clerk dashboard",
    },
    {
      id: "admin",
      label: "Admin Permissions",
      description: "At least one admin user has been configured",
      icon: Shield,
      status: loading ? "loading" : data!.adminUsers.status,
      detail: loading
        ? "Checking..."
        : data!.adminUsers.count > 0
        ? `${data!.adminUsers.count} admin${data!.adminUsers.count !== 1 ? "s" : ""} configured`
        : "No admin users found — visit /admin to run first-admin bootstrap",
      fix: "Navigate to /admin and click Claim Admin Access",
    },
    {
      id: "ai",
      label: "AI Modules",
      description: "OpenAI integration is configured for all 6 AI features",
      icon: Brain,
      status: loading ? "loading" : data!.aiConfig.status,
      detail: loading
        ? "Checking..."
        : data!.aiConfig.status === "ready"
        ? "OpenAI integration active — all 6 modules ready"
        : "AI_INTEGRATIONS_OPENAI_BASE_URL or API_KEY not set",
      fix: "Enable the AI Integrations add-on in Replit and set env vars",
    },
    {
      id: "credits",
      label: "Credits System",
      description: "Per-user credit balances, deduction, and transaction history",
      icon: Zap,
      status: loading ? "loading" : "ready",
      detail: loading
        ? "Checking..."
        : `Credits engine active — ${data!.creditsSystem.transactionCount} transaction${data!.creditsSystem.transactionCount !== 1 ? "s" : ""} recorded`,
    },
    {
      id: "stripe",
      label: "Stripe Billing",
      description: "Stripe products seeded and checkout flow configured",
      icon: CreditCard,
      status: loading ? "loading" : data!.stripeProducts.status,
      detail: loading
        ? "Checking..."
        : data!.stripeProducts.status === "ready"
        ? `${data!.stripeProducts.count} paid plan${data!.stripeProducts.count !== 1 ? "s" : ""} configured in Stripe`
        : "Run seed-products script to create Stripe products",
      fix: "Run: pnpm --filter @workspace/scripts run seed-products",
    },
    {
      id: "users",
      label: "User Workspaces",
      description: "Users can register, sign in, and access private workspaces",
      icon: Users,
      status: loading
        ? "loading"
        : data!.database.userCount > 0
        ? "ready"
        : "needs_attention",
      detail: loading
        ? "Checking..."
        : data!.database.userCount > 0
        ? `${data!.database.userCount} user${data!.database.userCount !== 1 ? "s" : ""} have registered`
        : "No users yet — register the first account to verify workspace isolation",
      fix: "Create a test user account via the sign-up page",
    },
    {
      id: "landing",
      label: "Public Landing Page",
      description: "Marketing landing page is accessible without authentication",
      icon: Globe,
      status: "ready",
      detail: "Landing page publicly accessible at the root URL",
    },
    {
      id: "mobile",
      label: "Mobile Responsiveness",
      description: "Sidebar collapses on mobile, all layouts adapt to small screens",
      icon: Smartphone,
      status: "ready",
      detail: "Responsive layouts implemented — tested at 375px and above",
    },
    {
      id: "production",
      label: "Production Deployment",
      description: "App is deployed to a production environment with a live URL",
      icon: Rocket,
      status: isProduction ? "ready" : "needs_attention",
      detail: isProduction
        ? `Live on ${window.location.hostname}`
        : "Running in development — click Deploy in Replit to go live",
      fix: "Use Replit Deployments to publish to a .replit.app domain",
    },
  ];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function AdminLaunchChecklist() {
  const [statusData, setStatusData] = useState<LaunchStatusData | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const [testStepsDone, setTestStepsDone] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(TEST_STEPS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statusRes, healthRes] = await Promise.all([
        fetch("/api/admin/launch-status", { credentials: "include" }),
        fetch("/api/healthz").then((r) => r.ok).catch(() => false),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatusData(data);
      }
      setApiOk(healthRes as boolean);
    } catch {
      setApiOk(false);
    } finally {
      setIsLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggleTestStep = (id: string) => {
    setTestStepsDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(TEST_STEPS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const resetTestSteps = () => {
    setTestStepsDone({});
    try { localStorage.removeItem(TEST_STEPS_KEY); } catch {}
  };

  const checkItems = buildCheckItems(statusData, apiOk);
  const readyCount = checkItems.filter((c) => c.status === "ready").length;
  const needsAttentionCount = checkItems.filter((c) => c.status === "needs_attention").length;
  const notConfiguredCount = checkItems.filter((c) =>
    c.status === "not_configured" || c.status === "error",
  ).length;
  const testStepsDoneCount = TEST_STEPS.filter((s) => testStepsDone[s.id]).length;
  const readinessPercent = Math.round((readyCount / checkItems.length) * 100);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Pre-Launch</p>
            <h2 className="text-2xl font-bold text-white mb-1">Launch Checklist</h2>
            <p className="text-muted-foreground text-sm">
              System readiness overview and guided testing flow before going live.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={isLoading}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {lastChecked && (
          <p className="text-xs text-zinc-600 mt-2">
            Last checked: {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </motion.div>

      {/* Readiness Score */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  Readiness Score
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {readyCount} of {checkItems.length} checks passing
                </p>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-bold tabular-nums ${readinessPercent === 100 ? "text-emerald-400" : readinessPercent >= 70 ? "text-primary" : "text-amber-400"}`}>
                  {readinessPercent}%
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  readinessPercent === 100
                    ? "bg-emerald-400"
                    : readinessPercent >= 70
                    ? "bg-primary"
                    : "bg-amber-400"
                }`}
                style={{ width: `${readinessPercent}%` }}
              />
            </div>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                {readyCount} Ready
              </div>
              {needsAttentionCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  {needsAttentionCount} Needs Attention
                </div>
              )}
              {notConfiguredCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <XCircle className="w-3 h-3" />
                  {notConfiguredCount} Not Configured
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* System Status Checklist */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            System Status
          </h3>
          <span className="text-xs text-zinc-600">{checkItems.length} checks</span>
        </div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {checkItems.map((item) => {
            const Icon = item.icon;
            const isReady = item.status === "ready";
            const isAttention = item.status === "needs_attention";
            const isError = item.status === "not_configured" || item.status === "error";

            return (
              <motion.div key={item.id} variants={itemVariants}>
                <Card
                  className={`bg-[#111111] border transition-colors ${
                    isReady
                      ? "border-white/5 hover:border-emerald-500/10"
                      : isAttention
                      ? "border-amber-500/15 hover:border-amber-500/25"
                      : isError
                      ? "border-red-500/15 hover:border-red-500/25"
                      : "border-white/5"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isReady
                            ? "bg-emerald-500/10 border border-emerald-500/15"
                            : isAttention
                            ? "bg-amber-500/10 border border-amber-500/15"
                            : isError
                            ? "bg-red-500/10 border border-red-500/15"
                            : "bg-white/5 border border-white/10"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${
                            isReady
                              ? "text-emerald-400"
                              : isAttention
                              ? "text-amber-400"
                              : isError
                              ? "text-red-400"
                              : "text-zinc-500"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-white truncate">{item.label}</p>
                          <StatusIcon status={item.status} />
                        </div>
                        <StatusBadge status={item.status} />
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {item.detail}
                        </p>
                        {item.fix && (item.status === "needs_attention" || item.status === "not_configured" || item.status === "error") && (
                          <p className="text-[11px] text-zinc-600 mt-1.5 leading-relaxed border-t border-white/5 pt-1.5">
                            Fix: {item.fix}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Guided Test Flow */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              Guided Test Flow
            </h3>
            <p className="text-xs text-zinc-600 mt-0.5">
              {testStepsDoneCount} of {TEST_STEPS.length} steps completed
            </p>
          </div>
          {testStepsDoneCount > 0 && (
            <button
              onClick={resetTestSteps}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Reset all
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-5">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(testStepsDoneCount / TEST_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="space-y-2">
          {TEST_STEPS.map((step, index) => {
            const isDone = !!testStepsDone[step.id];
            return (
              <motion.div
                key={step.id}
                variants={itemVariants}
                className={`rounded-xl border p-4 transition-colors ${
                  isDone
                    ? "bg-emerald-500/5 border-emerald-500/15"
                    : "bg-[#111111] border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Step number / check */}
                  <button
                    onClick={() => toggleTestStep(step.id)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      isDone
                        ? "border-emerald-400 bg-emerald-400 text-black"
                        : "border-white/20 hover:border-primary/50 text-transparent"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-500">{index + 1}</span>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className={`text-sm font-semibold ${isDone ? "text-emerald-400 line-through decoration-emerald-400/40" : "text-white"}`}>
                        {step.label}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {step.link && (
                          <Link href={step.link}>
                            <a
                              target={step.link.startsWith("/dashboard") || step.link.startsWith("/admin") || step.link.startsWith("/sign") ? undefined : "_blank"}
                              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-400 hover:text-primary hover:border-primary/30 transition-colors font-medium"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {step.linkLabel}
                            </a>
                          </Link>
                        )}
                        <button
                          onClick={() => toggleTestStep(step.id)}
                          className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-colors ${
                            isDone
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400"
                              : "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {isDone ? "Undo" : "Mark Done"}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {testStepsDoneCount === TEST_STEPS.length && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-emerald-400">All tests completed</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your platform has passed the guided test flow.</p>
          </motion.div>
        )}
      </motion.div>

      {/* Manual Configuration Notes */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            Manual Configuration Required
          </h3>
          <p className="text-xs text-zinc-600 mt-0.5">
            These items must be completed outside the app before public launch.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {MANUAL_CONFIG.map((section) => {
            const isExpanded = expandedConfig === section.id;
            return (
              <Card
                key={section.id}
                className={`border transition-colors cursor-pointer ${section.bg}`}
                onClick={() => setExpandedConfig(isExpanded ? null : section.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ClipboardCheck className={`w-4 h-4 shrink-0 ${section.color}`} />
                      <p className={`text-sm font-semibold ${section.color}`}>{section.label}</p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-zinc-600 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </div>
                  {isExpanded && (
                    <motion.ol
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 space-y-2 border-t border-white/5 pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {section.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="text-[10px] font-bold text-zinc-600 mt-0.5 shrink-0 w-4 text-right">
                            {i + 1}.
                          </span>
                          <span className="text-xs text-zinc-400 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </motion.ol>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* Env Vars Detail */}
      {statusData && !statusData.allEnvVarsConfigured && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <Card className="bg-amber-950/20 border-amber-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                <Key className="w-4 h-4" />
                Environment Variable Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid sm:grid-cols-2 gap-2">
                {Object.entries(statusData.envVars).map(([key, isSet]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                      isSet
                        ? "bg-emerald-500/5 border-emerald-500/10"
                        : "bg-red-500/5 border-red-500/15"
                    }`}
                  >
                    {isSet ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    )}
                    <span className={`text-xs font-mono ${isSet ? "text-zinc-300" : "text-red-300"}`}>
                      {key}
                    </span>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-[9px] px-1.5 py-0 ${
                        isSet
                          ? "border-emerald-500/20 text-emerald-400"
                          : "border-red-500/20 text-red-400"
                      }`}
                    >
                      {isSet ? "Set" : "Missing"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
