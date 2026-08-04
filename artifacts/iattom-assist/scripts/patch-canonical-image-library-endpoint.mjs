import { readFileSync, writeFileSync } from "node:fs";

const apiUrl = new URL("../../api-server/src/routes/savedItems.ts", import.meta.url);
const hookUrl = new URL("../src/hooks/useSavedItems.ts", import.meta.url);
const libraryUrl = new URL("../src/lib/savedImageLibrary.ts", import.meta.url);
const promptPickerUrl = new URL("../src/components/prompts/PromptImageReferencePicker.tsx", import.meta.url);
const motionPickerUrl = new URL("../src/components/creative/ImageMotionSourcePicker.tsx", import.meta.url);

let api = readFileSync(apiUrl, "utf8");
let hook = readFileSync(hookUrl, "utf8");
let promptPicker = readFileSync(promptPickerUrl, "utf8");
let motionPicker = readFileSync(motionPickerUrl, "utf8");

const routeMarker = "const largeJson = express.json({ limit: \"25mb\" });";
const canonicalRoute = `router.get("/saved-items/image-library", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  try {
    const rows = await db
      .select({ ...LIST_COLUMNS, imagesData: savedItemsTable.imagesData })
      .from(savedItemsTable)
      .where(and(
        eq(savedItemsTable.clerkUserId, clerkUserId),
        isNull(savedItemsTable.deletedAt),
        eq(savedItemsTable.hasImages, true),
      ))
      .orderBy(savedItemsTable.createdAt);

    const seen = new Set<string>();
    const entries: Array<{
      project: Omit<(typeof rows)[number], "imagesData">;
      asset: { conceptIndex: number; base64: string; label: string; format: string };
    }> = [];

    for (const row of rows.reverse()) {
      let isVideoEffect = false;
      try {
        const parsed = row.data ? JSON.parse(row.data) as { type?: unknown } : null;
        isVideoEffect = parsed?.type === "image-motion-source";
      } catch { /* mantém registro de imagem válido */ }
      if (isVideoEffect) continue;

      let assets: Array<{ conceptIndex: number; base64: string; label: string; format: string }> = [];
      try {
        assets = row.imagesData ? JSON.parse(row.imagesData) as typeof assets : [];
      } catch { /* registro legado sem assets válidos */ }

      const { imagesData: _imagesData, ...project } = row;
      for (const asset of assets) {
        const base64 = typeof asset?.base64 === "string" ? asset.base64.trim() : "";
        if (!base64 || seen.has(base64)) continue;
        seen.add(base64);
        entries.push({ project, asset: { ...asset, base64 } });
      }
    }

    return res.json({ entries });
  } catch (err) {
    req.log.error({ err }, "Failed to load canonical image library");
    return res.status(500).json({ error: "Erro ao carregar imagens da Biblioteca" });
  }
});

${routeMarker}`;

if (!api.includes('router.get("/saved-items/image-library"')) {
  if (!api.includes(routeMarker)) throw new Error("Canonical image library API marker not found");
  api = api.replace(routeMarker, canonicalRoute);
}

const hookTypeMarker = `export interface AssetData {
  conceptIndex: number;
  base64: string;
  label: string;
  format: string;
}`;
const hookTypeBlock = `${hookTypeMarker}

export interface SavedImageLibraryEntryData {
  project: SavedItemRecord;
  asset: AssetData;
}`;
if (!hook.includes("export interface SavedImageLibraryEntryData")) {
  if (!hook.includes(hookTypeMarker)) throw new Error("Saved image library hook type marker not found");
  hook = hook.replace(hookTypeMarker, hookTypeBlock);
}

const getItemsMarker = `  const getItems = useCallback(async (): Promise<SavedItemRecord[]> => {
    const token = await resolveToken(getToken);
    return apiFetch<SavedItemRecord[]>("/api/saved-items", token);
  }, [getToken]);`;
const getImageLibraryBlock = `${getItemsMarker}

  const getImageLibrary = useCallback(async (): Promise<SavedImageLibraryEntryData[]> => {
    const token = await resolveToken(getToken);
    const response = await apiFetch<{ entries: SavedImageLibraryEntryData[] }>("/api/saved-items/image-library", token);
    return response.entries ?? [];
  }, [getToken]);`;
if (!hook.includes("const getImageLibrary = useCallback")) {
  if (!hook.includes(getItemsMarker)) throw new Error("getItems marker not found for canonical image library hook");
  hook = hook.replace(getItemsMarker, getImageLibraryBlock);
}

hook = hook.replace(
  "return { getItems, saveItem, saveItemAssets, getItemAssets, saveItemVideoAssets, getItemVideoAssets, trashItem, trashImageSource, getTrash, restoreItem, permanentDelete };",
  "return { getItems, getImageLibrary, saveItem, saveItemAssets, getItemAssets, saveItemVideoAssets, getItemVideoAssets, trashItem, trashImageSource, getTrash, restoreItem, permanentDelete };",
);
if (!hook.includes("return { getItems, getImageLibrary,")) {
  throw new Error("Canonical image library hook was not exposed");
}

const librarySource = `import type { SavedImageLibraryEntryData } from "@/hooks/useSavedItems";

export type SavedImageLibraryEntry = SavedImageLibraryEntryData;

type GetImageLibrary = () => Promise<SavedImageLibraryEntry[]>;

let cache: SavedImageLibraryEntry[] = [];
let pendingRequest: Promise<SavedImageLibraryEntry[]> | null = null;

export function getSavedImageLibraryCache(): SavedImageLibraryEntry[] {
  return cache;
}

export function clearSavedImageLibraryCache(): void {
  cache = [];
}

export async function loadSavedImageLibrary(
  getImageLibrary: GetImageLibrary,
): Promise<SavedImageLibraryEntry[]> {
  if (pendingRequest) return pendingRequest;

  pendingRequest = getImageLibrary()
    .then((entries) => {
      cache = entries;
      return entries;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}
`;

promptPicker = promptPicker
  .replace("const { getItems, getItemAssets } = useSavedItems();", "const { getImageLibrary } = useSavedItems();")
  .replace("loadSavedImageLibrary(getItems, getItemAssets)", "loadSavedImageLibrary(getImageLibrary)");

motionPicker = motionPicker
  .replace("const { getItems, getItemAssets } = useSavedItems();", "const { getImageLibrary } = useSavedItems();")
  .replace("loadSavedImageLibrary(getItems, getItemAssets)", "loadSavedImageLibrary(getImageLibrary)");

for (const [name, source] of [["Prompt", promptPicker], ["Motion", motionPicker]]) {
  if (!source.includes("const { getImageLibrary } = useSavedItems();")) {
    throw new Error(`${name} picker did not adopt the canonical image library hook`);
  }
  if (!source.includes("loadSavedImageLibrary(getImageLibrary)")) {
    throw new Error(`${name} picker did not adopt the single canonical request`);
  }
  if (source.includes("loadSavedImageLibrary(getItems, getItemAssets)")) {
    throw new Error(`${name} picker still performs project-by-project image loading`);
  }
}

writeFileSync(apiUrl, api, "utf8");
writeFileSync(hookUrl, hook, "utf8");
writeFileSync(libraryUrl, librarySource, "utf8");
writeFileSync(promptPickerUrl, promptPicker, "utf8");
writeFileSync(motionPickerUrl, motionPicker, "utf8");
console.log("Image selectors now load the canonical image library with one authenticated request.");
