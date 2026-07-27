import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const activeLegacyMarker = `        {/* Vídeo */}
         {creativeType === "video" && (`;
const disabledLegacyMarker = `        {/* Vídeo legado desativado */}
         {false && creativeType === "video" && (`;

if (source.includes(activeLegacyMarker)) {
  source = source.replace(activeLegacyMarker, disabledLegacyMarker);
}

const currentFormatsMarker = `  const currentPlatformFormats = platform ? (PLATFORMS.find((p) => p.key === platform)?.formats ?? []) : [];`;
const currentFormatsReplacement = `  const currentPlatformFormats = creativeType === "video"
    ? [
        { key: "vertical", label: "Vertical" },
        { key: "horizontal", label: "Horizontal" },
        { key: "automatic", label: "Automático" },
      ]
    : platform
      ? (PLATFORMS.find((p) => p.key === platform)?.formats ?? [])
      : [];`;

if (source.includes(currentFormatsMarker)) {
  source = source.replace(currentFormatsMarker, currentFormatsReplacement);
} else if (!source.includes(currentFormatsReplacement)) {
  throw new Error("Current platform formats marker was not found");
}

const resetFormatsMarker = `  useEffect(() => { setSelectedFormats([]); }, [platform]);`;
const resetFormatsReplacement = `  useEffect(() => { setSelectedFormats([]); }, [platform, creativeType]);`;

if (source.includes(resetFormatsMarker)) {
  source = source.replace(resetFormatsMarker, resetFormatsReplacement);
} else if (!source.includes(resetFormatsReplacement)) {
  throw new Error("Format reset effect marker was not found");
}

const sharedPromptMarker = `                {/* Prompt */}
                 <div className="space-y-2">
                   <Label className="text-sm text-muted-foreground">{creativeType === "image" ? "O que você quer gerar?" : "Descreva o efeito em movimento desejado"}</Label>`;

const sharedPickerBlock = `                {creativeType === "video" && (
                   <ImageMotionSourcePicker
                     value={imageMotionSource}
                     onChange={setImageMotionSource}
                     onExit={() => {
                       setImageMotionSource(null);
                       setImageMotionPrompt("");
                       setImageMotionPlatform("");
                       setImageMotionFormats([]);
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

                 {/* Prompt */}
                 <div className="space-y-2">
                   <Label className="text-sm text-muted-foreground">{creativeType === "image" ? "O que você quer gerar?" : "Descreva o efeito em movimento desejado"}</Label>`;

if (!source.includes(sharedPickerBlock)) {
  if (!source.includes(sharedPromptMarker)) {
    throw new Error("Visible shared image-motion prompt marker was not found");
  }
  source = source.replace(sharedPromptMarker, sharedPickerBlock);
}

if (source.includes(activeLegacyMarker)) {
  throw new Error("Legacy avatar video form is still active");
}

const visiblePickerIndex = source.indexOf(sharedPickerBlock);
if (visiblePickerIndex < 0) {
  throw new Error("Image-motion source picker is not mounted immediately before the visible shared prompt");
}

const promptAfterPicker = source.indexOf("{/* Prompt */}", visiblePickerIndex);
if (promptAfterPicker < visiblePickerIndex) {
  throw new Error("Visible prompt was not found after the image-motion source picker");
}

if (!source.includes(`{ key: "vertical", label: "Vertical" }`) ||
    !source.includes(`{ key: "horizontal", label: "Horizontal" }`) ||
    !source.includes(`{ key: "automatic", label: "Automático" }`)) {
  throw new Error("Video format labels were not installed");
}

writeFileSync(creativeUrl, source);
console.log("Visible image-motion flow uses Vertical, Horizontal and Automático; image formats remain platform-specific.");
