import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const oldTitle = `<h2 className="text-2xl font-bold text-white mb-1">Criar Imagem e Vídeo</h2>`;
const newTitle = `<h2 className="text-2xl font-bold text-white mb-1">Gere Imagem e Imagem com Efeitos em Movimento</h2>`;

const oldSubtitle = `<p className="text-muted-foreground text-sm">Gere imagens e vídeos prontos para publicação.</p>`;
const newSubtitle = `<p className="text-muted-foreground text-sm">Gere imagem e transforme com efeitos visuais em movimento.</p>`;

if (!source.includes(newTitle)) {
  if (!source.includes(oldTitle)) {
    throw new Error("Creative module title marker was not found");
  }
  source = source.replace(oldTitle, newTitle);
}

if (!source.includes(newSubtitle)) {
  if (!source.includes(oldSubtitle)) {
    throw new Error("Creative module subtitle marker was not found");
  }
  source = source.replace(oldSubtitle, newSubtitle);
}

writeFileSync(creativeUrl, source);
console.log("Creative module motion copy validated.");
