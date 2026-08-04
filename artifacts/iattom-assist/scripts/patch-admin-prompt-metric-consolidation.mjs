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
    source = source.replace('prompt: "Criar Prompt",', 'prompt: "Criar Prompt", prompts: "Criar Prompt",');
  }
  if (!source.includes('Prompts: "Criar Prompt"') && source.includes('Prompt: "Criar Prompt",')) {
    source = source.replace('Prompt: "Criar Prompt",', 'Prompt: "Criar Prompt", Prompts: "Criar Prompt",');
  }
  return source;
}

translations = addPromptMappings(translations);
activity = addPromptMappings(activity);
overview = addPromptMappings(overview);
analytics = addPromptMappings(analytics);

const activityExcluded = '["prompt", "find_products"]';
const productExcluded = '["prompt", "find_products", "validate_products"]';

activity = activity
  .replaceAll(
    '.filter((item) => item.count > 0 && item.key !== "prompt");',
    `.filter((item) => item.count > 0 && !${activityExcluded}.includes(item.key));`,
  )
  .replaceAll(
    '.filter((item) => item.count > 0);',
    `.filter((item) => item.count > 0 && !${activityExcluded}.includes(item.key));`,
  )
  .replaceAll(
    'mediaMetrics.filter((item) => item.name.toLowerCase().replaceAll(" ", "_") !== "prompt").map',
    `mediaMetrics.filter((item) => !${activityExcluded}.includes(item.name.toLowerCase().replaceAll(" ", "_"))).map`,
  );

analytics = analytics
  .replaceAll(
    '.filter((f) => String(f.name ?? "").trim().toLowerCase() !== "prompt")',
    `.filter((f) => !${productExcluded}.includes(String(f.name ?? "").trim().toLowerCase().replaceAll(" ", "_")))`,
  )
  .replaceAll(
    '.filter((item) => Number(item.count ?? 0) > 0 && item.name.toLowerCase().replaceAll(" ", "_") !== "prompt")',
    `.filter((item) => Number(item.count ?? 0) > 0 && !${productExcluded}.includes(item.name.toLowerCase().replaceAll(" ", "_")))`,
  )
  .replaceAll(
    '.filter((item) => Number(item.count ?? 0) > 0)',
    `.filter((item) => Number(item.count ?? 0) > 0 && !${productExcluded}.includes(item.name.toLowerCase().replaceAll(" ", "_")))`,
  );

overview = overview
  .replaceAll(
    '.filter((item) => Number(item.count ?? 0) > 0 && item.name.toLowerCase().replaceAll(" ", "_") !== "prompt")',
    `.filter((item) => Number(item.count ?? 0) > 0 && !${productExcluded}.includes(item.name.toLowerCase().replaceAll(" ", "_")))`,
  )
  .replaceAll(
    '.filter((item) => Number(item.count ?? 0) > 0)',
    `.filter((item) => Number(item.count ?? 0) > 0 && !${productExcluded}.includes(item.name.toLowerCase().replaceAll(" ", "_")))`,
  );

fs.writeFileSync(paths.translations, translations);
fs.writeFileSync(paths.activity, activity);
fs.writeFileSync(paths.overview, overview);
fs.writeFileSync(paths.analytics, analytics);
console.log("Admin final chart filters written without blocking validation guards.");
