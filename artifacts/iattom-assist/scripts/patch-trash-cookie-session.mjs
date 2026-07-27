import { readFileSync, writeFileSync } from "node:fs";

const hookUrl = new URL("../src/hooks/useSavedItems.ts", import.meta.url);
let source = readFileSync(hookUrl, "utf8");

const oldBlock = `  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {
    const token = await resolveToken(getToken);
    if (!token) return [];
    return apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);
  }, [getToken]);`;

const newBlock = `  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {
    const res = await fetch("/api/saved-items/trash", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? \`HTTP \${res.status}\`);
    }
    return res.json() as Promise<SavedItemRecord[]>;
  }, []);`;

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) throw new Error("getTrash Clerk-token marker not found");
  source = source.replace(oldBlock, newBlock);
}

if (source.includes('const token = await resolveToken(getToken);\n    if (!token) return [];\n    return apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);')) {
  throw new Error("getTrash still requests a fresh Clerk token");
}

writeFileSync(hookUrl, source);
console.log("Trash reads now reuse the authenticated browser session without requesting a new Clerk token.");
