import fs from "node:fs";

const financePath = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);
const translationsPath = new URL("../src/lib/eventTranslations.ts", import.meta.url);

let finance = fs.readFileSync(financePath, "utf8");
let overview = fs.readFileSync(overviewPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");
let activity = fs.readFileSync(activityPath, "utf8");
let translations = fs.readFileSync(translationsPath, "utf8");

if (!finance.includes("registeredResponse")) {
  const fetchStart = finance.indexOf('        const response = await fetch(`${BASE}/api/admin/financial-summary?refresh=${Date.now()}`, {');
  const fetchEndMarker = "        if (!cancelled) setSummary(data);";
  const fetchEnd = finance.indexOf(fetchEndMarker, fetchStart);
  if (fetchStart === -1 || fetchEnd === -1) throw new Error("Finance fetch section not found");

  const replacement = `        const headers = token ? { Authorization: \`Bearer \${token}\` } : {};
        const [response, registeredResponse] = await Promise.all([
          fetch(\`${"${BASE}"}/api/admin/financial-summary?refresh=\${Date.now()}\`, { headers, credentials: "include", cache: "no-store" }),
          fetch(\`${"${BASE}"}/api/admin/registered-plan-stats?refresh=\${Date.now()}\`, { headers, credentials: "include", cache: "no-store" }),
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

  finance = finance.slice(0, fetchStart) + replacement + finance.slice(fetchEnd + fetchEndMarker.length);
}

finance = finance
  .replace('sub="usuários convertidos em pagantes"', 'sub="cadastros comerciais convertidos em pagantes"')
  .replace('subtitle="Assinaturas ativas e usuários FREE" centerLabel="Planos"', 'subtitle="Cadastros comerciais ativos por situação" centerLabel="Cadastros"');

const literalPairs = [
  ['"Product Discovery": "Descoberta de Produtos"', '"Product Discovery": "Buscar Produtos"'],
  ['"Product Discovery": "Descoberta de Produto"', '"Product Discovery": "Buscar Produtos"'],
  ['"Find Products": "Descoberta de Produtos"', '"Find Products": "Buscar Produtos"'],
  ['"Find Products": "Find Products"', '"Find Products": "Buscar Produtos"'],
  ['product_discovery: "Descoberta de Produto"', 'product_discovery: "Buscar Produtos"'],
  ['find_products: "Descoberta de Produto"', 'find_products: "Buscar Produtos"'],
  ['"Product Validation": "Validação de Produtos"', '"Product Validation": "Validar Produto"'],
  ['"Validate Products": "Validação de Produtos"', '"Validate Products": "Validar Produto"'],
  ['product_validation: "Validação de Produto"', 'product_validation: "Validar Produto"'],
  ['Campaign: "Campanha"', 'Campaign: "Criar Campanha"'],
  ['campaign: "Campanha"', 'campaign: "Criar Campanha"'],
  ['Content: "Conteúdo"', 'Content: "Criar Conteúdo"'],
  ['content: "Conteúdo"', 'content: "Criar Conteúdo"'],
  ['Creative: "Criativos"', 'Creative: "Gerar Imagem"'],
  ['Creative: "Criar Imagem e Vídeo"', 'Creative: "Gerar Imagem"'],
  ['creative: "Criativo"', 'creative: "Gerar Imagem"'],
  ['creative: "Criar Imagem e Vídeo"', 'creative: "Gerar Imagem"'],
  ['"Video Effect": "Criar Imagem e Vídeo"', '"Video Effect": "Vídeo com Efeito"'],
  ['video_effect: "Criar Imagem e Vídeo"', 'video_effect: "Vídeo com Efeito"'],
  ['"Video Script": "Roteiro de Vídeo"', '"Video Script": "Scripts de Vídeo"'],
  ['video_script: "Script de Vídeo"', 'video_script: "Scripts de Vídeo"'],
  ['return "Descobertas Executadas"', 'return "Buscas de produtos executadas"'],
  ['return "Validações Executadas"', 'return "Validações de produtos executadas"'],
  ['return "Criativos Gerados"', 'return "Imagens geradas"'],
  ['return "Imagens e vídeos criados"', 'return "Imagens geradas"'],
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
  translations = translations.replaceAll(from, to);
}

function addFormattedVideoEffect(source) {
  if (source.includes('"Video Effect": "Vídeo com Efeito"')) return source;
  if (source.includes('"Video Script": "Scripts de Vídeo",')) {
    return source.replace('"Video Script": "Scripts de Vídeo",', '"Video Script": "Scripts de Vídeo",\n  "Video Effect": "Vídeo com Efeito",');
  }
  return source;
}

overview = addFormattedVideoEffect(overview);
analytics = addFormattedVideoEffect(analytics);

function addSharedVideoEffect(source) {
  if (source.includes('video_effect: "Vídeo com Efeito"')) return source;
  if (source.includes('video_script: "Scripts de Vídeo",')) {
    return source.replace('video_script: "Scripts de Vídeo",', 'video_script: "Scripts de Vídeo",\n  video_effect: "Vídeo com Efeito",');
  }
  return source;
}

translations = addSharedVideoEffect(translations);

function splitActionRules(source) {
  source = source.replace(
    'if (/creative.*gen|gen.*creative|criativo|imagem.*gerad|vídeo.*gerad/i.test(base)) return "Imagens geradas";',
    'if (/video.?effect|vídeo.*efeito|video.*generated|vídeo.*gerad/i.test(base)) return "Vídeos com efeito gerados";\n  if (/creative.*gen|gen.*creative|criativo|imagem.*gerad/i.test(base)) return "Imagens geradas";',
  );
  source = source.replace(
    'if (/creative|criativo/i.test(base)) return "Imagens geradas";',
    'if (/video.?effect|vídeo.*efeito/i.test(base)) return "Vídeos com efeito gerados";\n  if (/creative|criativo|imagem/i.test(base)) return "Imagens geradas";',
  );
  return source;
}

overview = splitActionRules(overview);
analytics = splitActionRules(analytics);
activity = splitActionRules(activity);

function syncOverviewActionChart(source) {
  if (source.includes("canonicalOverviewMediaCounts")) return source;

  const pattern = /  const actionDonut = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[activity\]\);/;
  if (!pattern.test(source)) throw new Error("Overview action chart block not found");

  const replacement = `  const actionDonut = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activity ?? []) {
      const label = normalizeAction(item.action);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    for (const label of [
      "Criativos Gerados",
      "Imagens geradas",
      "Gerar Imagem",
      "Imagens e vídeos criados",
      "Vídeos com efeito gerados",
      "Vídeo com Efeito",
    ]) {
      counts.delete(label);
    }

    const canonicalOverviewMediaCounts = new Map<string, number>(
      (analytics?.featureUsage ?? []).map((item) => [
        String(item.name ?? "").toLowerCase().replaceAll(" ", "_"),
        Number(item.count ?? 0),
      ]),
    );

    const imageCount = canonicalOverviewMediaCounts.get("creative");
    const videoCount = canonicalOverviewMediaCounts.get("video_effect");
    if (imageCount !== undefined) counts.set("Gerar Imagem", imageCount);
    if (videoCount !== undefined) counts.set("Vídeo com Efeito", videoCount);

    const priority = (label: string) => {
      if (label === "Gerar Imagem") return 0;
      if (label === "Vídeo com Efeito") return 1;
      return 2;
    };

    return [...counts.entries()]
      .filter(([, value]) => value > 0)
      .sort((a, b) => priority(a[0]) - priority(b[0]) || b[1] - a[1])
      .slice(0, 9)
      .map(([label, value], index) => ({ label, value, color: FEATURE_COLORS[index % FEATURE_COLORS.length] }));
  }, [activity, analytics]);`;

  return source.replace(pattern, replacement);
}

overview = syncOverviewActionChart(overview);

if (!finance.includes("registeredResponse")) throw new Error("Canonical finance merge missing");
if (!overview.includes("Gerar Imagem") || !overview.includes('"Video Effect": "Vídeo com Efeito"')) throw new Error("Overview image/video labels missing");
if (!overview.includes("canonicalOverviewMediaCounts") || !overview.includes('counts.set("Vídeo com Efeito", videoCount)')) throw new Error("Overview action chart video-effect synchronization missing");
if (!analytics.includes("Gerar Imagem") || !analytics.includes('"Video Effect": "Vídeo com Efeito"')) throw new Error("Analytics image/video labels missing");
if (!translations.includes("Gerar Imagem") || !translations.includes('video_effect: "Vídeo com Efeito"')) throw new Error("Shared activity image/video labels missing");
if ([overview, analytics, translations].some((source) => source.includes('"Find Products": "Find Products"'))) throw new Error("Untranslated Find Products mapping remains");

fs.writeFileSync(financePath, finance);
fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(analyticsPath, analytics);
fs.writeFileSync(activityPath, activity);
fs.writeFileSync(translationsPath, translations);
console.log("Admin charts keep Gerar Imagem and Vídeo com Efeito synchronized in module and action views.");

await import("./patch-admin-media-metrics-final.mjs");
await import("./patch-admin-final-label-guard.mjs");
await import("./patch-admin-video-effect-and-refresh-final.mjs");