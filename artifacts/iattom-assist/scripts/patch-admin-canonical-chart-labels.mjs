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
  Prompt: "Criar Prompt", prompt: "Criar Prompt", Prompts: "Criar Prompt", prompts: "Criar Prompt", prompt_creation: "Criar Prompt",
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
  prompt: "Criar Prompt", Prompts: "Criar Prompt", prompts: "Criar Prompt", prompt_creation: "Criar Prompt",
  help: "IAttom Help", iattom_help: "IAttom Help",
  marketing: "Marketing",
};`;

analytics = analytics
  .replace(/const FEATURE_NAME_MAP: Record<string, string> = \{[\s\S]*?\n\};/, featureNameMap)
  .replace(/const FEATURE_PT: Record<string, string> = \{[\s\S]*?\n\};/, featurePtMap)
  .replace('className="grid gap-6 md:grid-cols-2"', 'className="grid gap-6 lg:grid-cols-2"')
  .replace('title="Uso por Recurso" subtitle="Distribuição de ações"', 'title="Execuções por Módulo" subtitle="Quantidade de ações por módulo"')
  .replace('title="Resumo de Uso dos Recursos" subtitle="Participação por recurso"', 'title="Resumo de Execuções por Módulo" subtitle="Participação de cada módulo"');

const rawFeatureDataHeader = /const featureData\s*=\s*\(analytics\?\.featureUsage\s*\?\?\s*\[\]\)(?:\s*\.filter\([\s\S]*?\))?\s*\.map\(\(f,\s*i\)\s*=>\s*\(\{/;
const canonicalFeatureDataHeader = `const featureData = (analytics?.featureUsage ?? [])
    .filter((f) => String(f.name ?? "").trim().toLowerCase() !== "prompt")
    .map((f, i) => ({`;
analytics = analytics.replace(rawFeatureDataHeader, canonicalFeatureDataHeader);

const rawPromptFilterPattern = /const featureData\s*=\s*\(analytics\?\.featureUsage\s*\?\?\s*\[\]\)\s*\.filter\(\(f\)\s*=>\s*String\(f\.name\s*\?\?\s*""\)\.trim\(\)\.toLowerCase\(\)\s*!==\s*"prompt"\)\s*\.map\(/;
if (!rawPromptFilterPattern.test(analytics)) {
  throw new Error("Canonical admin analytics raw prompt filter was not applied.");
}

const revenueChartBlock = `      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}>
          {isLoading ? <Skeleton className="h-[330px] w-full rounded-2xl bg-white/5" /> : featureUsageDonut.length ? <DomnDonutChart data={featureUsageDonut} title="Execuções por Módulo" subtitle="Quantidade de ações por módulo" centerLabel="Ações" /> : <Card className="grid h-[330px] place-items-center border-white/5 bg-[#111111]"><p className="text-sm text-muted-foreground">Sem dados de uso ainda.</p></Card>}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          {isLoading ? <Skeleton className="h-[330px] w-full rounded-2xl bg-white/5" /> : <DomnDonutChart data={planRevenueDonut} title="Receita por Plano" subtitle="Receita recorrente mensal" centerLabel="MRR" />}
        </motion.div>
      </div>`;

const analyticsModuleBlock = `      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}>
        {isLoading ? <Skeleton className="h-[330px] w-full rounded-2xl bg-white/5" /> : featureUsageDonut.length ? <DomnDonutChart data={featureUsageDonut} title="Execuções por Módulo" subtitle="Quantidade de ações por módulo" centerLabel="Ações" /> : <Card className="grid h-[330px] place-items-center border-white/5 bg-[#111111]"><p className="text-sm text-muted-foreground">Sem dados de uso ainda.</p></Card>}
      </motion.div>`;

analytics = analytics.replace(revenueChartBlock, analyticsModuleBlock);
if (analytics.includes('title="Receita por Plano"') || !analytics.includes(analyticsModuleBlock)) {
  throw new Error("Admin analytics revenue by plan chart was not removed.");
}

const overviewFeatureNameMap = `const FEATURE_NAME_MAP: Record<string, string> = {
  "Product Discovery": "Buscar Produtos", "Find Products": "Buscar Produtos",
  product_discovery: "Buscar Produtos", find_products: "Buscar Produtos",
  "Product Validation": "Validar Produto", "Validate Products": "Validar Produto",
  product_validation: "Validar Produto", validate_products: "Validar Produto",
  Campaign: "Criar Campanha", campaign: "Criar Campanha", campaign_creation: "Criar Campanha",
  Content: "Criar Conteúdo", content: "Criar Conteúdo", content_creation: "Criar Conteúdo",
  Creative: "Criar Imagem e Vídeo", creative: "Criar Imagem e Vídeo", creative_generator: "Criar Imagem e Vídeo",
  "Video Script": "Scripts de Vídeo", video_script: "Scripts de Vídeo",
  Prompts: "Criar Prompt", prompts: "Criar Prompt", prompt_creation: "Criar Prompt",
  Help: "IAttom Help", help: "IAttom Help", iattom_help: "IAttom Help",
  Marketing: "Marketing", marketing: "Marketing",
};`;

overview = overview.replace(
  /const FEATURE_NAME_MAP: Record<string, string> = \{[\s\S]*?\n\};/,
  overviewFeatureNameMap,
);

overview = overview.replace(
  /if \(\/prompt\/i\.test\(base\)\) return "[^"]+";/,
  'if (/prompt/i.test(base)) return "Criar Prompt";',
);

const overviewFeatureDonutHeader = /const featureDonut\s*=\s*\(analytics\?\.featureUsage\s*\?\?\s*\[\]\)(?:\s*\.filter\([\s\S]*?\))?(?:\s*\.slice\(0,\s*\d+\))?\s*\.map\(/;
const canonicalOverviewFeatureDonutHeader = `const featureDonut = (analytics?.featureUsage ?? [])
    .filter((item) => String(item.name ?? "").trim().toLowerCase() !== "prompt")
    .map(`;
overview = overview.replace(overviewFeatureDonutHeader, canonicalOverviewFeatureDonutHeader);

const overviewPromptFilterPattern = /const featureDonut\s*=\s*\(analytics\?\.featureUsage\s*\?\?\s*\[\]\)\s*\.filter\(\(item\)\s*=>\s*String\(item\.name\s*\?\?\s*""\)\.trim\(\)\.toLowerCase\(\)\s*!==\s*"prompt"\)\s*\.map\(/;
if (!overviewPromptFilterPattern.test(overview)) {
  throw new Error("Canonical admin overview prompt filter was not applied.");
}
if (!overview.includes('Prompts: "Criar Prompt"') ||
    !overview.includes('prompts: "Criar Prompt"') ||
    !overview.includes('prompt_creation: "Criar Prompt"') ||
    !overview.includes('if (/prompt/i.test(base)) return "Criar Prompt";')) {
  throw new Error("Canonical admin overview prompt labels were not applied.");
}

for (const marker of [
  '"Product Discovery": "Buscar Produtos"',
  '"Find Products": "Buscar Produtos"',
  '"Product Validation": "Validar Produto"',
  'Creative: "Criar Imagem e Vídeo"',
  'Prompt: "Criar Prompt"',
  'prompt: "Criar Prompt"',
  'Prompts: "Criar Prompt"',
  'prompt_creation: "Criar Prompt"',
  'Help: "IAttom Help"',
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
console.log("Administrative charts keep canonical prompt labels and omit revenue by plan from Analytics.");
