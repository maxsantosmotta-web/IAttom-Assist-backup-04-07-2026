import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/routes/prompts.ts", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

if (!source.includes('videocomimagem: "video_script"')) {
  throw new Error("Final prompt guard: Vídeo com Imagem mapping was not applied");
}
if (!source.includes("Para VÍDEO COM IMAGEM")) {
  throw new Error("Final prompt guard: refined image-to-video intelligence layer was not applied");
}
if (!source.includes("referenceImage: z.object")) {
  throw new Error("Final prompt guard: reference image schema was not applied");
}
if (!source.includes("let finalPrompt = promptMatch[1].trim();")) {
  throw new Error("Final prompt guard: final prompt validation was not applied");
}

source = source
  .replaceAll("no máximo 1.200 caracteres", "no máximo 1.500 caracteres")
  .replaceAll("máximo de 1.200 caracteres", "máximo de 1.500 caracteres")
  .replaceAll("finalPrompt.length > 1200", "finalPrompt.length > 1500")
  .replaceAll("finalPrompt.slice(0, 1200)", "finalPrompt.slice(0, 1500)")
  .replaceAll("with a 1,200-character limit", "with a 1,500-character limit");

if (!source.includes("finalPrompt.length > 1500")) {
  throw new Error("Final prompt guard: 1,500-character runtime validation is missing");
}
if (!source.includes("finalPrompt.slice(0, 1500)")) {
  throw new Error("Final prompt guard: 1,500-character absolute guard is missing");
}
if (source.includes("finalPrompt.length > 1200") || source.includes("finalPrompt.slice(0, 1200)")) {
  throw new Error("Final prompt guard: obsolete 1,200-character runtime limit remains");
}

writeFileSync(fileUrl, source, "utf8");
console.log("Final Vídeo com Imagem guard confirmed: refined analysis and 1,500-character runtime limit.");
