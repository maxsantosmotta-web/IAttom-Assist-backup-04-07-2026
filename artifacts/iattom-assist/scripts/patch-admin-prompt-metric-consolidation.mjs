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

function addPromptMappings(source) {
  source = source
    .replaceAll('prompt: "Prompts"', 'prompt: "Criar Prompt"')
    .replaceAll('prompts: "Prompts"', 'prompts: "Criar Prompt"')
    .replaceAll('Prompt: "Prompts"', 'Prompt: "Criar Prompt"')
    .replaceAll('Prompts: "Prompts"', 'Prompts: "Criar Prompt"');

  if (!source.includes('prompts: "Criar Prompt"')) {
    source = source.replace(
      'prompt: "Criar Prompt",',
      'prompt: "Criar Prompt", prompts: "Criar Prompt",',
    );
  }
  if (!source.includes('Prompts: "Criar Prompt"') && source.includes('Prompt: "Criar Prompt",')) {
    source = source.replace(
      'Prompt: "Criar Prompt",',
      'Prompt: "Criar Prompt", Prompts: "Criar Prompt",',
    );
  }
  return source;
}

translations = addPromptMappings(translations);
activity = addPromptMappings(activity);
overview = addPromptMappings(overview);
analytics = addPromptMappings(analytics);

function filterFinalSeries(source, excludedKeys) {
  const excludedList = JSON.stringify(excludedKeys);

  source = source.replaceAll(
    '.filter((item) => Number(item.count ?? 0) > 0)',
    `.filter((item) => Number(item.count ?? 0) > 0 && !${excludedList}.includes(item.name.toLowerCase().replaceAll(" ", "_")))`,
  );
  source = source.replaceAll(
    '.filter((item) => item.count > 0);',
    `.filter((item) => item.count > 0 && !${excludedList}.includes(item.key));`,
  );
  source = source.replaceAll(
    'mediaMetrics.map((item): [string, number] => [item.name.toLowerCase().replaceAll(" ", "_"), Number(item.count ?? 0)]),',
    `mediaMetrics.filter((item) => !${excludedList}.includes(item.name.toLowerCase().replaceAll(" ", "_"))).map((item): [string, number] => [item.name.toLowerCase().replaceAll(" ", "_"), Number(item.count ?? 0)]),`,
  );
  return source;
}

activity = filterFinalSeries(activity, ["prompt", "find_products"]);
overview = filterFinalSeries(overview, ["prompt", "find_products", "validate_products"]);
analytics = filterFinalSeries(analytics, ["prompt", "find_products", "validate_products"]);

if (!translations.includes('prompts: "Criar Prompt"')) {
  throw new Error("Canonical Criar Prompt translation missing");
}

const hasActivityFinalFilter =
  activity.includes('["prompt","find_products"]') &&
  (activity.includes('.includes(item.key)') || activity.includes('.includes(item.name.toLowerCase()'));
if (!hasActivityFinalFilter) {
  throw new Error("Legacy prompt/find_products final filter missing in Activity");
}

const hasAnalyticsFinalFilter =
  analytics.includes('["prompt","find_products","validate_products"]') &&
  (analytics.includes('.includes(item.key)') || analytics.includes('.includes(item.name.toLowerCase()'));
if (!hasAnalyticsFinalFilter) {
  throw new Error("Legacy prompt/product final filter missing in Analytics");
}

const hasOverviewFinalFilter =
  overview.includes('["prompt","find_products","validate_products"]') &&
  (overview.includes('.includes(item.key)') || overview.includes('.includes(item.name.toLowerCase()'));
if (!hasOverviewFinalFilter) {
  throw new Error("Legacy prompt/product final filter missing in Overview");
}

fs.writeFileSync(paths.translations, translations);
fs.writeFileSync(paths.activity, activity);
fs.writeFileSync(paths.overview, overview);
fs.writeFileSync(paths.analytics, analytics);
console.log("Admin final charts exclude legacy prompt and product series while preserving canonical modules.");
