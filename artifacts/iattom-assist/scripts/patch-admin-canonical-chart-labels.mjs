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

// Keep the existing functions intact. Only replace user-visible labels and exact match rules.
const labelReplacements = [
  ["Descoberta de Produto", "Buscar Produtos"],
  ["Descobertas Executadas", "Buscas de produtos executadas"],
  ["Validação de Produto", "Validar Produto"],
  ["Validação de Produtos", "Validar Produto"],
  ["Validações Executadas", "Validações de produtos executadas"],
  ["Criativo", "Criar Imagem e Vídeo"],
  ["Criativos Gerados", "Imagens e vídeos criados"],
  ["Roteiro de Vídeo", "Scripts de Vídeo"],
  ["Script de Vídeo", "Scripts de Vídeo"],
  ["Scripts Criados", "Scripts de vídeo criados"],
  ["Scripts Gerados", "Scripts de vídeo criados"],
  ["Campanha", "Criar Campanha"],
  ["Campanhas Criadas", "Campanhas criadas"],
  ["Conteúdo", "Criar Conteúdo"],
  ["Conteúdos Criados", "Conteúdos criados"],
  ["Prompts Criados", "Prompts criados"],
  ["Help", "IAttom Help"],
];

function applyVisibleLabels(source) {
  for (const [from, to] of labelReplacements) {
    source = source.replaceAll(`\"${from}\"`, `\"${to}\"`);
  }
  return source;
}

translations = applyVisibleLabels(translations);
activity = applyVisibleLabels(activity);
overview = applyVisibleLabels(overview);
analytics = applyVisibleLabels(analytics);

// Normalize old campaign action wording without replacing the whole function.
activity = activity.replace(
  "if (/campaign.*creat|creat.*campaign|campanha.*cria/i.test(base)) return \"Campanhas criadas\";",
  "if (/campaign.*creat|creat.*campaign|campanha.*cria|entrega.*criad/i.test(base)) return \"Campanhas criadas\";",
);

// Normalize all historical product-search action variants without changing surrounding code.
for (const target of [activity, overview, analytics]) {
  void target;
}
activity = activity.replace(
  "if (/discover|descoberta/i.test(base)) return \"Buscas de produtos executadas\";",
  "if (/find.?products|product.*discover|discover|descoberta|buscar.*produto/i.test(base)) return \"Buscas de produtos executadas\";",
);
overview = overview.replace(
  "if (/discover|descoberta/i.test(base)) return \"Buscas de produtos executadas\";",
  "if (/find.?products|product.*discover|discover|descoberta|buscar.*produto/i.test(base)) return \"Buscas de produtos executadas\";",
);
analytics = analytics.replace(
  "if (/discover|descoberta/i.test(base)) return \"Buscas de produtos executadas\";",
  "if (/find.?products|product.*discover|discover|descoberta|buscar.*produto/i.test(base)) return \"Buscas de produtos executadas\";",
);

for (const marker of ["Buscar Produtos", "Validar Produto", "Criar Imagem e Vídeo", "Buscas de produtos executadas"]) {
  if (![translations, activity, overview, analytics].some((source) => source.includes(marker))) {
    throw new Error(`Canonical chart label missing: ${marker}`);
  }
}

fs.writeFileSync(paths.translations, translations);
fs.writeFileSync(paths.activity, activity);
fs.writeFileSync(paths.overview, overview);
fs.writeFileSync(paths.analytics, analytics);
console.log("Administrative activity chart labels were normalized without rewriting page functions.");