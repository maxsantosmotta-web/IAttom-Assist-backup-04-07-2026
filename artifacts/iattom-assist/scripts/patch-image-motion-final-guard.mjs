import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
const pickerUrl = new URL("../src/components/creative/ImageMotionSourcePicker.tsx", import.meta.url);

let source = readFileSync(creativeUrl, "utf8");
const pickerSource = readFileSync(pickerUrl, "utf8");

const pickerImport = `import { ImageMotionSourcePicker, type ImageMotionSource } from "@/components/creative/ImageMotionSourcePicker";`;
const pickerBlock = `                {creativeType === "video" && (
                  <ImageMotionSourcePicker
                    value={imageMotionSource}
                    onChange={setImageMotionSource}
                    onExit={() => {
                      setImageMotionSource(null);
                      setImageMotionPrompt("");
                      setImageMotionPlatform("");
                      setImageMotionFormats([]);
                      setPlatform("");
                      setSelectedFormats([]);
                      setPrompt("");
                      setImageMotionResetSignal((value) => value + 1);
                      try {
                        localStorage.removeItem("iattom_image_motion_prompt_v1");
                        localStorage.removeItem("iattom_image_motion_platform_v1");
                        localStorage.removeItem("iattom_image_motion_formats_v1");
                        localStorage.removeItem("iattom_image_motion_execution_v1");
                      } catch { /* ignore */ }
                    }}
                    disabled={isGenerating}
                    resetSignal={imageMotionResetSignal}
                  />
                )}

`;

if (!source.includes(pickerImport)) {
  throw new Error("Final image-motion picker import is missing");
}

if (!source.includes("<ImageMotionSourcePicker")) {
  const promptMarker = `                {/* Prompt */}\n`;
  const promptIndex = source.indexOf(promptMarker);
  if (promptIndex < 0) {
    throw new Error("Safe prompt marker for the final image-motion picker was not found");
  }
  source = source.slice(0, promptIndex) + pickerBlock + source.slice(promptIndex);
}

const pickerStart = source.indexOf("<ImageMotionSourcePicker");
const pickerEnd = source.indexOf("/>", pickerStart);
if (pickerStart < 0 || pickerEnd < 0) {
  throw new Error("Final image-motion picker block is incomplete");
}

const mountedPicker = source.slice(pickerStart, pickerEnd + 2);
for (const marker of [
  "value={imageMotionSource}",
  "onChange={setImageMotionSource}",
  "onExit={() =>",
  "setImageMotionSource(null)",
  "setImageMotionPrompt(\"\")",
  "setImageMotionPlatform(\"\")",
  "setImageMotionFormats([])",
  "setPlatform(\"\")",
  "setSelectedFormats([])",
  "setPrompt(\"\")",
  "resetSignal={imageMotionResetSignal}",
]) {
  if (!mountedPicker.includes(marker)) {
    throw new Error(`Final image-motion picker is missing required marker: ${marker}`);
  }
}

for (const stateMarker of [
  "const [imageMotionSource, setImageMotionSource]",
  "const [imageMotionPrompt, setImageMotionPrompt]",
  "const [imageMotionPlatform, setImageMotionPlatform]",
  "const [imageMotionFormats, setImageMotionFormats]",
  "const [imageMotionResetSignal, setImageMotionResetSignal]",
]) {
  if (!source.includes(stateMarker)) {
    throw new Error(`Final image-motion state is missing: ${stateMarker}`);
  }
}

for (const formatMarker of [
  `{ key: "vertical", label: "Vertical" }`,
  `{ key: "horizontal", label: "Horizontal" }`,
  `{ key: "automatic", label: "Automático" }`,
]) {
  if (!source.includes(formatMarker)) {
    throw new Error(`Final image-motion format is missing: ${formatMarker}`);
  }
}

if (!source.includes("<ImageMotionExecution")) {
  throw new Error("Final image-motion execution panel is missing");
}

if (!/\{\/\*\s*Vídeo(?: legado desativado)?\s*\*\/\}\s*\{false\s*&&\s*creativeType\s*===\s*"video"\s*&&\s*\(/.test(source)) {
  throw new Error("Legacy avatar video form is not safely disabled in the final source");
}

for (const pickerUiMarker of [
  "Buscar na galeria",
  "Buscar na biblioteca",
  "> Trocar</,
  "> Sair</,
  ">Continuar</,
]) {
  if (!pickerSource.includes(pickerUiMarker)) {
    throw new Error(`Image-motion source picker UI is missing: ${pickerUiMarker}`);
  }
}

writeFileSync(creativeUrl, source);
console.log("Final image-motion guard preserved Galeria/Biblioteca, formats, states, execution and disabled legacy flow.");
