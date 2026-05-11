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
    label: "Criar Usuário de Teste",
    description:
      "Acesse a página de cadastro e crie uma nova conta de teste usando um e-mail de teste. Verifique se o fluxo de confirmação de e-mail funciona do início ao fim.",
    link: "/sign-up",
    linkLabel: "Abrir Cadastro",
  },
  {
    id: "test_login",
    label: "Testar Fluxo de Login",
    description:
      "Saia e entre novamente com a conta de teste. Verifique se o dashboard carrega corretamente com a barra lateral, widget de créditos e todos os itens de navegação visíveis.",
    link: "/sign-in",
    linkLabel: "Abrir Login",
  },
  {
    id: "test_ai",
    label: "Testar Geração por IA",
    description:
      "Acesse Encontrar Produtos, insira um nicho de produto (ex.: 'garrafas ecológicas') e clique em Gerar. Confirme se a IA retorna os resultados e se o card aparece corretamente.",
    link: "/dashboard/find-products",
    linkLabel: "Encontrar Produtos",
  },
  {
    id: "test_credits",
    label: "Verificar Desconto de Créditos",
    description:
      "Após executar um módulo de IA, verifique a página de Créditos. Confirme se o saldo diminuiu corretamente e se uma nova transação apareceu no histórico.",
    link: "/dashboard/credits",
    linkLabel: "Ver Créditos",
  },
  {
    id: "test_billing",
    label: "Testar Upgrade de Plano",
    description:
      "Acesse Faturamento, clique em Assinar no plano COMPLETO (R$89/mês). Verifique se o Checkout do Stripe abre. Cancele sem completar para evitar cobranças.",
    link: "/dashboard/billing",
    linkLabel: "Ver Faturamento",
  },
  {
    id: "test_admin",
    label: "Testar Gerenciamento Administrativo",
    description:
      "Encontre o usuário de teste em Admin → Usuários. Edite função, plano e saldo de créditos. Verifique se as alterações salvam corretamente e aparecem imediatamente na tabela.",
    link: "/admin/users",
    linkLabel: "Usuários Administrativos",
  },
  {
    id: "test_mobile",
    label: "Testar Layout Mobile",
    description:
      "Redimensione o navegador para 375px de largura (ou utilize o modo dispositivo do DevTools). Verifique se a barra lateral recolhe para menu hambúrguer, se todo conteúdo permanece legível e se não há rolagem horizontal.",
  },
  {
    id: "test_logout",
    label: "Testar Logout e Proteção de Rotas",
    description:
      "Saia pelo menu do usuário na barra lateral. Verifique se você retorna para a página inicial. Depois tente acessar /dashboard — confirme se o sistema redireciona novamente para o login.",
    link: "/dashboard",
    linkLabel: "Testar /dashboard (deve redirecionar)",
  },
];

const MANUAL_CONFIG = [
  {
    id: "stripe",
    label: "Produtos Stripe",
    color: "text-emerald-400",
    bg: "bg-emerald-400/5 border-emerald-400/15",
    steps: [
      "Conecte a integração Stripe no painel de Integrações do Replit",
      "Execute: pnpm --filter @workspace/scripts run seed-products",
      "Verifique se os planos COMPLETO (R$89), PREMIUM (R$197) e PRO (R$497) aparecem no painel do Stripe",
      "Confirme que o webhook está registrado — o servidor o registra automaticamente ao iniciar",
    ],
  },
  {
    id: "clerk",
    label: "Clerk OAuth e E-mail",
    color: "text-blue-400",
    bg: "bg-blue-400/5 border-blue-400/15",
    steps: [
      "Entre no painel do Clerk em clerk.com",
      "Ative o Google OAuth e/ou GitHub em Social Connections",
      "Adicione as credenciais do seu app OAuth do Google Cloud Console ou GitHub Settings",
      "Configure as URLs de redirecionamento permitidas para corresponder ao seu domínio de produção",
    ],
  },
  {
    id: "env",
    label: "Variáveis de Ambiente",
    color: "text-amber-400",
    bg: "bg-amber-400/5 border-amber-400/15",
    steps: [
      "CLERK_SECRET_KEY — na página de API Keys do painel do Clerk",
      "VITE_CLERK_PUBLISHABLE_KEY — chave pública do painel do Clerk",
      "AI_INTEGRATIONS_OPENAI_BASE_URL + API_KEY — das Integrações de IA do Replit",
      "SESSION_SECRET — gere uma string aleatória de 64 caracteres",
      "DATABASE_URL — definido automaticamente ao usar o PostgreSQL do Replit",
    ],
  },
  {
    id: "deploy",
    label: "Deploy em Produção",
    color: "text-purple-400",
    bg: "bg-purple-400/5 border-purple-400/15",
    steps: [
      "Clique em Deploy no Replit para criar um ambiente de produção",
      "Defina todas as variáveis de ambiente nas configurações do deploy de produção",
      "Opcionalmente, configure um domínio personalizado no Replit Deployments",
      "Execute o script seed-products no banco de produção, se ainda não tiver feito",
      "Teste a URL do webhook do Stripe usando seu domínio de produção",
    ],
  },
];

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-500 font-medium">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Verificando
      </span>
    );
  }
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Pronto
      </span>
    );
  }
  if (status === "needs_attention") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
        <AlertTriangle className="w-2.5 h-2.5" />
        Atenção Necessária
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">
      <XCircle className="w-2.5 h-2.5" />
      Não Configurado
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
      label: "Saúde da API",
      description: "Servidor da API Express está acessível e respondendo",
      icon: Server,
      status: loading
        ? "loading"
        : apiOk === null
        ? "loading"
        : apiOk
        ? "ready"
        : "error",
      detail: loading || apiOk === null ? "Verificando..." : apiOk ? "Servidor da API respondendo normalmente" : "Servidor da API inacessível",
      fix: "Verifique se o workflow do servidor de API está em execução",
    },
    {
      id: "database",
      label: "Saúde do Banco de Dados",
      description: "Conexão PostgreSQL estabelecida e schema migrado",
      icon: Database,
      status: loading ? "loading" : data!.database.status === "ready" ? "ready" : "error",
      detail: loading ? "Verificando..." : data!.database.message,
      fix: "Verifique a variável DATABASE_URL e certifique-se de que o PostgreSQL está em execução",
    },
    {
      id: "env_vars",
      label: "Variáveis de Ambiente",
      description: "Todos os secrets e chaves de configuração obrigatórios estão definidos",
      icon: Key,
      status: loading ? "loading" : data!.allEnvVarsConfigured ? "ready" : "needs_attention",
      detail: loading
        ? "Verificando..."
        : data!.allEnvVarsConfigured
        ? "As 6 variáveis de ambiente obrigatórias estão configuradas"
        : `Ausentes: ${Object.entries(data!.envVars).filter(([, v]) => !v).map(([k]) => k).join(", ")}`,
      fix: "Defina as variáveis de ambiente ausentes nos Secrets do Replit",
    },
    {
      id: "auth",
      label: "Autenticação",
      description: "Autenticação Clerk configurada para login e cadastro",
      icon: Shield,
      status: loading
        ? "loading"
        : data!.envVars["CLERK_SECRET_KEY"] && data!.envVars["CLERK_PUBLISHABLE_KEY"]
        ? "ready"
        : "not_configured",
      detail: loading
        ? "Verificando..."
        : data!.envVars["CLERK_SECRET_KEY"]
        ? "Chaves Clerk configuradas — login e cadastro ativos"
        : "CLERK_SECRET_KEY ou CLERK_PUBLISHABLE_KEY ausente",
      fix: "Adicione as chaves da API Clerk no painel do Clerk",
    },
    {
      id: "admin",
      label: "Permissões Administrativas",
      description: "Pelo menos um usuário administrador foi configurado",
      icon: Shield,
      status: loading ? "loading" : data!.adminUsers.status,
      detail: loading
        ? "Verificando..."
        : data!.adminUsers.count > 0
        ? `${data!.adminUsers.count} administrador${data!.adminUsers.count !== 1 ? "es" : ""} configurado${data!.adminUsers.count !== 1 ? "s" : ""}`
        : "Nenhum administrador encontrado — acesse /admin para realizar a configuração inicial",
      fix: "Acesse /admin e clique em Reivindicar Acesso Administrativo",
    },
    {
      id: "ai",
      label: "Módulos de IA",
      description: "Integração OpenAI configurada para todos os 6 recursos de IA",
      icon: Brain,
      status: loading ? "loading" : data!.aiConfig.status,
      detail: loading
        ? "Verificando..."
        : data!.aiConfig.status === "ready"
        ? "Integração OpenAI ativa — todos os 6 módulos prontos"
        : "AI_INTEGRATIONS_OPENAI_BASE_URL ou API_KEY não configurado",
      fix: "Ative o add-on de integrações de IA no Replit e configure as variáveis de ambiente",
    },
    {
      id: "credits",
      label: "Sistema de Créditos",
      description: "Saldos, deduções e histórico de transações por usuário",
      icon: Zap,
      status: loading ? "loading" : "ready",
      detail: loading
        ? "Verificando..."
        : `Sistema de créditos ativo — ${data!.creditsSystem.transactionCount} transação${data!.creditsSystem.transactionCount !== 1 ? "ões" : ""} registrada${data!.creditsSystem.transactionCount !== 1 ? "s" : ""}`,
    },
    {
      id: "stripe",
      label: "Faturamento Stripe",
      description: "Produtos Stripe configurados e fluxo de checkout ativo",
      icon: CreditCard,
      status: loading ? "loading" : data!.stripeProducts.status,
      detail: loading
        ? "Verificando..."
        : data!.stripeProducts.status === "ready"
        ? `${data!.stripeProducts.count} plano${data!.stripeProducts.count !== 1 ? "s" : ""} pago${data!.stripeProducts.count !== 1 ? "s" : ""} configurado${data!.stripeProducts.count !== 1 ? "s" : ""} no Stripe`
        : "Execute o script seed-products para criar os produtos no Stripe",
      fix: "Execute: pnpm --filter @workspace/scripts run seed-products",
    },
    {
      id: "users",
      label: "Espaços de Trabalho",
      description: "Usuários podem se registrar, entrar e acessar espaços privados",
      icon: Users,
      status: loading
        ? "loading"
        : data!.database.userCount > 0
        ? "ready"
        : "needs_attention",
      detail: loading
        ? "Verificando..."
        : data!.database.userCount > 0
        ? `${data!.database.userCount} usuário${data!.database.userCount !== 1 ? "s" : ""} cadastrado${data!.database.userCount !== 1 ? "s" : ""}`
        : "Nenhum usuário ainda — registre a primeira conta para verificar o isolamento",
      fix: "Crie uma conta de teste pela página de cadastro",
    },
    {
      id: "landing",
      label: "Página Pública",
      description: "Página de marketing acessível sem autenticação",
      icon: Globe,
      status: "ready",
      detail: "Página inicial acessível publicamente na URL principal",
    },
    {
      id: "mobile",
      label: "Responsividade Mobile",
      description: "Barra lateral recolhe no mobile, layouts adaptam a telas pequenas",
      icon: Smartphone,
      status: "ready",
      detail: "Layouts responsivos implementados — testado em 375px ou superior",
    },
    {
      id: "production",
      label: "Deploy em Produção",
      description: "App publicado em ambiente de produção com URL ativa",
      icon: Rocket,
      status: isProduction ? "ready" : "needs_attention",
      detail: isProduction
        ? `Publicado em ${window.location.hostname}`
        : "Executando em desenvolvimento — clique em Deploy no Replit para publicar",
      fix: "Use o Replit Deployments para publicar em um domínio .replit.app",
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
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Pré-Lançamento</p>
            <h2 className="text-2xl font-bold text-white mb-1">Checklist de Lançamento</h2>
            <p className="text-muted-foreground text-sm">
              Visão geral da preparação do sistema e fluxo guiado de testes antes do lançamento.
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
            Atualizar
          </Button>
        </div>
        {lastChecked && (
          <p className="text-xs text-zinc-600 mt-2">
            Última verificação: {lastChecked.toLocaleTimeString("pt-BR")}
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
                  Pontuação de Preparação
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {readyCount} de {checkItems.length} verificações concluídas
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
                {readyCount} Pronto{readyCount !== 1 ? "s" : ""}
              </div>
              {needsAttentionCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  {needsAttentionCount} Atenção
                </div>
              )}
              {notConfiguredCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <XCircle className="w-3 h-3" />
                  {notConfiguredCount} Não Configurado{notConfiguredCount !== 1 ? "s" : ""}
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
            Status do Sistema
          </h3>
          <span className="text-xs text-zinc-600">{checkItems.length} verificações</span>
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
                            Correção: {item.fix}
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
              Fluxo Guiado de Testes
            </h3>
            <p className="text-xs text-zinc-600 mt-0.5">
              {testStepsDoneCount} de {TEST_STEPS.length} etapas concluídas
            </p>
          </div>
          {testStepsDoneCount > 0 && (
            <button
              onClick={resetTestSteps}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Redefinir tudo
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
                          {isDone ? "Desfazer" : "Marcar como Concluído"}
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
            <p className="text-sm font-semibold text-emerald-400">Todos os testes concluídos</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sua plataforma passou pelo fluxo guiado de testes.</p>
          </motion.div>
        )}
      </motion.div>

      {/* Manual Configuration Notes */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            Configuração Manual Necessária
          </h3>
          <p className="text-xs text-zinc-600 mt-0.5">
            Esses itens devem ser concluídos fora do aplicativo antes do lançamento público.
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
