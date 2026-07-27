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

const visiblePromptLabel = `Descreva o efeito em movimento desejado`;
const visiblePromptIndex = source.indexOf(visiblePromptLabel);
if (visiblePromptIndex < 0) {
  throw new Error("Visible image-motion prompt was not found");
}

const visibleFormStart = source.lastIndexOf(`<CardContent className="p-6 space-y-6">`, visiblePromptIndex);
const visibleFormEnd = source.indexOf(`</CardContent>`, visiblePromptIndex);
if (visibleFormStart < 0 || visibleFormEnd < 0) {
  throw new Error("Visible image-motion form boundaries were not found");
}

let visibleForm = source.slice(visibleFormStart, visibleFormEnd);
if (!visibleForm.includes("<ImageMotionSourcePicker")) {
  const promptMarker = `                {/* Prompt */}`;
  const promptMarkerIndex = source.lastIndexOf(promptMarker, visiblePromptIndex);
  if (promptMarkerIndex < visibleFormStart) {
    throw new Error("Safe prompt marker inside the visible image-motion form was not found");
  }
  source = source.slice(0, promptMarkerIndex) + pickerBlock + source.slice(promptMarkerIndex);
}

const verifiedPromptIndex = source.indexOf(visiblePromptLabel);
const verifiedFormStart = source.lastIndexOf(`<CardContent className="p-6 space-y-6">`, verifiedPromptIndex);
const verifiedFormEnd = source.indexOf(`</CardContent>`, verifiedPromptIndex);
visibleForm = source.slice(verifiedFormStart, verifiedFormEnd);

const pickerStartInForm = visibleForm.indexOf("<ImageMotionSourcePicker");
const pickerEndInForm = visibleForm.indexOf("/>", pickerStartInForm);
if (pickerStartInForm < 0 || pickerEndInForm < 0) {
  throw new Error("Image-motion picker is not mounted inside the visible form");
}

const mountedPicker = visibleForm.slice(pickerStartInForm, pickerEndInForm + 2);
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
    throw new Error(`Visible image-motion picker is missing required marker: ${marker}`);
  }
}

if (pickerStartInForm > visibleForm.indexOf(visiblePromptLabel)) {
  throw new Error("Image-motion picker must appear before the visible prompt");
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
  if (!visibleForm.includes(formatMarker) && !source.includes(formatMarker)) {
    throw new Error(`Final image-motion format is missing: ${formatMarker}`);
  }
}

if (!visibleForm.includes("<ImageMotionExecution") && !source.includes("<ImageMotionExecution")) {
  throw new Error("Final image-motion execution panel is missing");
}

if (!/\{\/\*\s*Vídeo(?: legado desativado)?\s*\*\/\}\s*\{false\s*&&\s*creativeType\s*===\s*"video"\s*&&\s*\(/.test(source)) {
  throw new Error("Legacy avatar video form is not safely disabled in the final source");
}

for (const pickerUiMarker of [
  "Buscar na galeria",
  "Buscar na biblioteca",
  "Trocar",
  "Sair",
  "Continuar",
]) {
  if (!pickerSource.includes(pickerUiMarker)) {
    throw new Error(`Image-motion source picker UI is missing: ${pickerUiMarker}`);
  }
}

writeFileSync(creativeUrl, source);
console.log("Final image-motion guard confirmed Galeria/Biblioteca inside the visible form before the prompt.");
