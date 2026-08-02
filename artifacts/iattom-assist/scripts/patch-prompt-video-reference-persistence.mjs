import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const pickerImport = 'import { PromptImageReferencePicker, type PromptImageReference } from "@/components/prompts/PromptImageReferencePicker";';
const storageImport = 'import { deleteProjectAssets, loadProjectAssets, saveProjectAssets } from "@/lib/assetStorage";';
if (!source.includes(storageImport)) {
  if (!source.includes(pickerImport)) throw new Error("Prompt reference picker import not found");
  source = source.replace(pickerImport, `${pickerImport}\n${storageImport}`);
}

const draftKeyMarker = 'const PROMPT_DRAFT_KEY = "iattom_create_prompt_draft_v1";';
const referenceKey = 'const PROMPT_REFERENCE_DRAFT_ID = "iattom_create_prompt_reference_v1";';
if (!source.includes(referenceKey)) {
  if (!source.includes(draftKeyMarker)) throw new Error("Prompt draft key not found");
  source = source.replace(draftKeyMarker, `${draftKeyMarker}\n${referenceKey}`);
}

const restoreOld = `  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROMPT_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as {
          tipo?: string;
          subject?: string;
          title?: string;
          prompt?: string;
          generated?: boolean;
        };
        setGuidedTipo(typeof draft.tipo === "string" ? draft.tipo : "");
        setGuidedSubject(typeof draft.subject === "string" ? draft.subject : "");
        setNewTitle(typeof draft.title === "string" ? draft.title : "");
        setNewPrompt(typeof draft.prompt === "string" ? draft.prompt : "");
        setGenerated(Boolean(draft.generated && draft.title && draft.prompt));
      }
    } catch {
      localStorage.removeItem(PROMPT_DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
  }, []);`;

const restoreNew = `  useEffect(() => {
    let cancelled = false;

    const restoreDraft = async () => {
      try {
        const raw = localStorage.getItem(PROMPT_DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw) as {
            tipo?: string;
            subject?: string;
            title?: string;
            prompt?: string;
            generated?: boolean;
            referenceName?: string;
            referenceOrigin?: "gallery" | "library";
            referenceMimeType?: "image/png" | "image/jpeg";
          };
          if (cancelled) return;
          setGuidedTipo(typeof draft.tipo === "string" ? draft.tipo : "");
          setGuidedSubject(typeof draft.subject === "string" ? draft.subject : "");
          setNewTitle(typeof draft.title === "string" ? draft.title : "");
          setNewPrompt(typeof draft.prompt === "string" ? draft.prompt : "");
          setGenerated(Boolean(draft.generated && draft.title && draft.prompt));

          if (draft.tipo === "Vídeo com Imagem") {
            const assets = await loadProjectAssets(PROMPT_REFERENCE_DRAFT_ID).catch(() => []);
            const asset = assets[0];
            if (!cancelled && asset?.base64) {
              setReferenceImage({
                base64: asset.base64,
                mimeType: draft.referenceMimeType === "image/jpeg" ? "image/jpeg" : "image/png",
                name: typeof draft.referenceName === "string" ? draft.referenceName : asset.label,
                origin: draft.referenceOrigin === "library" ? "library" : "gallery",
              });
            }
          }
        }
      } catch {
        localStorage.removeItem(PROMPT_DRAFT_KEY);
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    };

    void restoreDraft();
    return () => { cancelled = true; };
  }, []);`;

if (!source.includes("const restoreDraft = async () =>")) {
  if (!source.includes(restoreOld)) throw new Error("Prompt draft restore block not found");
  source = source.replace(restoreOld, restoreNew);
}

const persistOld = `    localStorage.setItem(PROMPT_DRAFT_KEY, JSON.stringify({
      tipo: guidedTipo,
      subject: guidedSubject,
      title: newTitle,
      prompt: newPrompt,
      generated,
      updatedAt: new Date().toISOString(),
    }));
  }, [draftReady, guidedTipo, guidedSubject, newTitle, newPrompt, generated]);`;

const persistNew = `    localStorage.setItem(PROMPT_DRAFT_KEY, JSON.stringify({
      tipo: guidedTipo,
      subject: guidedSubject,
      title: newTitle,
      prompt: newPrompt,
      generated,
      referenceName: referenceImage?.name,
      referenceOrigin: referenceImage?.origin,
      referenceMimeType: referenceImage?.mimeType,
      updatedAt: new Date().toISOString(),
    }));
  }, [draftReady, guidedTipo, guidedSubject, newTitle, newPrompt, generated, referenceImage]);

  useEffect(() => {
    if (!draftReady) return;
    if (!referenceImage) {
      void deleteProjectAssets(PROMPT_REFERENCE_DRAFT_ID).catch(() => {});
      return;
    }
    void saveProjectAssets(PROMPT_REFERENCE_DRAFT_ID, [{
      conceptIndex: 0,
      base64: referenceImage.base64,
      label: referenceImage.name,
      format: referenceImage.mimeType,
    }]).catch(() => {});
  }, [draftReady, referenceImage]);`;

if (!source.includes("referenceName: referenceImage?.name")) {
  if (!source.includes(persistOld)) throw new Error("Prompt draft persistence block not found");
  source = source.replace(persistOld, persistNew);
}

const clearMarker = '    localStorage.removeItem(PROMPT_DRAFT_KEY);\n    setGuidedTipo("");';
const clearReplacement = '    localStorage.removeItem(PROMPT_DRAFT_KEY);\n    void deleteProjectAssets(PROMPT_REFERENCE_DRAFT_ID).catch(() => {});\n    setGuidedTipo("");';
if (!source.includes("deleteProjectAssets(PROMPT_REFERENCE_DRAFT_ID)")) {
  if (!source.includes(clearMarker)) throw new Error("Prompt clear draft marker not found");
  source = source.replace(clearMarker, clearReplacement);
}

for (const marker of [
  storageImport,
  referenceKey,
  "const restoreDraft = async () =>",
  "loadProjectAssets(PROMPT_REFERENCE_DRAFT_ID)",
  "referenceName: referenceImage?.name",
  "saveProjectAssets(PROMPT_REFERENCE_DRAFT_ID",
  "deleteProjectAssets(PROMPT_REFERENCE_DRAFT_ID)",
]) {
  if (!source.includes(marker)) throw new Error(`Prompt video reference persistence marker missing: ${marker}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Vídeo com Imagem now preserves its selected reference image together with the Criar Prompt draft.");
