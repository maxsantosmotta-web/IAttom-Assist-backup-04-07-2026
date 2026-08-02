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
    const token = await resolveToken(getToken);
    return apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);
  }, [getToken]);`;

source = `${source.slice(0, start)}${normalized}${source.slice(end)}`;

if (!source.includes('return apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);')) {
  throw new Error("Saved-items getTrash normalization failed");
}

writeFileSync(hookUrl, source, "utf8");
console.log("Saved-items getTrash normalized structurally before trash reliability patches.");

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let trashSource = readFileSync(trashUrl, "utf8");

if (!trashSource.includes("const retryDelays = [0, 800, 1600, 3000, 5000, 8000, 10000];")) {
  const refsOld = "  const refreshInFlightRef = useRef(false);";
  const refsNew = `  const refreshInFlightRef = useRef(false);
  const loadAllInFlightRef = refreshInFlightRef;
  const mountedRef = useRef(true);
  const backgroundRetryRef = useRef<number | null>(null);`;

  if (!trashSource.includes(refsNew)) {
    if (!trashSource.includes(refsOld)) {
      throw new Error("Trash refresh refs marker not found");
    }
    trashSource = trashSource.replace(refsOld, refsNew);
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
    if (mountedRef.current) setLoading(true);

    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});

    const retryDelays = [0, 800, 1600, 3000, 5000, 8000, 10000];

    try {
      for (const delay of retryDelays) {
        if (!mountedRef.current) return;
        if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));
        if (!mountedRef.current) return;

        const results = await Promise.allSettled([
          getTrash(),
          apiFetch<PromptTrashItem[]>("/api/prompts/trash"),
          apiFetch<ActivityTrashItem[]>("/api/history/trash"),
          apiFetch<TrashItemData[]>("/api/me/trash"),
        ]);

        const projectsLoaded = results[0]?.status === "fulfilled";
        const allLoaded = results.every((result) => result.status === "fulfilled");

        if (results[0]?.status === "fulfilled") {
          setProjectItems(
            results[0].value
              .filter((item) => item.deletedAt !== null)
              .map((item) => ({
                ...item,
                deletedAt: item.deletedAt!,
                expiresAt: item.expiresAt ?? new Date(new Date(item.deletedAt!).getTime() + 48 * 3600000).toISOString(),
              })) as TrashedItem[],
          );
        }
        if (results[1]?.status === "fulfilled") setPromptItems(results[1].value);
        if (results[2]?.status === "fulfilled") setActivityItems(results[2].value);
        if (results[3]?.status === "fulfilled") setIntegrationItems(results[3].value);

        if (projectsLoaded) {
          if (mountedRef.current) setLoading(false);
          if (!allLoaded && mountedRef.current && backgroundRetryRef.current === null) {
            backgroundRetryRef.current = window.setTimeout(() => {
              backgroundRetryRef.current = null;
              void refreshTrash();
            }, 10000);
          }
          return;
        }
      }

      if (mountedRef.current && backgroundRetryRef.current === null) {
        backgroundRetryRef.current = window.setTimeout(() => {
          backgroundRetryRef.current = null;
          void refreshTrash();
        }, 10000);
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
}

for (const marker of [
  "const loadAllInFlightRef = refreshInFlightRef;",
  "const retryDelays = [0, 800, 1600, 3000, 5000, 8000, 10000];",
  'const projectsLoaded = results[0]?.status === "fulfilled";',
  "backgroundRetryRef.current = window.setTimeout",
  "mountedRef.current = false;",
  "const loadAll = refreshTrash;",
]) {
  if (!trashSource.includes(marker)) {
    throw new Error(`Trash automatic recovery marker missing: ${marker}`);
  }
}

writeFileSync(trashUrl, trashSource, "utf8");
console.log("Trash coordinated refresh now preserves items and retries automatically after transient failures.");
