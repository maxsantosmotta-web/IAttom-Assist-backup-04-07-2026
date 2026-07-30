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
  prompt_creation: "Criar Prompt", prompt: "Criar Prompt",
  help: "IAttom Help", iattom_help: "IAttom Help", Help: "IAttom Help",
  marketing: "Marketing",
};`;
translations = translations.replace(/export const MODULE_LABELS: Record<string, string> = \{[\s\S]*?\n\};/, modules);

const normalize = `function normalizeAction(action: string): string {
  const base = action.split(":")[0].trim();
  if (/campaign.*creat|creat.*campaign|campanha.*cria|entrega.*criad/i.test(base)) return "Campanhas criadas";
  if (/content.*creat|creat.*content|content.*gen|gen.*content|conteúdo/i.test(base)) return "Conteúdos criados";
  if (/script.*creat|script.*gen|video.?script|roteiro/i.test(base)) return "Scripts de vídeo criados";
  if (/creative.*gen|gen.*creative|criativo|imagem.*gerad|vídeo.*gerad/i.test(base)) return "Imagens e vídeos criados";
  if (/find.?products|product.*discover|descoberta|buscar.*produto/i.test(base)) return "Buscas de produtos executadas";
  if (/validat|validação/i.test(base)) return "Validações de produtos executadas";
  if (/prompt/i.test(base)) return "Prompts criados";
  if (/iattom.*help|help/i.test(base)) return "IAttom Help utilizado";
  return base.length > 0 ? base : action;
}`;

function patchNormalize(source) {
  if (!source.includes("function normalizeAction(action: string): string")) return source;
  return source.replace(/function normalizeAction\(action: string\): string \{[\s\S]*?\n\}/, normalize);
}
activity = patchNormalize(activity);
overview = patchNormalize(overview);
analytics = patchNormalize(analytics);

const featureMap = `const FEATURE_NAME_MAP: Record<string, string> = {
  "Product Discovery": "Buscar Produtos", "Find Products": "Buscar Produtos",
  "Product Validation": "Validar Produto", "Validate Products": "Validar Produto",
  Campaign: "Criar Campanha", Content: "Criar Conteúdo",
  Creative: "Criar Imagem e Vídeo", "Video Script": "Scripts de Vídeo",
  Prompt: "Criar Prompt", Help: "IAttom Help", Marketing: "Marketing",
};`;
overview = overview.replace(/const FEATURE_NAME_MAP: Record<string, string> = \{[\s\S]*?\n\};/, featureMap);
analytics = analytics.replace(/const FEATURE_NAME_MAP: Record<string, string> = \{[\s\S]*?\n\};/, featureMap);

for (const marker of ["Buscar Produtos", "Validar Produto", "Criar Imagem e Vídeo", "Buscas de produtos executadas"]) {
  if (!translations.includes(marker) && !activity.includes(marker) && !overview.includes(marker) && !analytics.includes(marker)) {
    throw new Error(`Canonical chart label missing: ${marker}`);
  }
}

fs.writeFileSync(paths.translations, translations);
fs.writeFileSync(paths.activity, activity);
fs.writeFileSync(paths.overview, overview);
fs.writeFileSync(paths.analytics, analytics);
console.log("Administrative activity charts now use the same names as the platform menu.");
