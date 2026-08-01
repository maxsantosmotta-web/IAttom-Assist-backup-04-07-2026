import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

source = source.replace(
  /  const \[creativeType, setCreativeType\] = useState<CreativeType>\(\(\) => \{[\s\S]*?\n  \}\);/,
  '  const [creativeType, setCreativeType] = useState<CreativeType>("image");',
);

const videoButtonPattern = /\n\s*<button\n\s*onClick=\{\(\) => \{\n\s*setCreativeType\("video"\);[\s\S]*?\n\s*<Video className="w-4 h-4" \/>\n\s*Vídeo\n\s*<\/button>/;
source = source.replace(videoButtonPattern, "");

source = source
  .replace("Criar Imagem e Vídeo", "Gerar imagem")
  .replace("Gere imagens e vídeos prontos para publicação.", "Gere imagens prontas para publicação.");

if (source.includes('setCreativeType("video")')) {
  throw new Error("Legacy creative video tab is still visible");
}
if (!source.includes('useState<CreativeType>("image")')) {
  throw new Error("Creative module was not forced to image mode");
}
if (!source.includes("Gerar imagem")) {
  throw new Error("Creative image-only heading marker missing");
}

writeFileSync(fileUrl, source, "utf8");
console.log("Legacy video tab hidden from Gerar imagem while its route and implementation remain intact.");
