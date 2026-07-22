import fs from "node:fs";
import path from "node:path";

const root = new URL("../src", import.meta.url);
const billingPath = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let billing = fs.readFileSync(billingPath, "utf8");

billing = billing
  .replace(/id: "creative_20", tag: "CRIATIVO 20", credits: 20,/g, 'id: "creative_20", tag: "20 IMAGENS", images: 20,')
  .replace(/id: "creative_35", tag: "CRIATIVO 35", credits: 35,/g, 'id: "creative_35", tag: "35 IMAGENS", images: 35,')
  .replace(/id: "creative_50", tag: "CRIATIVO 50", credits: 50,/g, 'id: "creative_50", tag: "50 IMAGENS", images: 50,')
  .replace(/id: "creative_20", tag: "CRIATIVO 20", images: 20,/g, 'id: "creative_20", tag: "20 IMAGENS", images: 20,')
  .replace(/id: "creative_35", tag: "CRIATIVO 35", images: 35,/g, 'id: "creative_35", tag: "35 IMAGENS", images: 35,')
  .replace(/id: "creative_50", tag: "CRIATIVO 50", images: 50,/g, 'id: "creative_50", tag: "50 IMAGENS", images: 50,')
  .replace(/\{pkg\.credits\}/g, "{pkg.images}")
  .replace(/<p className="text-\[10px\] text-zinc-600 mt-0\.5">créditos criativos<\/p>/g, '<p className="text-[10px] text-zinc-600 mt-0.5">imagens</p>')
  .replace("Adicione créditos criativos para continuar gerando imagens profissionais.", "Adicione imagens ao seu saldo para continuar criando materiais profissionais.")
  .replace("Crie mais imagens e amplie suas possibilidades de divulgação com materiais profissionais.", "Adicione imagens ao seu saldo e continue criando materiais profissionais.");

fs.writeFileSync(billingPath, billing);

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

walk(root.pathname);
console.log("Creative balances are displayed only as image units; internal 10-credit-per-image accounting remains unchanged.");