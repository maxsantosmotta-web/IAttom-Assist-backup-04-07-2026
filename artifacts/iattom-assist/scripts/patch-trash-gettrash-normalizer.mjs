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

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);
    try {
      return await apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token, {
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Consulta da Lixeira demorou além do limite");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [getToken]);`;

source = `${source.slice(0, start)}${normalized}${source.slice(end)}`;

if (!source.includes("Consulta da Lixeira demorou além do limite")) {
  throw new Error("Saved-items getTrash timeout normalization failed");
}

writeFileSync(hookUrl, source, "utf8");
console.log("Saved-items getTrash now has a bounded request timeout for fast recovery.");

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
    if (mountedRef.current) setLoading(true);

    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});

    const retryDelays = [0, 300, 700, 1200, 2000, 3000];

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
      for (const delay of retryDelays) {
        if (!mountedRef.current) return;
        if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));
        if (!mountedRef.current) return;

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
          return;
        } catch {
          // Preserva os itens atuais e tenta novamente sem zerar a Lixeira.
        }
      }

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
  "const loadAllInFlightRef = refreshInFlightRef;",
  "const retryDelays = [0, 300, 700, 1200, 2000, 3000];",
  "const loadSecondarySources = async () =>",
  "const projects = await getTrash();",
  "void loadSecondarySources();",
  "backgroundRetryRef.current = window.setTimeout",
  "mountedRef.current = false;",
  "const loadAll = refreshTrash;",
]) {
  if (!trashSource.includes(marker)) {
    throw new Error(`Trash automatic recovery marker missing: ${marker}`);
  }
}

writeFileSync(trashUrl, trashSource, "utf8");
console.log("Trash project loading is now independent, bounded, preserved and automatically retried.");
