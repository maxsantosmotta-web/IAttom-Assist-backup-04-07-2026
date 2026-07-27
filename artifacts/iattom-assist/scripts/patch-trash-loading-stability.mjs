import { readFileSync, writeFileSync } from "node:fs";

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let source = readFileSync(trashUrl, "utf8");

source = source.replace(
  'import { useState, useEffect } from "react";',
  'import { useState, useEffect, useRef } from "react";',
);

source = source.replace(
  '  const [actionUid, setActionUid]               = useState<string | null>(null);',
  '  const [actionUid, setActionUid]               = useState<string | null>(null);\n  const projectsRequestRef = useRef(0);\n  const projectsLoadingRef = useRef(false);',
);

const oldLoadProjects = `  const loadProjects = async () => {
    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});
    try {
      const apiItems = await getTrash();
      setProjectItems(
        apiItems
          .filter(i => i.deletedAt !== null)
          .map(i => ({
            ...i,
            deletedAt: i.deletedAt!,
            expiresAt: i.expiresAt ?? new Date(new Date(i.deletedAt!).getTime() + 48 * 3600000).toISOString(),
          })) as TrashedItem[],
      );
    } catch {
      setProjectItems([]);
    }
  };`;

const newLoadProjects = `  const loadProjects = async () => {
    if (projectsLoadingRef.current) return;
    projectsLoadingRef.current = true;
    const requestId = ++projectsRequestRef.current;

    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});

    try {
      const apiItems = await getTrash();
      if (requestId !== projectsRequestRef.current) return;
      setProjectItems(
        apiItems
          .filter(i => i.deletedAt !== null)
          .map(i => ({
            ...i,
            deletedAt: i.deletedAt!,
            expiresAt: i.expiresAt ?? new Date(new Date(i.deletedAt!).getTime() + 48 * 3600000).toISOString(),
          })) as TrashedItem[],
      );
    } catch (error) {
      if (requestId === projectsRequestRef.current) {
        toast({
          title: "Falha ao atualizar a Lixeira.",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      if (requestId === projectsRequestRef.current) projectsLoadingRef.current = false;
    }
  };`;

if (!source.includes(newLoadProjects)) {
  if (!source.includes(oldLoadProjects)) throw new Error("loadProjects marker not found");
  source = source.replace(oldLoadProjects, newLoadProjects);
}

if (!source.includes("projectsRequestRef") || !source.includes("projectsLoadingRef")) {
  throw new Error("Trash loading stability guard was not installed");
}
if (source.includes("catch {\n      setProjectItems([]);\n    }")) {
  throw new Error("Trash still clears valid project items on temporary load failure");
}

writeFileSync(trashUrl, source);
console.log("Trash loading now preserves visible items, blocks concurrent refreshes, and ignores stale responses.");
