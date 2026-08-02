import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/routes/prompts.ts", import.meta.url);
const source = readFileSync(fileUrl, "utf8");

for (const marker of [
  'videocomimagem: "video_script"',
  "Para VÍDEO COM IMAGEM",
  "referenceImage: z.object",
  "let finalPrompt = promptMatch[1].trim();",
  "finalPrompt.length > 1350",
  '.normalize("NFC")',
  "não dependa de redução posterior",
]) {
  if (!source.includes(marker)) {
    throw new Error(`Final prompt guard missing: ${marker}`);
  }
}

if (source.includes("const compacted = await openai.chat.completions.create")) {
  throw new Error("Final prompt guard: forbidden second AI reduction call remains");
}
if (source.includes("finalPrompt.slice(0,")) {
  throw new Error("Final prompt guard: forbidden prompt truncation remains");
}
if (source.includes("finalPrompt.length > 1500")) {
  throw new Error("Final prompt guard: generation still targets the video receiver limit instead of the 1,350 safety target");
}

writeFileSync(fileUrl, source, "utf8");
console.log("Final Criar Prompt guard confirmed: one refined compatible generation up to 1,350 characters, without reduction or truncation.");
