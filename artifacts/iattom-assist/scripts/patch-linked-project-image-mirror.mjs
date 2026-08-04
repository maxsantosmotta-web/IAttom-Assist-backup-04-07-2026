import { readFileSync, writeFileSync } from "node:fs";

const generatorUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
const projectsUrl = new URL("../src/pages/dashboard/Projects.tsx", import.meta.url);

let generator = readFileSync(generatorUrl, "utf8");
let projects = readFileSync(projectsUrl, "utf8");

const duplicateLibraryBlock = `      const platformLabel = PLATFORMS.find((p) => p.key === platform)?.label ?? String(platform || "Imagem");
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

      toast({ description: "Imagem adicionada ao projeto e salva na Biblioteca." });`;

const singleProjectBlock = `      try {
        const raw = localStorage.getItem("iattom_saved_items_v1");
        if (raw) {
          const items = JSON.parse(raw) as Array<Record<string, unknown>>;
          const patched = items.map((item) => item.id === projectId ? { ...item, hasImages: true } : item);
          localStorage.setItem("iattom_saved_items_v1", JSON.stringify(patched));
        }
      } catch { /* banco continua como fonte da verdade */ }

      toast({ description: "Imagem adicionada ao projeto." });`;

const previousMirrorBlock = `      try {
        const raw = localStorage.getItem("iattom_saved_items_v1");
        if (raw) {
          const items = JSON.parse(raw) as Array<Record<string, unknown>>;
          const patched = items.map((item) => item.id === projectId ? { ...item, hasImages: true } : item);
          localStorage.setItem("iattom_saved_items_v1", JSON.stringify(patched));
        }
      } catch { /* banco continua como fonte da verdade */ }

      toast({ description: "Imagem adicionada ao projeto e refletida na Biblioteca." });`;

if (generator.includes(duplicateLibraryBlock)) {
  generator = generator.replace(duplicateLibraryBlock, singleProjectBlock);
}
if (generator.includes(previousMirrorBlock)) {
  generator = generator.replace(previousMirrorBlock, singleProjectBlock);
}

if (generator.includes('source: "linked-project-save"') || generator.includes("const libraryId = crypto.randomUUID();")) {
  throw new Error("Existing-project image save still creates a duplicate Library record");
}
if (!generator.includes('toast({ description: "Imagem adicionada ao projeto." });')) {
  throw new Error("Single-record project image save was not installed");
}

// Um projeto com assets de imagem permanece com seu tipo e ID originais,
// mas também fica visível na aba Imagens. Não há segundo registro nem cópia física.
projects = projects.replace(
  '(tab === "creative" && item.type === "creative" && !videoEffect)',
  '(tab === "creative" && item.hasImages && !videoEffect)',
);
projects = projects.replace(
  '? savedItems.filter((item) => item.type === "creative" && !isVideoEffectItem(item)).length',
  '? savedItems.filter((item) => item.hasImages && !isVideoEffectItem(item)).length',
);

if (!projects.includes('(tab === "creative" && item.hasImages && !videoEffect)')) {
  throw new Error("Library Images filter was not aligned with persisted image assets");
}
if (!projects.includes('savedItems.filter((item) => item.hasImages && !isVideoEffectItem(item)).length')) {
  throw new Error("Library Images count was not aligned with persisted image assets");
}
if (projects.includes('(tab === "creative" && item.type === "creative" && !videoEffect)')) {
  throw new Error("Library Images still ignores images linked to non-creative projects");
}

writeFileSync(generatorUrl, generator, "utf8");
writeFileSync(projectsUrl, projects, "utf8");
console.log("Library Images now mirrors projects with persisted image assets without duplicate records or copied files.");
