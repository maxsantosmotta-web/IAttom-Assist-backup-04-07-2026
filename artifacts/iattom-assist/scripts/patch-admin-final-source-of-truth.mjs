import fs from "node:fs";

const financePath = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);

let finance = fs.readFileSync(financePath, "utf8");
let overview = fs.readFileSync(overviewPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");
let activity = fs.readFileSync(activityPath, "utf8");

if (!finance.includes("registeredResponse")) {
  const oldBlock = `        const response = await fetch(\`${"${BASE}"}/api/admin/financial-summary\`, {
          headers: token ? { Authorization: \`Bearer \${token}\` } : {},
          credentials: "include",
        });
        if (!response.ok) throw new Error(\`Financial summary failed: \${response.status}\`);
        const data = await response.json() as FinancialSummary;
        if (!cancelled) setSummary(data);`;

  const newBlock = `        const headers = token ? { Authorization: \`Bearer \${token}\` } : {};
        const [response, registeredResponse] = await Promise.all([
          fetch(\`${"${BASE}"}/api/admin/financial-summary?t=\${Date.now()}\`, { headers, credentials: "include", cache: "no-store" }),
          fetch(\`${"${BASE}"}/api/admin/registered-plan-stats?t=\${Date.now()}\`, { headers, credentials: "include", cache: "no-store" }),
        ]);
        if (!response.ok) throw new Error(\`Financial summary failed: \${response.status}\`);
        if (!registeredResponse.ok) throw new Error(\`Registered plan stats failed: \${registeredResponse.status}\`);
        const data = await response.json() as FinancialSummary;
        const registered = await registeredResponse.json() as {
          planBreakdown: { admin: number; unselected: number; free: number; pro: number; business: number; agency: number };
        };
        const commercialTotal = registered.planBreakdown.unselected + registered.planBreakdown.free + registered.planBreakdown.pro + registered.planBreakdown.business + registered.planBreakdown.agency;
        const conversionRate = commercialTotal > 0
          ? Math.round(((data.activeSubscribers ?? 0) / commercialTotal) * 1000) / 10
          : 0;
        if (!cancelled) setSummary({
          ...data,
          totalUsers: commercialTotal,
          conversionRate,
          planBreakdown: {
            unselected: registered.planBreakdown.unselected,
            free: registered.planBreakdown.free,
            pro: registered.planBreakdown.pro,
            business: registered.planBreakdown.business,
            agency: registered.planBreakdown.agency,
          },
        });`;

  if (!finance.includes(oldBlock)) throw new Error("Finance fetch block not found");
  finance = finance.replace(oldBlock, newBlock);
}

finance = finance
  .replace('sub="usuários convertidos em pagantes"', 'sub="cadastros comerciais convertidos em pagantes"')
  .replace('subtitle="Assinaturas ativas e usuários FREE" centerLabel="Planos"', 'subtitle="Cadastros comerciais ativos por situação" centerLabel="Cadastros"');

const literalPairs = [
  ['"Product Discovery": "Descoberta de Produtos"', '"Product Discovery": "Buscar Produtos"'],
  ['"Product Discovery": "Descoberta de Produto"', '"Product Discovery": "Buscar Produtos"'],
  ['"Find Products": "Descoberta de Produtos"', '"Find Products": "Buscar Produtos"'],
  ['product_discovery: "Descoberta de Produto"', 'product_discovery: "Buscar Produtos"'],
  ['"Product Validation": "Validação de Produtos"', '"Product Validation": "Validar Produto"'],
  ['"Validate Products": "Validação de Produtos"', '"Validate Products": "Validar Produto"'],
  ['product_validation: "Validação de Produto"', 'product_validation: "Validar Produto"'],
  ['Campaign: "Campanha"', 'Campaign: "Criar Campanha"'],
  ['campaign: "Campanha"', 'campaign: "Criar Campanha"'],
  ['Content: "Conteúdo"', 'Content: "Criar Conteúdo"'],
  ['content: "Conteúdo"', 'content: "Criar Conteúdo"'],
  ['Creative: "Criativos"', 'Creative: "Criar Imagem e Vídeo"'],
  ['creative: "Criativo"', 'creative: "Criar Imagem e Vídeo"'],
  ['"Video Script": "Roteiro de Vídeo"', '"Video Script": "Scripts de Vídeo"'],
  ['video_script: "Script de Vídeo"', 'video_script: "Scripts de Vídeo"'],
  ['return "Descobertas Executadas"', 'return "Buscas de produtos executadas"'],
  ['return "Validações Executadas"', 'return "Validações de produtos executadas"'],
  ['return "Criativos Gerados"', 'return "Imagens e vídeos criados"'],
  ['return "Campanhas Criadas"', 'return "Campanhas criadas"'],
  ['return "Conteúdos Criados"', 'return "Conteúdos criados"'],
  ['return "Scripts Criados"', 'return "Scripts de vídeo criados"'],
  ['return "Prompts Criados"', 'return "Prompts criados"'],
  ['"Entrega criada"', '"Campanhas criadas"'],
  ['"Validado"', '"Validações de produtos executadas"'],
  ['title="Uso por Módulo"', 'title="Execuções por Módulo"'],
];

for (const [from, to] of literalPairs) {
  overview = overview.replaceAll(from, to);
  analytics = analytics.replaceAll(from, to);
  activity = activity.replaceAll(from, to);
}

if (!finance.includes("registeredResponse")) throw new Error("Canonical finance merge missing");
if (!analytics.includes("Buscar Produtos") && !overview.includes("Buscar Produtos")) throw new Error("Canonical product label missing");

fs.writeFileSync(financePath, finance);
fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(analyticsPath, analytics);
fs.writeFileSync(activityPath, activity);
console.log("Admin finance and chart labels use canonical sources without broad rewrites.");
