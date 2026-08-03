import fs from "node:fs";
import path from "node:path";

const root = new URL("../src", import.meta.url);
const billingPath = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
const creditsPath = new URL("../src/lib/credits.ts", import.meta.url);
let billing = fs.readFileSync(billingPath, "utf8");
let credits = fs.readFileSync(creditsPath, "utf8");

billing = billing
  .replace(
    /const CREDIT_PACKAGES = \[[\s\S]*?\] as const;/,
    `const CREDIT_PACKAGES = [
  { id: "credits_300", credits: 100, label: "100", price: "R$ 0,50", tag: "Acessível", perUnit: "" },
  { id: "credits_700", credits: 200, label: "200", price: "R$ 0,55", tag: "Vantagem", perUnit: "" },
  { id: "credits_1500", credits: 500, label: "500", price: "R$ 0,60", tag: "Melhor Valor", perUnit: "" },
] as const;`,
  )
  .replace(/id: "creative_20", tag: "(?:CRIATIVO 20|20 IMAGENS)", (?:credits|images): 20,/g, 'id: "creative_20", tag: "10 IMAGENS", images: 10,')
  .replace(/id: "creative_35", tag: "(?:CRIATIVO 35|35 IMAGENS)", (?:credits|images): 35,/g, 'id: "creative_35", tag: "20 IMAGENS", images: 20,')
  .replace(/id: "creative_50", tag: "(?:CRIATIVO 50|50 IMAGENS)", (?:credits|images): 50,/g, 'id: "creative_50", tag: "30 IMAGENS", images: 30,')
  .replaceAll(`tag: "20 IMAGENS"`, `tag: "10 IMAGENS"`)
  .replaceAll(`tag: "35 IMAGENS"`, `tag: "20 IMAGENS"`)
  .replaceAll(`tag: "50 IMAGENS"`, `tag: "30 IMAGENS"`)
  .replace(/id: "creative_20"([^\n]*?)images: 20,/g, 'id: "creative_20"$1images: 10,')
  .replace(/id: "creative_35"([^\n]*?)images: 35,/g, 'id: "creative_35"$1images: 20,')
  .replace(/id: "creative_50"([^\n]*?)images: 50,/g, 'id: "creative_50"$1images: 30,')
  .replace(/\{pkg\.credits\}/g, "{pkg.images}")
  .replace(/<p className="text-\[10px\] text-zinc-600 mt-0\.5">créditos criativos<\/p>/g, '<p className="text-[10px] text-zinc-600 mt-0.5">imagens</p>')
  .replace("Adicione créditos criativos para continuar gerando imagens profissionais.", "Adicione imagens ao seu saldo para continuar criando materiais profissionais.")
  .replace("Crie mais imagens e amplie suas possibilidades de divulgação com materiais profissionais.", "Adicione imagens ao seu saldo e continue criando materiais profissionais.");

credits = credits.replace(
  /export const PLAN_CREDITS = \{[\s\S]*?\} as const;/,
  `export const PLAN_CREDITS = {
  free: 0,
  pro: 200,
  business: 500,
  agency: 1000,
} as const;`,
);

fs.writeFileSync(billingPath, billing);
fs.writeFileSync(creditsPath, credits);

function convertCreativeDisplays(source) {
  return source
    .replace(/Criativos:\s*\{\(balance\?\.creativeBalance \?\? 0\)\.toLocaleString\(([^)]*)\)\}\s*\/\s*\{\(balance\?\.creativePlanLimit \?\? 0\)\.toLocaleString\(([^)]*)\)\}/g,
      'Imagens: {Math.floor((balance?.creativeBalance ?? 0) / 10).toLocaleString($1)}')
    .replace(/Criativos:\s*\{balance\.creativeBalance\.toLocaleString\(([^)]*)\)\}\s*\/\s*\{balance\.creativePlanLimit\.toLocaleString\(([^)]*)\)\}/g,
      'Imagens: {Math.floor(balance.creativeBalance / 10).toLocaleString($1)}')
    .replace(/Criativos:\s*\{balance\.creativeBalance\}\s*\/\s*\{balance\.creativePlanLimit\}/g,
      'Imagens: {Math.floor(balance.creativeBalance / 10)}')
    .replaceAll("Criativos:", "Imagens:")
    .replace(/\{\(balance\?\.creativeBalance \?\? 0\)\.toLocaleString\(([^)]*)\)\}/g,
      '{Math.floor((balance?.creativeBalance ?? 0) / 10).toLocaleString($1)}')
    .replace(/\{\(balance\?\.creativePlanLimit \?\? 0\)\.toLocaleString\(([^)]*)\)\}/g,
      '{Math.floor((balance?.creativePlanLimit ?? 0) / 10).toLocaleString($1)}')
    .replace(/\{balance\.creativeBalance\.toLocaleString\(([^)]*)\)\}/g,
      '{Math.floor(balance.creativeBalance / 10).toLocaleString($1)}')
    .replace(/\{balance\.creativePlanLimit\.toLocaleString\(([^)]*)\)\}/g,
      '{Math.floor(balance.creativePlanLimit / 10).toLocaleString($1)}')
    .replaceAll("créditos criativos disponíveis", "imagens disponíveis")
    .replaceAll("créditos criativos restantes", "imagens disponíveis")
    .replaceAll("Créditos Criativos", "Imagens")
    .replaceAll("créditos criativos", "imagens");
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      let source = fs.readFileSync(full, "utf8");
      const original = source;
      source = convertCreativeDisplays(source)
        .replaceAll(
          "Seus créditos de criativo acabaram. Adquira um pacote de créditos criativos no Faturamento para continuar gerando imagens.",
          "Suas imagens disponíveis acabaram. Adquira um pacote de imagens no Faturamento para continuar gerando.",
        )
        .replaceAll(
          "Adquira um pacote de créditos criativos no Faturamento para continuar gerando imagens.",
          "Adquira um pacote de imagens no Faturamento para continuar gerando.",
        );
      if (source !== original) fs.writeFileSync(full, source);
    }
  }
}

for (const marker of [
  'credits: 100, label: "100"',
  'credits: 200, label: "200"',
  'credits: 500, label: "500"',
  'tag: "10 IMAGENS", images: 10',
  'tag: "20 IMAGENS", images: 20',
  'tag: "30 IMAGENS", images: 30',
]) {
  if (!billing.includes(marker)) throw new Error(`Billing package marker missing: ${marker}`);
}

walk(root.pathname);
console.log("Billing shows 100/200/500 credits and 10/20/30 images while temporary checkout prices remain active.");
