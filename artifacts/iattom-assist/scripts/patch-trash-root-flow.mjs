import { readFileSync, writeFileSync } from "node:fs";

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
const hookUrl = new URL("../src/hooks/useSavedItems.ts", import.meta.url);

let trash = readFileSync(trashUrl, "utf8");
let hook = readFileSync(hookUrl, "utf8");

trash = trash.replace(
  'import { useState, useEffect } from "react";',
  'import { useState, useEffect, useRef } from "react";',
);

if (!trash.includes("const refreshInFlightRef = useRef(false);")) {
  trash = trash.replace(
    '  const [actionUid, setActionUid]               = useState<string | null>(null);',
    '  const [actionUid, setActionUid]               = useState<string | null>(null);\n  const refreshInFlightRef = useRef(false);',
  );
}

const loadsStart = trash.indexOf("  const loadIntegrations = async () => {");
const loadsEnd = trash.indexOf("  // ── Unified list", loadsStart);
if (loadsStart === -1 || loadsEnd === -1) throw new Error("Trash load section not found");

const coordinatedLoad = `  const refreshTrash = async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setLoading(true);

    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});

    try {
      const [integrationsResult, projectsResult, promptsResult, activitiesResult] = await Promise.allSettled([
        apiFetch<TrashItemData[]>("/api/me/trash"),
        getTrash(),
        apiFetch<PromptTrashItem[]>("/api/prompts/trash"),
        apiFetch<ActivityTrashItem[]>("/api/history/trash"),
      ]);

      if (integrationsResult.status === "fulfilled") setIntegrationItems(integrationsResult.value);
      if (projectsResult.status === "fulfilled") {
        setProjectItems(
          projectsResult.value
            .filter((item) => item.deletedAt !== null)
            .map((item) => ({
              ...item,
              deletedAt: item.deletedAt!,
              expiresAt: item.expiresAt ?? new Date(new Date(item.deletedAt!).getTime() + 48 * 3600000).toISOString(),
            })) as TrashedItem[],
        );
      }
      if (promptsResult.status === "fulfilled") setPromptItems(promptsResult.value);
      if (activitiesResult.status === "fulfilled") setActivityItems(activitiesResult.value);

      const failed = [integrationsResult, projectsResult, promptsResult, activitiesResult]
        .filter((result) => result.status === "rejected");
      if (failed.length === 4) {
        const reason = failed[0]?.status === "rejected" ? failed[0].reason : null;
        toast({
          title: "Falha ao atualizar a Lixeira.",
          description: reason instanceof Error ? reason.message : "Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshTrash();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

`;
trash = trash.slice(0, loadsStart) + coordinatedLoad + trash.slice(loadsEnd);

const actionsStart = trash.indexOf("  const handleRestore = async (item: UnifiedItem) => {");
const actionsEnd = trash.indexOf("  const confirmItem =", actionsStart);
if (actionsStart === -1 || actionsEnd === -1) throw new Error("Trash action section not found");

const stableActions = `  const handleRestore = async (item: UnifiedItem) => {
    if (actionUid) return;
    setActionUid(item.uid);
    try {
      if (item.kind === "project" && item.rawProject) {
        await restoreItem(item.rawProject.id);
        setProjectItems((current) => current.filter((project) => project.id !== item.rawProject!.id));
        toast({ description: \`"\${item.displayName}" restaurado para Biblioteca.\` });
      } else if (item.kind === "prompt" && item.rawPrompt) {
        await apiFetch<{ ok: boolean }>(\`/api/prompts/\${item.rawPrompt.id}/restore\`, { method: "POST" });
        setPromptItems((current) => current.filter((prompt) => prompt.id !== item.rawPrompt!.id));
        toast({ description: \`"\${item.displayName}" restaurado para Criar Prompt.\` });
      } else if (item.kind === "activity" && item.rawActivity) {
        await apiFetch<{ ok: boolean }>(\`/api/history/\${item.rawActivity.id}/restore\`, { method: "POST" });
        setActivityItems((current) => current.filter((activity) => activity.id !== item.rawActivity!.id));
        toast({ description: "Atividade restaurada para o Histórico." });
      } else if (item.kind === "integration" && item.rawIntegration) {
        const result = await apiFetch<{ ok: boolean; platformLabel?: string }>(
          \`/api/me/trash/\${item.rawIntegration.id}/restore\`, { method: "POST" },
        );
        setIntegrationItems((current) => current.filter((integration) => integration.id !== item.rawIntegration!.id));
        toast({
          title: "Item restaurado.",
          description: \`"\${item.displayName}" voltou para \${result.platformLabel ?? item.subLabel ?? "origem"}.\`,
        });
      }
    } catch (error) {
      toast({ title: "Erro ao restaurar.", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setActionUid(null);
    }
  };

  const handlePermDelete = async (item: UnifiedItem) => {
    if (actionUid) return;
    setActionUid(item.uid);
    try {
      if (item.kind === "project" && item.rawProject) {
        const deletedId = item.rawProject.id;
        await permanentDelete(deletedId);
        setProjectItems((current) => current.filter((project) => project.id !== deletedId));
        await deleteProjectAssets(deletedId).catch(() => {});
        try {
          const activeRaw = localStorage.getItem("iattom_saved_items_v1");
          const active = activeRaw ? JSON.parse(activeRaw) as Array<{ id?: string }> : [];
          localStorage.setItem("iattom_saved_items_v1", JSON.stringify(active.filter((project) => project.id !== deletedId)));
          const trashRaw = localStorage.getItem("iattom_trash_items_v1");
          const localTrash = trashRaw ? JSON.parse(trashRaw) as Array<{ id?: string }> : [];
          localStorage.setItem("iattom_trash_items_v1", JSON.stringify(localTrash.filter((project) => project.id !== deletedId)));
        } catch { /* cache indisponível */ }
        toast({ description: \`"\${item.displayName}" excluído definitivamente.\` });
      } else if (item.kind === "prompt" && item.rawPrompt) {
        await apiFetch<{ ok: boolean }>(\`/api/prompts/\${item.rawPrompt.id}/permanent\`, { method: "DELETE" });
        setPromptItems((current) => current.filter((prompt) => prompt.id !== item.rawPrompt!.id));
        toast({ description: \`"\${item.displayName}" excluído definitivamente.\` });
      } else if (item.kind === "activity" && item.rawActivity) {
        await apiFetch<{ ok: boolean }>(\`/api/history/\${item.rawActivity.id}/permanent\`, { method: "DELETE" });
        setActivityItems((current) => current.filter((activity) => activity.id !== item.rawActivity!.id));
        toast({ description: "Atividade excluída definitivamente." });
      } else if (item.kind === "integration" && item.rawIntegration) {
        await apiFetch(\`/api/me/trash/\${item.rawIntegration.id}\`, { method: "DELETE" });
        setIntegrationItems((current) => current.filter((integration) => integration.id !== item.rawIntegration!.id));
        toast({ description: \`"\${item.displayName}" excluído definitivamente.\` });
      }
    } catch (error) {
      toast({ title: "Erro ao excluir.", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setActionUid(null);
      setConfirmUid(null);
    }
  };

`;
trash = trash.slice(0, actionsStart) + stableActions + trash.slice(actionsEnd);

trash = trash.replace(
  `              onClick={() => {
                void loadIntegrations();
                void loadProjects();
                void loadPrompts();
                void loadActivities();
              }}`,
  '              onClick={() => void refreshTrash()}',
);
trash = trash.replace('{loading ? (', '{loading && all.length === 0 ? (');

if (!trash.includes("const refreshTrash = async () =>") || trash.includes("void loadProjects()")) {
  throw new Error("Final Trash flow was not installed cleanly");
}

if (!hook.includes("let trashReadInFlight")) {
  hook = hook.replace(
    'const pendingImageTrash = new Map<string, PendingImageTrash>();',
    'const pendingImageTrash = new Map<string, PendingImageTrash>();\nlet trashReadInFlight: Promise<SavedItemRecord[]> | null = null;',
  );
}

const oldGetTrashStart = hook.indexOf("  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {");
const oldGetTrashEnd = hook.indexOf("  const restoreItem =", oldGetTrashStart);
if (oldGetTrashStart === -1 || oldGetTrashEnd === -1) throw new Error("getTrash block not found");
const dedupedGetTrash = `  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {
    if (trashReadInFlight) return trashReadInFlight;
    const token = await resolveToken(getToken);
    if (!token) throw new Error("Sessão ainda não está pronta");
    trashReadInFlight = apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);
    try {
      return await trashReadInFlight;
    } finally {
      trashReadInFlight = null;
    }
  }, [getToken]);

`;
hook = hook.slice(0, oldGetTrashStart) + dedupedGetTrash + hook.slice(oldGetTrashEnd);

writeFileSync(trashUrl, trash);
writeFileSync(hookUrl, hook);
console.log("Trash now uses one coordinated refresh, deduplicated reads, and mutation-local state updates.");
