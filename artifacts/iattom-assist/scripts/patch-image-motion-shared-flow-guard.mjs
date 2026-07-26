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

const sharedPromptMarker = `                {/* Prompt */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{creativeType === "image" ? "O que você quer gerar?" : "Descreva o efeito em movimento desejado"}</Label>`;

const sharedPickerBlock = `                {creativeType === "video" && (
                  <ImageMotionSourcePicker
                    value={imageMotionSource}
                    onChange={setImageMotionSource}
                    disabled={isGenerating}
                    resetSignal={imageMotionResetSignal}
                  />
                )}

                {/* Prompt */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{creativeType === "image" ? "O que você quer gerar?" : "Descreva o efeito em movimento desejado"}</Label>`;

const pickerUsageCount = (source.match(/<ImageMotionSourcePicker/g) ?? []).length;
if (pickerUsageCount === 0) {
  if (!source.includes(sharedPromptMarker)) {
    throw new Error("Shared image-motion prompt marker was not found");
  }
  source = source.replace(sharedPromptMarker, sharedPickerBlock);
}

if (source.includes(activeLegacyMarker)) {
  throw new Error("Legacy avatar video form is still active");
}

if (!(source.match(/<ImageMotionSourcePicker/g) ?? []).length) {
  throw new Error("Image-motion source picker is not mounted in the shared form");
}

writeFileSync(creativeUrl, source);
console.log("Shared image-motion flow verified: legacy avatar form hidden and source picker mounted.");
