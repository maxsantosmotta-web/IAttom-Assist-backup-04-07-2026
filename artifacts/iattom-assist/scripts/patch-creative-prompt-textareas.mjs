import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const textareaImport = 'import { Textarea } from "@/components/ui/textarea";';
if (!source.includes(textareaImport)) {
  const inputImport = 'import { Input } from "@/components/ui/input";';
  if (!source.includes(inputImport)) {
    throw new Error("CreativeGenerator Input import not found");
  }
  source = source.replace(inputImport, `${inputImport}\n${textareaImport}`);
}

function replacePromptField({ valueName, marker, placeholder }) {
  if (source.includes(marker)) return;

  const fieldPattern = new RegExp(
    String.raw`<Input\s+[\s\S]*?value=\{${valueName}\}[\s\S]*?onChange=\{\(e\) => set${valueName[0].toUpperCase()}${valueName.slice(1)}\(e\.target\.value\)\}[\s\S]*?\/>`,
  );

  const match = source.match(fieldPattern);
  if (!match) {
    throw new Error(`Visible ${valueName} Input field not found`);
  }

  const replacement = `{/* ${marker} */}\n                  <Textarea\n                    rows={4}\n                    placeholder="${placeholder}"\n                    className="min-h-[112px] resize-y bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50 leading-relaxed"\n                    value={${valueName}}\n                    onChange={(e) => set${valueName[0].toUpperCase()}${valueName.slice(1)}(e.target.value)}\n                  />`;

  source = source.replace(fieldPattern, replacement);
}

replacePromptField({
  valueName: "prompt",
  marker: "iattom_creative_image_prompt_textarea_v2",
  placeholder: "Ex: Moto premium em rua neon noturna",
});

replacePromptField({
  valueName: "videoPrompt",
  marker: "iattom_creative_video_prompt_textarea_v2",
  placeholder: "Descreva o contexto do vídeo...",
});

const imageInstalled = source.includes("iattom_creative_image_prompt_textarea_v2") ||
  (source.includes("iattom_creative_image_prompt_textarea_v1") && source.includes("value={prompt}"));
const videoInstalled = source.includes("iattom_creative_video_prompt_textarea_v2") ||
  (source.includes("iattom_creative_video_prompt_textarea_v1") && source.includes("value={videoPrompt}"));

if (!imageInstalled || !videoInstalled || !source.includes(textareaImport)) {
  throw new Error("Visible image and video prompt textareas were not installed");
}

if (source.includes("value={prompt}") && !source.includes("rows={4}")) {
  throw new Error("Image prompt textarea rows verification failed");
}

writeFileSync(creativeUrl, source);
console.log("Visible image and video prompt fields now support multiple lines.");
