import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);
const translationsPath = new URL("../src/lib/eventTranslations.ts", import.meta.url);

let overview = fs.readFileSync(overviewPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");
let activity = fs.readFileSync(activityPath, "utf8");
let translations = fs.readFileSync(translationsPath, "utf8");

function enforceFormattedMap(source) {
  source = source
    .replaceAll('"Product Discovery": "Descoberta de Produtos"', '"Product Discovery": "Buscar Produtos"')
    .replaceAll('"Product Discovery": "Descoberta de Produto"', '"Product Discovery": "Buscar Produtos"')
    .replaceAll('Creative: "Criativos"', 'Creative: "Gerar Imagem"')
    .replaceAll('Creative: "Criar Imagem e Vídeo"', 'Creative: "Gerar Imagem"')
    .replaceAll('"Video Script": "Roteiro de Vídeo"', '"Video Script": "Scripts de Vídeo"');

  if (!source.includes('"Find Products": "Buscar Produtos"')) {
    source = source.replace(
      '"Product Discovery": "Buscar Produtos",',
      '"Product Discovery": "Buscar Produtos",\n  "Find Products": "Buscar Produtos",',
    );
  }
  if (!source.includes('"Video Effect": "Vídeo com Efeito"')) {
    source = source.replace(
      '"Video Script": "Scripts de Vídeo",',
      '"Video Script": "Scripts de Vídeo",\n  "Video Effect": "Vídeo com Efeito",',
    );
  }

  source = source
    .replaceAll(
      'if (/discover|descoberta/i.test(base))',
      'if (/find.?products|product.*discover|discover|descoberta|buscar.*produto/i.test(base))',
    )
    .replaceAll(
      'if (/creative|criativo/i.test(base)) return "Imagens geradas";',
      'if (/creative|criativo|imagem/i.test(base)) return "Gerar Imagem";',
    )
    .replaceAll('return "Criativos Gerados"', 'return "Gerar Imagem"')
    .replaceAll('return "Imagens geradas"', 'return "Gerar Imagem"');

  return source;
}

overview = enforceFormattedMap(overview);
analytics = enforceFormattedMap(analytics);

translations = translations
  .replaceAll('creative: "Criar Imagem e Vídeo"', 'creative: "Gerar Imagem"')
  .replaceAll('Creative: "Criar Imagem e Vídeo"', 'Creative: "Gerar Imagem"')
  .replaceAll('find_products: "Descoberta de Produto"', 'find_products: "Buscar Produtos"')
  .replaceAll('product_discovery: "Descoberta de Produto"', 'product_discovery: "Buscar Produtos"');

if (!translations.includes('"Find Products": "Buscar Produtos"')) {
  translations = translations.replace(
    '"Product Discovery": "Buscar Produtos",',
    '"Product Discovery": "Buscar Produtos",\n  "Find Products": "Buscar Produtos",',
  );
}
if (!translations.includes('video_effect: "Vídeo com Efeito"')) {
  translations = translations.replace(
    'video_script: "Scripts de Vídeo",',
    'video_script: "Scripts de Vídeo",\n  video_effect: "Vídeo com Efeito",',
  );
}

activity = activity.replaceAll(
  'if (/discover|descoberta/i.test(base))',
  'if (/find.?products|product.*discover|discover|descoberta|buscar.*produto/i.test(base))',
);

for (const marker of [
  '"Find Products": "Buscar Produtos"',
  'Creative: "Gerar Imagem"',
  '"Video Effect": "Vídeo com Efeito"',
  "find.?products",
]) {
  if (!overview.includes(marker)) throw new Error(`overview final label marker missing: ${marker}`);
}
for (const marker of [
  '"Find Products": "Buscar Produtos"',
  'Creative: "Gerar Imagem"',
  '"Video Effect": "Vídeo com Efeito"',
]) {
  if (!analytics.includes(marker)) throw new Error(`analytics final label marker missing: ${marker}`);
}
if (!translations.includes('video_effect: "Vídeo com Efeito"')) throw new Error("Shared video-effect label missing");
if (!translations.includes('"Find Products": "Buscar Produtos"')) throw new Error("Shared Find Products label missing");
if (!activity.includes("find.?products")) throw new Error("Activity Find Products normalization missing");

fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(analyticsPath, analytics);
fs.writeFileSync(activityPath, activity);
fs.writeFileSync(translationsPath, translations);
console.log("Final admin labels are explicit and fully translated.");
