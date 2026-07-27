import { readFileSync, writeFileSync } from "node:fs";

const generatorUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
const detailUrl = new URL("../src/pages/dashboard/ProjectDetail.tsx", import.meta.url);

let generator = readFileSync(generatorUrl, "utf8");
let detail = readFileSync(detailUrl, "utf8");

generator = generator.replace(
  "const { saveItem, saveItemAssets, getItems, saveItemVideoAssets, getItemVideoAssets } = useSavedItems();",
  "const { saveItem, saveItemAssets, getItemAssets, getItems, saveItemVideoAssets, getItemVideoAssets } = useSavedItems();",
);

const oldSave = `  const doSaveToExisting = async (projectId: string) => {
    if (!activeResult || isSaving) return;
    const concepts = activeResult.concepts;
    if (!Array.isArray(concepts)) return;
    const imageAssets = concepts
      .map((c, i) => c.imageBase64
        ? { conceptIndex: i, base64: c.imageBase64, label: c.label ?? \`Imagem \${i + 1}\`, format: c.format ?? "PNG" }
        : null)
      .filter((a): a is NonNullable<typeof a> => a !== null);
    if (imageAssets.length === 0) {
      toast({ description: "Nenhuma imagem disponível para salvar." });
      setSaveDialogOpen(false);
      return;
    }
    setSaveDialogOpen(false);
    setIsSaving(true);
    try {
      await saveItemAssets(projectId, imageAssets);
      void saveProjectAssets(projectId, imageAssets);
      toast({ description: "Imagem adicionada ao projeto." });
    } catch {
      toast({ description: "Erro ao salvar no projeto. Tente novamente.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };`;

const newSave = `  const doSaveToExisting = async (projectId: string) => {
    if (!activeResult || isSaving) return;
    const concepts = activeResult.concepts;
    if (!Array.isArray(concepts)) return;
    const newAssets = concepts
      .map((c, i) => c.imageBase64
        ? { conceptIndex: i, base64: c.imageBase64, label: c.label ?? \`Imagem \${i + 1}\`, format: c.format ?? "PNG" }
        : null)
      .filter((a): a is NonNullable<typeof a> => a !== null);
    if (newAssets.length === 0) {
      toast({ description: "Nenhuma imagem disponível para salvar." });
      setSaveDialogOpen(false);
      return;
    }
    setSaveDialogOpen(false);
    setIsSaving(true);
    try {
      const existingAssets = await getItemAssets(projectId);
      const offset = existingAssets.reduce((max, asset) => Math.max(max, asset.conceptIndex), -1) + 1;
      const appendedAssets = newAssets.map((asset, index) => ({ ...asset, conceptIndex: offset + index }));
      const mergedAssets = [...existingAssets, ...appendedAssets];

      await saveItemAssets(projectId, mergedAssets);
      const confirmedProjectAssets = await getItemAssets(projectId);
      if (confirmedProjectAssets.length < mergedAssets.length) {
        throw new Error("As imagens não foram confirmadas no projeto");
      }
      await saveProjectAssets(projectId, confirmedProjectAssets);

      const platformLabel = PLATFORMS.find((p) => p.key === platform)?.label ?? String(platform || "Imagem");
      const libraryId = crypto.randomUUID();
      const libraryTitle = \`Imagem — \${prompt.trim().slice(0, 60) || platformLabel}\`;
      const libraryContent = [
        "Tipo: Imagem",
        \`Plataforma: \${platformLabel}\`,
        \`Formatos: \${selectedFormats.join(", ")}\`,
        \`Prompt: \${prompt.trim()}\`,
      ].join(" | ");
      const libraryData = JSON.stringify({
        type: "image",
        source: "linked-project-save",
        linkedProjectId: projectId,
        briefing: { platform, selectedFormats, prompt: prompt.trim() },
      });

      await saveItem({
        id: libraryId,
        title: libraryTitle,
        type: "creative",
        content: libraryContent,
        data: libraryData,
        hasImages: true,
      });
      await saveItemAssets(libraryId, newAssets);
      const confirmedLibraryAssets = await getItemAssets(libraryId);
      if (confirmedLibraryAssets.length !== newAssets.length) {
        throw new Error("A cópia da Biblioteca não foi confirmada");
      }
      await saveProjectAssets(libraryId, confirmedLibraryAssets);

      toast({ description: "Imagem adicionada ao projeto e salva na Biblioteca." });
    } catch {
      toast({ description: "Erro ao salvar no projeto. Nenhuma confirmação foi concluída.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };`;

if (!generator.includes(newSave)) {
  if (!generator.includes(oldSave)) throw new Error("Existing-project image save block was not found");
  generator = generator.replace(oldSave, newSave);
}

const oldLoad = `      // 3. Load images: IndexedDB first (local cache), then API fallback (cross-device)
      let imagesFromIdb = false;
      try {
        const idbAssets = await loadProjectAssets(id);
        if (idbAssets.length > 0) {
          setIdbImages(idbAssets.map(a => ({ label: a.label, base64: a.base64, format: a.format })));
          setImagesLoadDone(true);
          imagesFromIdb = true;
        }
      } catch { /* IndexedDB unavailable */ }

      // 4. No local images — try API assets (persisted on save device)
      if (!imagesFromIdb) {
        try {
          const apiAssets = await getItemAssets(id);
          if (apiAssets.length > 0) {
            setIdbImages(apiAssets.map(a => ({ label: a.label, base64: a.base64, format: a.format })));
            // Populate IndexedDB as cache for offline use
            void saveProjectAssets(id, apiAssets).catch(() => {});
          }
        } catch { /* API unavailable */ }

        setImagesLoadDone(true);
      }`;

const newLoad = `      // 3. Load images from API first: banco é a fonte da verdade.
      // IndexedDB serve apenas como fallback offline e nunca pode esconder imagens novas do projeto.
      try {
        const apiAssets = await getItemAssets(id);
        if (apiAssets.length > 0) {
          setIdbImages(apiAssets.map(a => ({ label: a.label, base64: a.base64, format: a.format })));
          await deleteProjectAssets(id).catch(() => {});
          await saveProjectAssets(id, apiAssets).catch(() => {});
        } else {
          const idbAssets = await loadProjectAssets(id);
          setIdbImages(idbAssets.map(a => ({ label: a.label, base64: a.base64, format: a.format })));
        }
      } catch {
        try {
          const idbAssets = await loadProjectAssets(id);
          setIdbImages(idbAssets.map(a => ({ label: a.label, base64: a.base64, format: a.format })));
        } catch { /* sem API e sem cache local */ }
      } finally {
        setImagesLoadDone(true);
      }`;

if (!detail.includes(newLoad)) {
  if (!detail.includes(oldLoad)) throw new Error("Project image loading block was not found");
  detail = detail.replace(oldLoad, newLoad);
}

if (!generator.includes("getItemAssets, getItems")) throw new Error("getItemAssets was not wired into CreativeGenerator");
if (!generator.includes("Imagem adicionada ao projeto e salva na Biblioteca.")) throw new Error("Confirmed dual save flow was not applied");
if (!detail.includes("banco é a fonte da verdade")) throw new Error("API-first project image loading was not applied");

writeFileSync(generatorUrl, generator);
writeFileSync(detailUrl, detail);
console.log("Existing-project image saves now append, verify, duplicate to Library, and project details load API-first.");
