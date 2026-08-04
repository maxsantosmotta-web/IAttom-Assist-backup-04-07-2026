import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);

let overview = fs.readFileSync(overviewPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");
let activity = fs.readFileSync(activityPath, "utf8");

// Visão Geral não pode cortar o módulo de vídeo por estar fora dos oito primeiros.
overview = overview.replace(
  "const featureDonut = (analytics?.featureUsage ?? []).slice(0, 8).map((item, index) => ({",
  "const featureDonut = (analytics?.featureUsage ?? []).map((item, index) => ({",
);

// Visão Geral -> Execuções por Módulo: remove somente as séries legadas de produto.
overview = overview.replace(
  "const featureDonut = (analytics?.featureUsage ?? []).map((item, index) => ({",
  "const featureDonut = (analytics?.featureUsage ?? []).filter((item) => ![\"prompt\", \"find_products\", \"validate_products\"].includes(item.name.toLowerCase().replaceAll(\" \", \"_\"))).map((item, index) => ({",
);

// Atividade -> último gráfico: remove somente Buscar Produtos legado.
activity = activity.replace(
  "const actionChart = canonicalRows.slice(0, 10).map(({ key, count }, index) => ({",
  "const actionChart = canonicalRows.filter(({ key }) => key !== \"find_products\").slice(0, 10).map(({ key, count }, index) => ({",
);

// Guarda final pelo resultado visual: preserva os blocos canônicos e oculta apenas os legados de valor 1.
overview = overview.replace(
  'data={featureDonut} title="Execuções por Módulo"',
  'data={featureDonut.filter(({ label, value }) => !(Number(value) === 1 && ["Buscar Produtos", "Validar Produto"].includes(String(label))))} title="Execuções por Módulo"',
);
activity = activity.replace(
  'data={actionChart} title="Atividade por Tipo de Ação"',
  'data={actionChart.filter(({ label, value }) => { const normalizedLabel = String(label).trim().toLowerCase(); return !(Number(value) === 1 && (normalizedLabel === "buscar produtos" || normalizedLabel === "buscas de produtos executadas")); })} title="Atividade por Tipo de Ação"',
);

// Os três botões Atualizar executam a mesma ação de atualizar o navegador.
overview = overview.replace('onClick={refresh}', 'onClick={() => window.location.reload()}');
analytics = analytics.replace(
  'onClick={() => { void refetchAnalytics(); setGrowthTick((t) => t + 1); }}',
  'onClick={() => window.location.reload()}',
);
activity = activity.replace(
  'onClick={() => void refetch()}',
  'onClick={() => window.location.reload()}',
);

for (const [name, source] of [
  ["overview", overview],
  ["analytics", analytics],
  ["activity", activity],
]) {
  if (!source.includes("window.location.reload()")) {
    throw new Error(`${name} hard refresh button missing`);
  }
}
if (overview.includes("featureUsage ?? []).slice(0, 8)")) {
  throw new Error("Overview still truncates module metrics before Vídeo com Efeito");
}
if (!overview.includes('"Video Effect": "Vídeo com Efeito"')) {
  throw new Error("Overview video-effect label missing");
}
if (!analytics.includes('"Video Effect": "Vídeo com Efeito"')) {
  throw new Error("Analytics video-effect label missing");
}
if (!activity.includes('video_effect')) {
  throw new Error("Activity video-effect metric key missing");
}

fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(analyticsPath, analytics);
fs.writeFileSync(activityPath, activity);
console.log("Vídeo com Efeito remains visible; only value-one legacy product blocks are hidden from final Overview and Activity chart renders; admin refresh buttons reload their pages.");
