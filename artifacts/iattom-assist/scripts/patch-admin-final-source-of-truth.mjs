import fs from "node:fs";

const financePath = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);

let finance = fs.readFileSync(financePath, "utf8");
let overview = fs.readFileSync(overviewPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");
let activity = fs.readFileSync(activityPath, "utf8");

if (!finance.includes("interface RegisteredPlanStats")) {
  finance = finance.replace(
    "interface FinancialSummary {",
    `interface RegisteredPlanStats {\n  totalUsers: number;\n  planBreakdown: {\n    admin: number;\n    unselected: number;\n    free: number;\n    pro: number;\n    business: number;\n    agency: number;\n  };\n}\n\ninterface FinancialSummary {`,
  );
}

if (!finance.includes("const [registeredPlans, setRegisteredPlans]")) {
  finance = finance.replace(
    "  const [summary, setSummary] = useState<FinancialSummary | null>(null);",
    "  const [summary, setSummary] = useState<FinancialSummary | null>(null);\n  const [registeredPlans, setRegisteredPlans] = useState<RegisteredPlanStats | null>(null);",
  );
}

if (!finance.includes("Registered plan stats failed")) {
  const anchor = "  }, [getToken, tick]);\n\n  const refresh = () => {";
  const block = `  }, [getToken, tick]);\n\n  useEffect(() => {\n    let cancelled = false;\n    (async () => {\n      try {\n        const token = await getToken();\n        const response = await fetch(\`${"${BASE}"}/api/admin/registered-plan-stats?t=\${Date.now()}\`, {\n          headers: token ? { Authorization: \`Bearer \${token}\` } : {},\n          credentials: "include",\n          cache: "no-store",\n        });\n        if (!response.ok) throw new Error(\`Registered plan stats failed: \${response.status}\`);\n        const data = await response.json() as RegisteredPlanStats;\n        if (!cancelled) setRegisteredPlans(data);\n      } catch {\n        if (!cancelled) setRegisteredPlans(null);\n      }\n    })();\n    return () => { cancelled = true; };\n  }, [getToken, tick]);\n\n  const refresh = () => {`;
  if (!finance.includes(anchor)) throw new Error("Finance registered plans effect anchor not found");
  finance = finance.replace(anchor, block);
}

const oldPlanData = /  const planData = \[[\s\S]*?\n  \];\n\n  const revenueData =/;
const newPlanData = `  const commercialTotal = registeredPlans\n    ? registeredPlans.planBreakdown.unselected + registeredPlans.planBreakdown.free + registeredPlans.planBreakdown.pro + registeredPlans.planBreakdown.business + registeredPlans.planBreakdown.agency\n    : summary?.totalUsers ?? 0;\n  const canonicalConversionRate = commercialTotal > 0\n    ? Math.round(((summary?.activeSubscribers ?? 0) / commercialTotal) * 1000) / 10\n    : 0;\n\n  const planData = [\n    { label: "SEM PLANO", value: registeredPlans?.planBreakdown.unselected ?? 0, color: ORANGE },\n    { label: "FREE", value: registeredPlans?.planBreakdown.free ?? 0, color: GOLD },\n    { label: "START", value: registeredPlans?.planBreakdown.pro ?? 0, color: EMERALD },\n    { label: "PREMIUM", value: registeredPlans?.planBreakdown.business ?? 0, color: PURPLE },\n    { label: "PRO", value: registeredPlans?.planBreakdown.agency ?? 0, color: ROSE },\n  ];\n\n  const revenueData =`;
if (!finance.includes("canonicalConversionRate")) {
  if (!oldPlanData.test(finance)) throw new Error("Finance plan data anchor not found");
  finance = finance.replace(oldPlanData, newPlanData);
}

finance = finance
  .replace(/value=\{`\$\{summary\?\.conversionRate \?\? 0\}%`\}/g, 'value={`${canonicalConversionRate}%`}')
  .replace('sub="usuários convertidos em pagantes"', 'sub="cadastros comerciais convertidos em pagantes"')
  .replace('subtitle="Assinaturas ativas e usuários FREE" centerLabel="Planos"', 'subtitle="Cadastros comerciais ativos por situação" centerLabel="Cadastros"');

const replacements = [
  ["Descoberta de Produtos", "Buscar Produtos"],
  ["Descoberta de Produto", "Buscar Produtos"],
  ["Find Products", "Buscar Produtos"],
  ["Product Discovery", "Buscar Produtos"],
  ["Validação de Produtos", "Validar Produto"],
  ["Validação de Produto", "Validar Produto"],
  ["Validate Products", "Validar Produto"],
  ["Product Validation", "Validar Produto"],
  ["Criativos Gerados", "Imagens e vídeos criados"],
  ["Criativos", "Criar Imagem e Vídeo"],
  ["Criativo", "Criar Imagem e Vídeo"],
  ["Campanhas Criadas", "Campanhas criadas"],
  ["Campanha", "Criar Campanha"],
  ["Conteúdos Criados", "Conteúdos criados"],
  ["Conteúdo", "Criar Conteúdo"],
  ["Roteiro de Vídeo", "Scripts de Vídeo"],
  ["Scripts Criados", "Scripts de vídeo criados"],
  ["Prompts Criados", "Prompts criados"],
  ["Help", "IAttom Help"],
  ["Entrega criada", "Campanhas criadas"],
  ["Validado", "Validações de produtos executadas"],
  ["Uso por Módulo", "Execuções por Módulo"],
];

for (const [from, to] of replacements) {
  overview = overview.replaceAll(from, to);
  analytics = analytics.replaceAll(from, to);
  activity = activity.replaceAll(from, to);
}

for (const marker of [
  "registered-plan-stats?t=",
  "canonicalConversionRate",
  'centerLabel="Cadastros"',
  "Buscar Produtos",
  "Validar Produto",
  "Criar Imagem e Vídeo",
]) {
  if (!finance.includes(marker) && !overview.includes(marker) && !analytics.includes(marker) && !activity.includes(marker)) {
    throw new Error(`Final admin source-of-truth marker missing: ${marker}`);
  }
}

fs.writeFileSync(financePath, finance);
fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(analyticsPath, analytics);
fs.writeFileSync(activityPath, activity);
console.log("Admin charts now use canonical registration counts and platform menu labels.");
