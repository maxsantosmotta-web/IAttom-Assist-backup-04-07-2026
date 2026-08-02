import { readFileSync, writeFileSync } from "node:fs";

const hookUrl = new URL("../src/hooks/useSavedItems.ts", import.meta.url);
let source = readFileSync(hookUrl, "utf8");

const startMarker = "  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {";
const endMarker = "\n\n  const restoreItem = useCallback";
const start = source.indexOf(startMarker);
const end = start >= 0 ? source.indexOf(endMarker, start) : -1;

if (start < 0 || end < 0) {
  throw new Error("Saved-items getTrash structural boundaries not found");
}

const normalized = `  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {
    const token = await getToken();
    if (!token) throw new Error("Sessão da Lixeira ainda carregando");
    return apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);
  }, [getToken]);`;

source = `${source.slice(0, start)}${normalized}${source.slice(end)}`;

const trashStartMarker = "  const trashItem = useCallback(async (id: string): Promise<void> => {";
const trashStart = source.indexOf(trashStartMarker);
const trashEnd = trashStart >= 0 ? source.indexOf("\n\n  const trashImageSource = useCallback", trashStart) : -1;
if (trashStart < 0 || trashEnd < 0) {
  throw new Error("Saved-items trashItem structural boundaries not found");
}

let trashBlock = source.slice(trashStart, trashEnd);
const directDelete = '    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}`, token, { method: "DELETE" });';
const guardedDelete = `    try {
      await apiFetch<{ ok: boolean }>(\`/api/saved-items/\${id}\`, token, { method: "DELETE" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("HTTP 429")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await apiFetch<{ ok: boolean }>(\`/api/saved-items/\${id}\`, token, { method: "DELETE" });
    }`;

if (!trashBlock.includes("message.includes(\"HTTP 429\")")) {
  if (!trashBlock.includes(directDelete)) {
    throw new Error("Saved-items direct delete marker not found");
  }
  trashBlock = trashBlock.replace(directDelete, guardedDelete);
  source = `${source.slice(0, trashStart)}${trashBlock}${source.slice(trashEnd)}`;
}

if (!source.includes('return apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);')) {
  throw new Error("Saved-items getTrash single-request normalization failed");
}
if (!source.includes('message.includes("HTTP 429")')) {
  throw new Error("Saved-items delete rate-limit recovery was not installed");
}

writeFileSync(hookUrl, source, "utf8");
console.log("Saved-items trash now uses one read and at most one delayed retry on HTTP 429.");

const projectsUrl = new URL("../src/pages/dashboard/Projects.tsx", import.meta.url);
let projectsSource = readFileSync(projectsUrl, "utf8");

const removeOld = `      const updated = savedItems.filter(i => i.id !== id);
      setSavedItems(updated);`;
const removeNew = `      const deletedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 48 * 3600000).toISOString();
      try {
        const raw = sessionStorage.getItem("iattom_recent_trash_v1");
        const recent = raw ? JSON.parse(raw) as Array<Record<string, unknown>> : [];
        const nextRecent = [{ ...item, deletedAt, expiresAt }, ...recent.filter((entry) => entry.id !== item.id)].slice(0, 20);
        sessionStorage.setItem("iattom_recent_trash_v1", JSON.stringify(nextRecent));
      } catch { /* sessão indisponível */ }
      const updated = savedItems.filter(i => i.id !== id);
      setSavedItems(updated);`;

if (!projectsSource.includes("iattom_recent_trash_v1")) {
  if (!projectsSource.includes(removeOld)) {
    throw new Error("Projects optimistic trash handoff marker not found");
  }
  projectsSource = projectsSource.replace(removeOld, removeNew);
}
writeFileSync(projectsUrl, projectsSource, "utf8");
console.log("Library hands confirmed deletions to Trash immediately.");

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let trashSource = readFileSync(trashUrl, "utf8");

const refsOld = "  const refreshInFlightRef = useRef(false);";
const refsNew = `  const refreshInFlightRef = useRef(false);
  const loadAllInFlightRef = refreshInFlightRef;
  const mountedRef = useRef(true);
  const backgroundRetryRef = useRef<number | null>(null);
  const recoveryAttemptedRef = useRef(false);`;

if (!trashSource.includes("const recoveryAttemptedRef = useRef(false);")) {
  if (trashSource.includes("const backgroundRetryRef = useRef<number | null>(null);")) {
    trashSource = trashSource.replace(
      "  const backgroundRetryRef = useRef<number | null>(null);",
      "  const backgroundRetryRef = useRef<number | null>(null);\n  const recoveryAttemptedRef = useRef(false);",
    );
  } else if (trashSource.includes(refsOld)) {
    trashSource = trashSource.replace(refsOld, refsNew);
  } else {
    throw new Error("Trash refresh refs marker not found");
  }
}

const refreshStartMarker = "  const refreshTrash = async () => {";
const refreshStart = trashSource.indexOf(refreshStartMarker);
const unifiedMarker = "  const all: UnifiedItem[] = [";
const unifiedStart = refreshStart >= 0 ? trashSource.indexOf(unifiedMarker, refreshStart) : -1;

if (refreshStart < 0 || unifiedStart < 0) {
  throw new Error("Trash coordinated refresh boundaries not found");
}

const recoveredRefresh = `  const refreshTrash = async () => {
    if (loadAllInFlightRef.current) return;
    loadAllInFlightRef.current = true;

    let optimisticProjects: TrashedItem[] = [];
    try {
      const raw = sessionStorage.getItem("iattom_recent_trash_v1");
      const recent = raw ? JSON.parse(raw) as TrashedItem[] : [];
      optimisticProjects = recent.filter((item) => item.deletedAt && item.expiresAt);
      if (optimisticProjects.length > 0 && mountedRef.current) {
        setProjectItems((current) => {
          const byId = new Map([...optimisticProjects, ...current].map((item) => [item.id, item]));
          return Array.from(byId.values());
        });
        setLoading(false);
      } else if (mountedRef.current && projectItems.length === 0) {
        setLoading(true);
      }
    } catch {
      if (mountedRef.current && projectItems.length === 0) setLoading(true);
    }

    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});

    try {
      const projects = await getTrash();
      if (!mountedRef.current) return;

      const confirmed = projects
        .filter((item) => item.deletedAt !== null)
        .map((item) => ({
          ...item,
          deletedAt: item.deletedAt!,
          expiresAt: item.expiresAt ?? new Date(new Date(item.deletedAt!).getTime() + 48 * 3600000).toISOString(),
        })) as TrashedItem[];

      const byId = new Map([...optimisticProjects, ...confirmed].map((item) => [item.id, item]));
      setProjectItems(Array.from(byId.values()));
      setLoading(false);
      recoveryAttemptedRef.current = false;
      try { sessionStorage.removeItem("iattom_recent_trash_v1"); } catch { /* sessão indisponível */ }

      void Promise.allSettled([
        apiFetch<PromptTrashItem[]>("/api/prompts/trash").then(setPromptItems),
        apiFetch<ActivityTrashItem[]>("/api/history/trash").then(setActivityItems),
        apiFetch<TrashItemData[]>("/api/me/trash").then(setIntegrationItems),
      ]);
    } catch {
      if (mountedRef.current) setLoading(false);
      if (
        mountedRef.current &&
        !recoveryAttemptedRef.current &&
        backgroundRetryRef.current === null
      ) {
        recoveryAttemptedRef.current = true;
        backgroundRetryRef.current = window.setTimeout(() => {
          backgroundRetryRef.current = null;
          void refreshTrash();
        }, 15000);
      }
    } finally {
      loadAllInFlightRef.current = false;
    }
  };

  const loadAll = refreshTrash;

  useEffect(() => {
    mountedRef.current = true;
    void refreshTrash();
    return () => {
      mountedRef.current = false;
      if (backgroundRetryRef.current !== null) {
        window.clearTimeout(backgroundRetryRef.current);
        backgroundRetryRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

`;

trashSource = `${trashSource.slice(0, refreshStart)}${recoveredRefresh}${trashSource.slice(unifiedStart)}`;

for (const marker of [
  "iattom_recent_trash_v1",
  "const recoveryAttemptedRef = useRef(false);",
  "!recoveryAttemptedRef.current",
  "}, 15000);",
  "const loadAll = refreshTrash;",
]) {
  if (!trashSource.includes(marker) && !projectsSource.includes(marker)) {
    throw new Error(`Trash final recovery marker missing: ${marker}`);
  }
}

writeFileSync(trashUrl, trashSource, "utf8");
console.log("Trash uses immediate handoff, one read, and only one automatic recovery attempt.");
