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
  throw new Error("Saved-items getTrash single-request normalization failed");
}

writeFileSync(hookUrl, source, "utf8");
console.log("Saved-items getTrash now uses one request without abort/retry storms.");

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let trashSource = readFileSync(trashUrl, "utf8");

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
    if (mountedRef.current && projectItems.length === 0) setLoading(true);

    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});

    const loadSecondarySources = async () => {
      const results = await Promise.allSettled([
        apiFetch<PromptTrashItem[]>("/api/prompts/trash"),
        apiFetch<ActivityTrashItem[]>("/api/history/trash"),
        apiFetch<TrashItemData[]>("/api/me/trash"),
      ]);

      if (!mountedRef.current) return;
      if (results[0]?.status === "fulfilled") setPromptItems(results[0].value);
      if (results[1]?.status === "fulfilled") setActivityItems(results[1].value);
      if (results[2]?.status === "fulfilled") setIntegrationItems(results[2].value);
    };

    try {
      const projects = await getTrash();
      if (!mountedRef.current) return;

      setProjectItems(
        projects
          .filter((item) => item.deletedAt !== null)
          .map((item) => ({
            ...item,
            deletedAt: item.deletedAt!,
            expiresAt: item.expiresAt ?? new Date(new Date(item.deletedAt!).getTime() + 48 * 3600000).toISOString(),
          })) as TrashedItem[],
      );

      setLoading(false);
      void loadSecondarySources();
    } catch {
      if (mountedRef.current && backgroundRetryRef.current === null) {
        backgroundRetryRef.current = window.setTimeout(() => {
          backgroundRetryRef.current = null;
          void refreshTrash();
        }, 8000);
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
  "const loadAllInFlightRef = refreshInFlightRef;",
  "const loadSecondarySources = async () =>",
  "const projects = await getTrash();",
  "void loadSecondarySources();",
  "backgroundRetryRef.current = window.setTimeout",
  "}, 8000);",
  "mountedRef.current = false;",
  "const loadAll = refreshTrash;",
]) {
  if (!trashSource.includes(marker)) {
    throw new Error(`Trash single-request recovery marker missing: ${marker}`);
  }
}

writeFileSync(trashUrl, trashSource, "utf8");
console.log("Trash now uses one project request per refresh and rate-limit-safe recovery.");
