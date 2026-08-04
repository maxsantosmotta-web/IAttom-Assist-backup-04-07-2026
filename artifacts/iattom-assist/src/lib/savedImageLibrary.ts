import { loadProjectAssets } from "@/lib/assetStorage";
import type { AssetData, SavedItemRecord } from "@/hooks/useSavedItems";

export type SavedImageLibraryEntry = {
  project: SavedItemRecord;
  asset: AssetData;
};

type GetItems = () => Promise<SavedItemRecord[]>;
type GetItemAssets = (id: string) => Promise<AssetData[]>;

const CONCURRENCY = 3;

let cache: { entries: SavedImageLibraryEntry[]; fetchedAt: number } | null = null;
let pendingRequest: Promise<SavedImageLibraryEntry[]> | null = null;

export function getSavedImageLibraryCache(): SavedImageLibraryEntry[] {
  return cache?.entries ?? [];
}

export function clearSavedImageLibraryCache(): void {
  cache = null;
}

function uniqueImageEntries(entries: SavedImageLibraryEntry[]): SavedImageLibraryEntry[] {
  const seen = new Set<string>();
  const unique: SavedImageLibraryEntry[] = [];

  for (const entry of entries) {
    const base64 = entry.asset.base64?.trim();
    if (!base64) continue;

    // O mesmo arquivo pode estar associado a mais de um registro legado ou cache local.
    // A imagem deve aparecer apenas uma vez nos seletores de Vídeo com Imagem/Efeito.
    const key = base64;
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(entry);
  }

  return unique;
}

export async function loadSavedImageLibrary(
  getItems: GetItems,
  getItemAssets: GetItemAssets,
  force = true,
): Promise<SavedImageLibraryEntry[]> {
  if (!force && cache) return cache.entries;
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
          .filter((asset) => Boolean(asset.base64?.trim()))
          .map((asset) => ({ project, asset }));
      }
    };

    const workerCount = Math.min(CONCURRENCY, Math.max(items.length, 1));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    const entries = uniqueImageEntries(results.flatMap((group) => group ?? []));
    cache = { entries, fetchedAt: Date.now() };
    return entries;
  })().finally(() => {
    pendingRequest = null;
  });

  return pendingRequest;
}
