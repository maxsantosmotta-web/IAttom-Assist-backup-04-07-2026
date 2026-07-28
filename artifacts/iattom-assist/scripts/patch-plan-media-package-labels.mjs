import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(billingUrl, "utf8");

source = source
  .replaceAll("Criar Imagem e Vídeo", "Gerar Imagem (Opcional - consultar pacote)")
  .replaceAll("Gerador de Vídeo (Opcional - consultar pacote)", "Gerar Vídeo com Efeito (Opcional - consultar pacote)");

const required = [
  "Gerar Imagem (Opcional - consultar pacote)",
  "Gerar Vídeo com Efeito (Opcional - consultar pacote)",
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Plan media label missing: ${marker}`);
}

writeFileSync(billingUrl, source);
console.log("Plan cards now present image and effect-video generation as optional packages.");
