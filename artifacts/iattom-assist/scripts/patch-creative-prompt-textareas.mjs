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

function installPromptTextarea({ valueName, setterName, marker, placeholder }) {
  const alreadyInstalled = new RegExp(
    String.raw`<Textarea\s+[\s\S]*?rows=\{4\}[\s\S]*?value=\{${valueName}\}[\s\S]*?onChange=\{\(e\) => ${setterName}\(e\.target\.value\)\}[\s\S]*?\/>`,
  );
  if (alreadyInstalled.test(source)) return;

  const visibleField = new RegExp(
    String.raw`<(?:Input|Textarea)\s+[\s\S]*?value=\{${valueName}\}[\s\S]*?onChange=\{\(e\) => ${setterName}\(e\.target\.value\)\}[\s\S]*?\/>`,
  );

  if (!visibleField.test(source)) {
    throw new Error(`Visible ${valueName} prompt field not found`);
  }

  const replacement = `{/* ${marker} */}\n                  <Textarea\n                    rows={4}\n                    placeholder="${placeholder}"\n                    className="min-h-[112px] resize-y bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50 leading-relaxed"\n                    value={${valueName}}\n                    onChange={(e) => ${setterName}(e.target.value)}\n                  />`;

  source = source.replace(visibleField, replacement);
}

installPromptTextarea({
  valueName: "prompt",
  setterName: "setPrompt",
  marker: "iattom_creative_image_prompt_textarea_v3",
  placeholder: "Ex: Moto premium em rua neon noturna",
});

installPromptTextarea({
  valueName: "videoPrompt",
  setterName: "setVideoPrompt",
  marker: "iattom_creative_video_prompt_textarea_v3",
  placeholder: "Descreva o contexto do vídeo...",
});

function verifyTextarea(valueName, setterName) {
  return new RegExp(
    String.raw`<Textarea\s+[\s\S]*?rows=\{4\}[\s\S]*?min-h-\[112px\][\s\S]*?value=\{${valueName}\}[\s\S]*?onChange=\{\(e\) => ${setterName}\(e\.target\.value\)\}[\s\S]*?\/>`,
  ).test(source);
}

if (!verifyTextarea("prompt", "setPrompt") ||
    !verifyTextarea("videoPrompt", "setVideoPrompt") ||
    !source.includes(textareaImport)) {
  throw new Error("Visible image and video prompt textareas were not verified");
}

writeFileSync(creativeUrl, source);
console.log("Visible image and video prompt fields support multiple lines.");
