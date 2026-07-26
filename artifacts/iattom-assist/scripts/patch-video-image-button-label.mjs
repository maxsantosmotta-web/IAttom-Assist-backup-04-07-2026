import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const newLabel = "Vídeo com Imagem";

if (!source.includes(newLabel)) {
  const buttonLabelPattern = /(className="w-4 h-4" \/>\s*)(Vídeo)(\s*<)/;
  if (!buttonLabelPattern.test(source)) {
    throw new Error("Creative video button label marker was not found");
  }
  source = source.replace(buttonLabelPattern, `$1${newLabel}$3`);
}

writeFileSync(creativeUrl, source);
console.log("Creative video button label updated to Vídeo com Imagem.");
