import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const oldBlock = `      if (item.kind === "project" && item.rawProject) {
        await permanentDelete(item.rawProject.id);
        void deleteProjectAssets(item.rawProject.id).catch(() => {});
        void loadProjects();
        toast({ description: \`"\${item.displayName}" excluído definitivamente.\` });
      } else if (item.kind === "prompt" && item.rawPrompt) {`;

const newBlock = `      if (item.kind === "project" && item.rawProject) {
        const deletedId = item.rawProject.id;
        await permanentDelete(deletedId);

        const remaining = await getTrash();
        if (remaining.some((project) => project.id === deletedId)) {
          throw new Error("O item continua registrado na Lixeira");
        }

        setProjectItems(
          remaining
            .filter((project) => project.deletedAt !== null)
            .map((project) => ({
              ...project,
              deletedAt: project.deletedAt!,
              expiresAt: project.expiresAt ?? new Date(new Date(project.deletedAt!).getTime() + 48 * 3600000).toISOString(),
            })) as TrashedItem[],
        );

        try {
          const activeRaw = localStorage.getItem("iattom_saved_items_v1");
          const active = activeRaw ? JSON.parse(activeRaw) as Array<{ id?: string }> : [];
          localStorage.setItem("iattom_saved_items_v1", JSON.stringify(active.filter((project) => project.id !== deletedId)));

          const trashRaw = localStorage.getItem("iattom_trash_items_v1");
          const trash = trashRaw ? JSON.parse(trashRaw) as Array<{ id?: string }> : [];
          localStorage.setItem("iattom_trash_items_v1", JSON.stringify(trash.filter((project) => project.id !== deletedId)));
        } catch { /* cache local indisponível */ }

        await deleteProjectAssets(deletedId).catch(() => {});
        toast({ description: \`"\${item.displayName}" excluído definitivamente.\` });
      } else if (item.kind === "prompt" && item.rawPrompt) {`;

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) throw new Error("Permanent delete project block was not found");
  source = source.replace(oldBlock, newBlock);
}

if (!source.includes('throw new Error("O item continua registrado na Lixeira")')) {
  throw new Error("Permanent delete confirmation was not applied");
}

writeFileSync(fileUrl, source);
console.log("Permanent trash deletion now verifies the database and clears local caches before confirming success.");
