import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

if (!source.includes('import { Textarea } from "@/components/ui/textarea";')) {
  const inputImport = 'import { Input } from "@/components/ui/input";';
  if (!source.includes(inputImport)) {
    throw new Error("Creative prompt textarea Input import marker not found");
  }
  source = source.replace(
    inputImport,
    `${inputImport}\nimport { Textarea } from "@/components/ui/textarea";`,
  );
}

const imageInput = `                  <Input
                    placeholder="Ex: Moto premium em rua neon noturna"
                    className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />`;

const imageTextarea = `                  {/* iattom_creative_image_prompt_textarea_v1 */}
                  <Textarea
                    rows={4}
                    placeholder="Ex: Moto premium em rua neon noturna"
                    className="min-h-[112px] resize-y bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50 leading-relaxed"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />`;

if (!source.includes("iattom_creative_image_prompt_textarea_v1")) {
  if (!source.includes(imageInput)) {
    throw new Error("Creative image prompt Input marker not found");
  }
  source = source.replace(imageInput, imageTextarea);
}

const videoInput = `                  <Input
                    placeholder="Descreva o contexto do vídeo..."
                    className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                  />`;

const videoTextarea = `                  {/* iattom_creative_video_prompt_textarea_v1 */}
                  <Textarea
                    rows={4}
                    placeholder="Descreva o contexto do vídeo..."
                    className="min-h-[112px] resize-y bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50 leading-relaxed"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                  />`;

if (!source.includes("iattom_creative_video_prompt_textarea_v1")) {
  if (!source.includes(videoInput)) {
    throw new Error("Creative video prompt Input marker not found");
  }
  source = source.replace(videoInput, videoTextarea);
}

if (!source.includes("iattom_creative_image_prompt_textarea_v1") ||
    !source.includes("iattom_creative_video_prompt_textarea_v1") ||
    !source.includes('import { Textarea } from "@/components/ui/textarea";')) {
  throw new Error("Creative image and video prompt textareas were not installed");
}

writeFileSync(creativeUrl, source);
console.log("Campos de prompt de Imagem e Vídeo agora preservam múltiplas linhas e permitem expansão vertical.");
