import fs from "node:fs";

const paths = {
  translations: new URL("../src/lib/eventTranslations.ts", import.meta.url),
  activity: new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url),
  overview: new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url),
  analytics: new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url),
};

let translations = fs.readFileSync(paths.translations, "utf8");
let activity = fs.readFileSync(paths.activity, "utf8");
let overview = fs.readFileSync(paths.overview, "utf8");
let analytics = fs.readFileSync(paths.analytics, "utf8");

const modules = `export const MODULE_LABELS: Record<string, string> = {
  campaign: "Criar Campanha", Campaign: "Criar Campanha",
  content: "Criar Conteúdo", Content: "Criar Conteúdo",
  creative: "Criar Imagem e Vídeo", Creative: "Criar Imagem e Vídeo",
  video_script: "Scripts de Vídeo", "Video Script": "Scripts de Vídeo",
  product_discovery: "Buscar Produtos", find_products: "Buscar Produtos",
  "Find Products": "Buscar Produtos", "Product Discovery": "Buscar Produtos",
  product_validation: "Validar Produto", validate_products: "Validar Produto",
  "Validate Products": "Validar Produto", "Product Validation": "Validar Produto",
  prompt_creation: "Criar Prompt", prompt: "Criar Prompt", Prompt: "Criar Prompt",
  help: "IAttom Help", iattom_help: "IAttom Help", Help: "IAttom Help",
  marketing: "Marketing",
};`;
translations = translations.replace(/export const MODULE_LABELS: Record<string, string> = \{[\s\S]*?\n\};/, modules);

const exactReplacements = new Map([
  ["Criativos Gerados", "Imagens e vídeos criados"],
  ["Descobertas Executadas", "Buscas de produtos executadas"],
  ["Scripts Criados", "Scripts de vídeo criados"],
  ["Conteúdos Criados", "Conteúdos criados"],
  ["Campanhas Criadas", "Campanhas criadas"],
  ["Validações Executadas", "Validações de produtos executadas"],
  ["Prompts Criados", "Prompts criados"],
  ["Entrega criada", "Campanhas criadas"],
]);

function replaceLabels(source) {
  for (const [from, to] of exactReplacements) source = source.replaceAll(from, to);
  return source;
}

activity = replaceLabels(activity);
overview = replaceLabels(overview);
analytics = replaceLabels(analytics);

const featureNameMap = `const FEATURE_NAME_MAP: Record<string, string> = {
  "Product Discovery": "Buscar Produtos", "Find Products": "Buscar Produtos",
  product_discovery: "Buscar Produtos", find_products: "Buscar Produtos",
  "Product Validation": "Validar Produto", "Validate Products": "Validar Produto",
  product_validation: "Validar Produto", validate_products: "Validar Produto",
  Campaign: "Criar Campanha", campaign: "Criar Campanha", campaign_creation: "Criar Campanha",
  Content: "Criar Conteúdo", content: "Criar Conteúdo", content_creation: "Criar Conteúdo",
  Creative: "Criar Imagem e Vídeo", creative: "Criar Imagem e Vídeo", creative_generator: "Criar Imagem e Vídeo",
  "Video Script": "Scripts de Vídeo", video_script: "Scripts de Vídeo",
  Prompt: "Criar Prompt", prompt: "Criar Prompt", prompts: "Criar Prompt", prompt_creation: "Criar Prompt",
  Help: "IAttom Help", help: "IAttom Help", iattom_help: "IAttom Help",
  Marketing: "Marketing", marketing: "Marketing",
};`;

const featurePtMap = `const FEATURE_PT: Record<string, string> = {
  campaign_creation: "Criar Campanha", campaign: "Criar Campanha",
  creative_generator: "Criar Imagem e Vídeo", creative: "Criar Imagem e Vídeo",
  content_creation: "Criar Conteúdo", content: "Criar Conteúdo",
  video_script: "Scripts de Vídeo",
  product_discovery: "Buscar Produtos", find_products: "Buscar Produtos",
  product_validation: "Validar Produto", validate_products: "Validar Produto",
  prompt: "Criar Prompt", prompts: "Criar Prompt", prompt_creation: "Criar Prompt",
  help: "IAttom Help", iattom_help: "IAttom Help",
  marketing: "Marketing",
};`;

const featureDataBefore = `  const featureData = (analytics?.featureUsage ?? []).map((f, i) => ({
    ...f,
    name: FEATURE_NAME_MAP[f.name] ?? f.name,
    fill: FEATURE_COLORS[i % FEATURE_COLORS.length],
  }));`;

const featureDataAfter = `  const featureData = (analytics?.featureUsage ?? [])
    .filter((f) => f.name !== "prompt")
    .map((f, i) => ({
      ...f,
      name: FEATURE_NAME_MAP[f.name] ?? f.name,
      fill: FEATURE_COLORS[i % FEATURE_COLORS.length],
    }));`;

if (analytics.includes(featureDataBefore)) {
  analytics = analytics.replace(featureDataBefore, featureDataAfter);
} else if (!analytics.includes(featureDataAfter)) {
  throw new Error("Admin analytics featureData block not found; refusing to guess an anchor.");
}

analytics = analytics
  .replace(/const FEATURE_NAME_MAP: Record<string, string> = \{[\s\S]*?\n\};/, featureNameMap)
  .replace(/const FEATURE_PT: Record<string, string> = \{[\s\S]*?\n\};/, featurePtMap)
  .replace('className="grid gap-6 md:grid-cols-2"', 'className="grid gap-6 lg:grid-cols-2"')
  .replace('title="Uso por Recurso" subtitle="Distribuição de ações"', 'title="Execuções por Módulo" subtitle="Quantidade de ações por módulo"')
  .replace('title="Resumo de Uso dos Recursos" subtitle="Participação por recurso"', 'title="Resumo de Execuções por Módulo" subtitle="Participação de cada módulo"');

for (const marker of [
  '"Product Discovery": "Buscar Produtos"',
  '"Find Products": "Buscar Produtos"',
  '"Product Validation": "Validar Produto"',
  'Creative: "Criar Imagem e Vídeo"',
  'prompts: "Criar Prompt"',
  '.filter((f) => f.name !== "prompt")',
  'Help: "IAttom Help"',
  'className="grid gap-6 lg:grid-cols-2"',
  'title="Execuções por Módulo"',
  'title="Resumo de Execuções por Módulo"',
]) {
  if (!analytics.includes(marker) && !translations.includes(marker)) {
    throw new Error(`Canonical admin chart marker missing: ${marker}`);
  }
}

fs.writeFileSync(paths.translations, translations);
fs.writeFileSync(paths.activity, activity);
fs.writeFileSync(paths.overview, overview);
fs.writeFileSync(paths.analytics, analytics);
console.log("Administrative charts now use complete platform names and responsive full-width legends.");
