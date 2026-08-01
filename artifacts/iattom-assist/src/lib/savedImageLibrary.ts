import { loadProjectAssets } from "@/lib/assetStorage";
import type { AssetData, SavedItemRecord } from "@/hooks/useSavedItems";

export type SavedImageLibraryEntry = {
  project: SavedItemRecord;
  asset: AssetData;
};

type GetItems = () => Promise<SavedItemRecord[]>;
type GetItemAssets = (id: string) => Promise<AssetData[]>;

const CACHE_TTL_MS = 60_000;
const CONCURRENCY = 3;

let cache: { entries: SavedImageLibraryEntry[]; fetchedAt: number } | null = null;
let pendingRequest: Promise<SavedImageLibraryEntry[]> | null = null;

export function getSavedImageLibraryCache(): SavedImageLibraryEntry[] {
  return cache?.entries ?? [];
}

export function clearSavedImageLibraryCache(): void {
  cache = null;
}

export async function loadSavedImageLibrary(
  getItems: GetItems,
  getItemAssets: GetItemAssets,
  force = false,
): Promise<SavedImageLibraryEntry[]> {
  const now = Date.now();
  if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.entries;
  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    const items = (await getItems())
      .filter((item) => !item.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const results: SavedImageLibraryEntry[][] = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;

        const project = items[index];
        let projectAssets = await getItemAssets(project.id).catch(() => [] as AssetData[]);

        if (projectAssets.length === 0) {
          const localAssets = await loadProjectAssets(project.id).catch(() => []);
          projectAssets = localAssets.map((asset) => ({
            conceptIndex: asset.conceptIndex,
            base64: asset.base64,
            label: asset.label,
            format: asset.format,
          }));
        }

        results[index] = projectAssets
          .filter((asset) => Boolean(asset.base64))
          .map((asset) => ({ project, asset }));
      }
    };

    const workerCount = Math.min(CONCURRENCY, Math.max(items.length, 1));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    const entries = results.flatMap((group) => group ?? []);
    cache = { entries, fetchedAt: Date.now() };
    return entries;
  })().finally(() => {
    pendingRequest = null;
  });

  return pendingRequest;
}
