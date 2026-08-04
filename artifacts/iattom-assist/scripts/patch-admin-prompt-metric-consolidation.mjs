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
  source = source.replaceAll('prompt: "Prompts"', 'prompt: "Criar Prompt"');
  source = source.replaceAll('Prompt: "Criar Prompt", prompt: "Criar Prompt", prompt_creation: "Criar Prompt",', 'Prompt: "Criar Prompt", Prompts: "Criar Prompt", prompt: "Criar Prompt", prompts: "Criar Prompt", prompt_creation: "Criar Prompt",');
  source = source.replaceAll('prompt: "Criar Prompt", prompt_creation: "Criar Prompt",', 'prompt: "Criar Prompt", prompts: "Criar Prompt", prompt_creation: "Criar Prompt",');
  source = source.replaceAll('prompt_creation: "Criar Prompt", prompt: "Criar Prompt", Prompt: "Criar Prompt",', 'prompt_creation: "Criar Prompt", prompt: "Criar Prompt", prompts: "Criar Prompt", Prompt: "Criar Prompt", Prompts: "Criar Prompt",');
  source = source.replaceAll('prompt: "Prompts",', 'prompt: "Criar Prompt",\n      prompts: "Criar Prompt",');
  return source;
}

translations = addPromptMappings(translations);
activity = addPromptMappings(activity);
overview = addPromptMappings(overview);
analytics = addPromptMappings(analytics);

if (!translations.includes('prompts: "Criar Prompt"')) {
  translations = translations.replace(
    'prompt: "Criar Prompt",',
    'prompt: "Criar Prompt", prompts: "Criar Prompt",',
  );
}

if (!activity.includes('prompts: "Criar Prompt"')) {
  activity = activity.replace(
    'prompt: "Criar Prompt",',
    'prompt: "Criar Prompt",\n      prompts: "Criar Prompt",',
  );
}

for (const [name, source] of Object.entries({ translations, activity, overview, analytics })) {
  if (!source.includes("Criar Prompt")) throw new Error(`Criar Prompt label missing in ${name}`);
}

fs.writeFileSync(paths.translations, translations);
fs.writeFileSync(paths.activity, activity);
fs.writeFileSync(paths.overview, overview);
fs.writeFileSync(paths.analytics, analytics);
console.log("Admin prompt metrics now use the single canonical label Criar Prompt.");
