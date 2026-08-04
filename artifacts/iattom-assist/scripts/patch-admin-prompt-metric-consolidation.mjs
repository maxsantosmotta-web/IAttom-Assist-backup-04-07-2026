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

function ensureCanonicalPromptMappings(source) {
  source = source
    .replaceAll('prompt: "Prompts"', 'prompt: "Criar Prompt"')
    .replaceAll('prompt: "Prompt"', 'prompt: "Criar Prompt"')
    .replaceAll('prompts: "Prompts"', 'prompts: "Criar Prompt"')
    .replaceAll('Prompt: "Prompts"', 'Prompt: "Criar Prompt"')
    .replaceAll('Prompts: "Prompts"', 'Prompts: "Criar Prompt"');

  if (!source.includes('prompts: "Criar Prompt"')) {
    const anchors = [
      'prompt: "Criar Prompt",',
      'marketing: "Marketing",',
    ];
    const anchor = anchors.find((candidate) => source.includes(candidate));
    if (anchor) source = source.replace(anchor, `${anchor}\n  prompts: "Criar Prompt",`);
  }

  return source;
}

translations = ensureCanonicalPromptMappings(translations);
overview = ensureCanonicalPromptMappings(overview);
analytics = ensureCanonicalPromptMappings(analytics);
activity = ensureCanonicalPromptMappings(activity);

// Visão Geral: remove a série singular antiga tanto do gráfico de módulo
// quanto do gráfico de tipo de ação, sem somar seu valor à chave válida.
overview = overview.replace(
  'const featureDonut = (analytics?.featureUsage ?? []).slice(0, 8).map((item, index) => ({',
  `const featureDonut = (analytics?.featureUsage ?? [])
    .filter((item) => item.name.toLowerCase().replaceAll(" ", "_") !== "prompt")
    .slice(0, 8)
    .map((item, index) => ({`,
);
overview = overview.replace(
  '.filter((item) => Number(item.count ?? 0) > 0)\n      .slice(0, 9)',
  '.filter((item) => Number(item.count ?? 0) > 0 && item.name.toLowerCase().replaceAll(" ", "_") !== "prompt")\n      .slice(0, 9)',
);

// Análises: filtra antes de montar os dois gráficos derivados de featureUsage.
analytics = analytics.replace(
  'const featureData = (analytics?.featureUsage ?? []).map((f, i) => ({',
  `const featureData = (analytics?.featureUsage ?? [])
    .filter((f) => f.name.toLowerCase().replaceAll(" ", "_") !== "prompt")
    .map((f, i) => ({`,
);

// Atividade: o patch final monta os gráficos a partir de canonicalRows.
// Exclui apenas key === "prompt" e mantém prompts com o rótulo único.
activity = activity
  .replaceAll('prompt: "Prompts",', 'prompt: "Criar Prompt",\n      prompts: "Criar Prompt",')
  .replaceAll('prompt: "Criar Prompt",\n      prompt: "Criar Prompt",', 'prompt: "Criar Prompt",')
  .replace(
    '.filter((item) => item.count > 0);',
    '.filter((item) => item.count > 0 && item.key !== "prompt");',
  );

for (const [name, source] of Object.entries({ translations, activity, overview, analytics })) {
  if (!source.includes('prompts: "Criar Prompt"')) {
    throw new Error(`Canonical prompts mapping missing in ${name}`);
  }
}

if (!overview.includes('!== "prompt"')) throw new Error("Legacy prompt filter missing in overview");
if (!analytics.includes('!== "prompt"')) throw new Error("Legacy prompt filter missing in analytics");
if (!activity.includes('item.key !== "prompt"')) throw new Error("Legacy prompt filter missing in activity");

fs.writeFileSync(paths.translations, translations);
fs.writeFileSync(paths.activity, activity);
fs.writeFileSync(paths.overview, overview);
fs.writeFileSync(paths.analytics, analytics);
console.log("Admin charts now keep only prompts and display the single label Criar Prompt.");
