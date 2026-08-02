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

if (!source.includes('return apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);')) {
  throw new Error("Saved-items getTrash normalization failed");
}

writeFileSync(hookUrl, source, "utf8");
console.log("Saved-items getTrash uses one authenticated request per attempt.");

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
console.log("Library preserves a confirmed deletion handoff for Trash reloads.");

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let trashSource = readFileSync(trashUrl, "utf8");

if (!trashSource.includes("const loadAllInFlightRef = refreshInFlightRef;")) {
  const refsOld = "  const refreshInFlightRef = useRef(false);";
  const refsNew = `  const refreshInFlightRef = useRef(false);
  const loadAllInFlightRef = refreshInFlightRef;
  const mountedRef = useRef(true);
  const backgroundRetryRef = useRef<number | null>(null);`;
  if (!trashSource.includes(refsOld)) throw new Error("Trash refresh refs marker not found");
  trashSource = trashSource.replace(refsOld, refsNew);
}

trashSource = trashSource.replace("\n  const recoveryAttemptedRef = useRef(false);", "");

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
      } else if (mountedRef.current) {
        setLoading(true);
      }
    } catch {
      if (mountedRef.current) setLoading(true);
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

      const confirmedIds = new Set(confirmed.map((item) => item.id));
      const allOptimisticConfirmed = optimisticProjects.every((item) => confirmedIds.has(item.id));

      if (allOptimisticConfirmed) {
        try { sessionStorage.removeItem("iattom_recent_trash_v1"); } catch { /* sessão indisponível */ }
        setLoading(false);
      } else {
        setLoading(optimisticProjects.length === 0);
        if (backgroundRetryRef.current === null) {
          backgroundRetryRef.current = window.setTimeout(() => {
            backgroundRetryRef.current = null;
            void refreshTrash();
          }, 3000);
        }
      }

      void Promise.allSettled([
        apiFetch<PromptTrashItem[]>("/api/prompts/trash").then(setPromptItems),
        apiFetch<ActivityTrashItem[]>("/api/history/trash").then(setActivityItems),
        apiFetch<TrashItemData[]>("/api/me/trash").then(setIntegrationItems),
      ]);
    } catch {
      if (mountedRef.current && optimisticProjects.length === 0) setLoading(true);
      if (mountedRef.current && backgroundRetryRef.current === null) {
        backgroundRetryRef.current = window.setTimeout(() => {
          backgroundRetryRef.current = null;
          void refreshTrash();
        }, 3000);
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
  "const allOptimisticConfirmed = optimisticProjects.every",
  "}, 3000);",
  "const loadAll = refreshTrash;",
]) {
  if (!trashSource.includes(marker) && !projectsSource.includes(marker)) {
    throw new Error(`Trash continuous recovery marker missing: ${marker}`);
  }
}

writeFileSync(trashUrl, trashSource, "utf8");
console.log("Trash preserves optimistic items until backend confirmation and retries serially every 3 seconds.");
