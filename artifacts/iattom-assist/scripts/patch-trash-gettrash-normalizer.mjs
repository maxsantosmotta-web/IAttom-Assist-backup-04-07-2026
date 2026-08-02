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
