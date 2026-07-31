import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const importMarker = 'import { useUserAccess } from "@/hooks/useUserAccess";';
const importBlock = `${importMarker}\nimport { PromptImageReferencePicker, type PromptImageReference } from "@/components/prompts/PromptImageReferencePicker";`;
if (!source.includes('from "@/components/prompts/PromptImageReferencePicker"')) {
  if (!source.includes(importMarker)) throw new Error("Prompt image reference import marker not found");
  source = source.replace(importMarker, importBlock);
}

const stateMarker = '  const [guidedSubject, setGuidedSubject] = useState("");';
const stateBlock = `${stateMarker}\n  const [referenceImage, setReferenceImage] = useState<PromptImageReference | null>(null);`;
if (!source.includes("const [referenceImage, setReferenceImage]")) {
  if (!source.includes(stateMarker)) throw new Error("Prompt image reference state marker not found");
  source = source.replace(stateMarker, stateBlock);
}

const clearMarker = '    setGuidedSubject("");\n    setGenerated(false);';
const clearBlock = '    setGuidedSubject("");\n    setReferenceImage(null);\n    setGenerated(false);';
if (!source.includes('setGuidedSubject("");\n    setReferenceImage(null);\n    setGenerated(false);')) {
  if (!source.includes(clearMarker)) throw new Error("Prompt clear-form marker not found");
  source = source.replace(clearMarker, clearBlock);
}

const selectMarker = `  const selectPromptType = (tipo: string) => {
    setGuidedTipo(tipo);
    setPendingTipo(tipo);
  };`;
const selectBlock = `  const selectPromptType = (tipo: string) => {
    setGuidedTipo(tipo);
    setPendingTipo(tipo);
    if (tipo !== "Vídeo com Imagem") setReferenceImage(null);
  };`;
if (!source.includes('if (tipo !== "Vídeo com Imagem") setReferenceImage(null);')) {
  if (!source.includes(selectMarker)) throw new Error("Prompt type selection marker not found");
  source = source.replace(selectMarker, selectBlock);
}

const payloadMarker = '        body: JSON.stringify({ tipo: guidedTipo, subject: guidedSubject.trim() }),';
const payloadBlock = `        body: JSON.stringify({
          tipo: guidedTipo,
          subject: guidedTipo === "Vídeo com Imagem" ? "" : guidedSubject.trim(),
          ...(guidedTipo === "Vídeo com Imagem" && referenceImage
            ? { referenceImage: { base64: referenceImage.base64, mimeType: referenceImage.mimeType } }
            : {}),
        }),`;
if (!source.includes("referenceImage: { base64: referenceImage.base64")) {
  if (!source.includes(payloadMarker)) throw new Error("Prompt generation payload marker not found");
  source = source.replace(payloadMarker, payloadBlock);
}

const canGenerateMarker = '  const canGenerate = !!guidedTipo && guidedSubject.trim().length > 0;';
const canGenerateBlock = `  const requiresReferenceImage = guidedTipo === "Vídeo com Imagem";
  const canGenerate = !!guidedTipo
    && (requiresReferenceImage ? referenceImage !== null : guidedSubject.trim().length > 0);`;
if (!source.includes("const requiresReferenceImage")) {
  if (!source.includes(canGenerateMarker)) throw new Error("Prompt canGenerate marker not found");
  source = source.replace(canGenerateMarker, canGenerateBlock);
}

const subjectBlockMarker = `          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Assunto</label>`;

if (!source.includes("<PromptImageReferencePicker")) {
  if (!source.includes(subjectBlockMarker)) throw new Error("Prompt subject block marker not found for picker");
  const pickerBlock = `          {guidedTipo === "Vídeo com Imagem" && (
            <PromptImageReferencePicker
              value={referenceImage}
              onChange={setReferenceImage}
              disabled={generating || saving}
            />
          )}

${subjectBlockMarker}`;
  source = source.replace(subjectBlockMarker, pickerBlock);
}

if (!source.includes('guidedTipo !== "Vídeo com Imagem" && (')) {
  if (!source.includes(subjectBlockMarker)) throw new Error("Prompt subject block marker not found for visibility guard");
  source = source.replace(
    subjectBlockMarker,
    `          {guidedTipo !== "Vídeo com Imagem" && (\n${subjectBlockMarker}`,
  );
}

const subjectEndMarker = `            <p className="text-[10px] text-zinc-700 px-0.5">Ex: scooter, cadeira gamer, proteção veicular, emagrecimento...</p>
          </div>

          <CreditsGate`;
const subjectEndBlock = `            <p className="text-[10px] text-zinc-700 px-0.5">Ex: scooter, cadeira gamer, proteção veicular, emagrecimento...</p>
          </div>
          )}

          <CreditsGate`;
if (!source.includes("          )}\n\n          <CreditsGate")) {
  if (!source.includes(subjectEndMarker)) throw new Error("Prompt subject block end marker not found");
  source = source.replace(subjectEndMarker, subjectEndBlock);
}

for (const marker of [
  'from "@/components/prompts/PromptImageReferencePicker"',
  "const [referenceImage, setReferenceImage]",
  'guidedTipo === "Vídeo com Imagem" && referenceImage',
  "<PromptImageReferencePicker",
  "const requiresReferenceImage",
  'guidedTipo !== "Vídeo com Imagem" && (',
  "          )}\n\n          <CreditsGate",
]) {
  if (!source.includes(marker)) throw new Error(`Prompt image reference marker missing: ${marker}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Vídeo com Imagem now hides Assunto and generates from the selected reference image only.");

await import("./patch-prompt-charge-after-success.mjs");
await import("./patch-image-motion-prompt-limit.mjs");
await import("./patch-prompt-navigation-and-chunk-recovery.mjs");
