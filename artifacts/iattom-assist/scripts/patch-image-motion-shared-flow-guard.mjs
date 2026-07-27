import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const activeLegacyMarker = `        {/* Vídeo */}
        {creativeType === "video" && (`;
const disabledLegacyMarker = `        {/* Vídeo legado desativado */}
        {false && creativeType === "video" && (`;

if (source.includes(activeLegacyMarker)) source = source.replace(activeLegacyMarker, disabledLegacyMarker);

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
                      } catch {}
                    }}
                    disabled={isGenerating}
                    resetSignal={imageMotionResetSignal}
                  />
                )}

                {/* Prompt */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{creativeType === "image" ? "O que você quer gerar?" : "Descreva o efeito em movimento desejado"}</Label>`;

if (!source.includes(sharedPickerBlock)) {
  if (!source.includes(sharedPromptMarker)) throw new Error("Visible shared image-motion prompt marker was not found");
  source = source.replace(sharedPromptMarker, sharedPickerBlock);
}

if (source.includes(activeLegacyMarker)) throw new Error("Legacy avatar video form is still active");

const visiblePickerIndex = source.indexOf(sharedPickerBlock);
if (visiblePickerIndex < 0) throw new Error("Image-motion source picker is not mounted immediately before the visible shared prompt");
if (source.indexOf("{/* Prompt */}", visiblePickerIndex) < visiblePickerIndex) throw new Error("Visible prompt was not found after the image-motion source picker");

writeFileSync(creativeUrl, source);
console.log("Visible image-motion source picker mounted; legacy avatar form hidden.");
