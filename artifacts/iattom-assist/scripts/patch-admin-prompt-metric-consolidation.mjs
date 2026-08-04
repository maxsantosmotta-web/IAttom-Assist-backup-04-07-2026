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

function normalizePromptLabels(source) {
  return source
    .replaceAll('prompt: "Prompts"', 'prompt: "Criar Prompt"')
    .replaceAll('prompt: "Prompt"', 'prompt: "Criar Prompt"')
    .replaceAll('prompts: "Prompts"', 'prompts: "Criar Prompt"')
    .replaceAll('Prompt: "Prompts"', 'Prompt: "Criar Prompt"')
    .replaceAll('Prompts: "Prompts"', 'Prompts: "Criar Prompt"');
}

translations = normalizePromptLabels(translations);
activity = normalizePromptLabels(activity);
overview = normalizePromptLabels(overview);
analytics = normalizePromptLabels(analytics);

// Shared module translation is the canonical place for module labels.
if (!translations.includes('prompts: "Criar Prompt"')) {
  const anchor = translations.includes('prompt: "Criar Prompt",')
    ? 'prompt: "Criar Prompt",'
    : 'marketing: "Marketing",';
  if (!translations.includes(anchor)) throw new Error("Prompt translation anchor missing");
  translations = translations.replace(anchor, `${anchor}\n  prompts: "Criar Prompt",`);
}

// Overview and Analytics receive formatted names from /api/admin/analytics.
// Add only the valid plural key; the singular legacy key is filtered out below.
function ensureFormattedPromptLabel(source) {
  if (source.includes('Prompts: "Criar Prompt"')) return source;
  const anchor = 'Marketing: "Marketing",';
  if (!source.includes(anchor)) throw new Error("Formatted feature label anchor missing");
  return source.replace(anchor, `${anchor}\n  Prompts: "Criar Prompt",`);
}

overview = ensureFormattedPromptLabel(overview);
analytics = ensureFormattedPromptLabel(analytics);

// Visão Geral: remove a série singular antiga sem somar ao registro válido.
if (!overview.includes('const featureDonut = (analytics?.featureUsage ?? [])\n    .filter((item) => item.name.toLowerCase().replaceAll(" ", "_") !== "prompt")')) {
  overview = overview.replace(
    'const featureDonut = (analytics?.featureUsage ?? []).slice(0, 8).map((item, index) => ({',
    `const featureDonut = (analytics?.featureUsage ?? [])
    .filter((item) => item.name.toLowerCase().replaceAll(" ", "_") !== "prompt")
    .slice(0, 8)
    .map((item, index) => ({`,
  );
}
overview = overview.replace(
  '.filter((item) => Number(item.count ?? 0) > 0)\n      .slice(0, 9)',
  '.filter((item) => Number(item.count ?? 0) > 0 && item.name.toLowerCase().replaceAll(" ", "_") !== "prompt")\n      .slice(0, 9)',
);

// Análises: filtra antes de montar os dois gráficos derivados de featureUsage.
if (!analytics.includes('.filter((f) => f.name.toLowerCase().replaceAll(" ", "_") !== "prompt")')) {
  analytics = analytics.replace(
    'const featureData = (analytics?.featureUsage ?? []).map((f, i) => ({',
    `const featureData = (analytics?.featureUsage ?? [])
    .filter((f) => f.name.toLowerCase().replaceAll(" ", "_") !== "prompt")
    .map((f, i) => ({`,
  );
}

// Atividade: o patch final cria canonicalActionLabelByKey e canonicalRows.
if (!activity.includes('prompts: "Criar Prompt"')) {
  const activityAnchor = 'prompt: "Criar Prompt",';
  if (!activity.includes(activityAnchor)) throw new Error("Activity prompt label anchor missing");
  activity = activity.replace(activityAnchor, `${activityAnchor}\n      prompts: "Criar Prompt",`);
}
activity = activity.replace(
  '.filter((item) => item.count > 0);',
  '.filter((item) => item.count > 0 && item.key !== "prompt");',
);

// Validate each file only for the responsibility it actually owns.
if (!translations.includes('prompts: "Criar Prompt"')) throw new Error("Canonical shared prompts translation missing");
if (!overview.includes('Prompts: "Criar Prompt"') || !overview.includes('!== "prompt"')) {
  throw new Error("Overview prompt label/filter missing");
}
if (!analytics.includes('Prompts: "Criar Prompt"') || !analytics.includes('!== "prompt"')) {
  throw new Error("Analytics prompt label/filter missing");
}
if (!activity.includes('prompts: "Criar Prompt"') || !activity.includes('item.key !== "prompt"')) {
  throw new Error("Activity prompt label/filter missing");
}

fs.writeFileSync(paths.translations, translations);
fs.writeFileSync(paths.activity, activity);
fs.writeFileSync(paths.overview, overview);
fs.writeFileSync(paths.analytics, analytics);
console.log("Admin charts exclude legacy prompt and keep prompts as Criar Prompt.");
