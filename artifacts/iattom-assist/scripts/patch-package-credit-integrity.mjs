import fs from "node:fs";
import path from "node:path";

const root = new URL("../src", import.meta.url);
const billingPath = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let billing = fs.readFileSync(billingPath, "utf8");

billing = billing
  .replace(/id: "creative_20", tag: "CRIATIVO 20", images: 20,/g, 'id: "creative_20", tag: "CRIATIVO 20", credits: 20,')
  .replace(/id: "creative_35", tag: "CRIATIVO 35", images: 35,/g, 'id: "creative_35", tag: "CRIATIVO 35", credits: 35,')
  .replace(/id: "creative_50", tag: "CRIATIVO 50", images: 50,/g, 'id: "creative_50", tag: "CRIATIVO 50", credits: 50,')
  .replace(/\{pkg\.images\}/g, "{pkg.credits}")
  .replace(/<p className="text-\[10px\] text-zinc-600 mt-0\.5">imagens<\/p>/g, '<p className="text-[10px] text-zinc-600 mt-0.5">créditos criativos</p>')
  .replace("Crie mais imagens e amplie suas possibilidades de divulgação com materiais profissionais.", "Adicione créditos criativos para continuar gerando imagens profissionais.");

fs.writeFileSync(billingPath, billing);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      let source = fs.readFileSync(full, "utf8");
      const original = source;
      source = source
        .replaceAll(
          "Você está no plano mais alto. Contate o suporte para adicionar mais créditos.",
          "Seus créditos de criativo acabaram. Adquira um pacote de créditos criativos no Faturamento para continuar gerando imagens.",
        )
        .replaceAll(
          "Contate o suporte para adicionar mais créditos.",
          "Adquira um pacote de créditos criativos no Faturamento para continuar gerando imagens.",
        );
      if (source !== original) fs.writeFileSync(full, source);
    }
  }
}

walk(root.pathname);
console.log("Creative packages now display exact credit quantities and insufficient-credit guidance points to Billing.");