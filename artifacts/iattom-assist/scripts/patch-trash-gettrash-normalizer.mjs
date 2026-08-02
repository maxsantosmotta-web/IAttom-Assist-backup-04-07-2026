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

if (!trashSource.includes("const loadAll = async () =>")) {
  const loadersNew = `  const loadIntegrations = async () => {
    const data = await apiFetch<TrashItemData[]>("/api/me/trash");
    setIntegrationItems(data);
  };

  const loadProjects = async () => {
    const expired = purgeExpired();
    for (const id of expired) void deleteProjectAssets(id).catch(() => {});
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
  };

  const loadPrompts = async () => {
    const data = await apiFetch<PromptTrashItem[]>("/api/prompts/trash");
    setPromptItems(data);
  };

  const loadActivities = async () => {
    const data = await apiFetch<ActivityTrashItem[]>("/api/history/trash");
    setActivityItems(data);
  };

  const loadAll = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      loadProjects(),
      loadPrompts(),
      loadActivities(),
      loadIntegrations(),
    ]);
    setLoading(false);

    if (results.every((result) => result.status === "rejected")) {
      toast({
        title: "Não foi possível carregar a Lixeira.",
        description: "Os itens anteriores foram preservados. Use Atualizar em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

`;

  const startMatch = /\n\s*const\s+loadIntegrations\s*=\s*async\s*\(\)\s*=>\s*\{/.exec(trashSource);
  const endMatch = /\n\s*(?:\/\/[^\n]*\n\s*)*const\s+all\s*:\s*UnifiedItem\[\]\s*=\s*\[/.exec(trashSource);

  if (!startMatch || !endMatch || endMatch.index <= startMatch.index) {
    throw new Error("Trash loader regex boundaries not found");
  }

  const startIndex = startMatch.index + 1;
  const endIndex = endMatch.index + 1;
  trashSource = `${trashSource.slice(0, startIndex)}${loadersNew}${trashSource.slice(endIndex)}`;
}

if (!trashSource.includes("const loadAll = async () =>")) {
  throw new Error("Trash loader normalization failed");
}

writeFileSync(trashUrl, trashSource, "utf8");
console.log("Trash loaders normalized before reliability and automatic recovery patches.");
