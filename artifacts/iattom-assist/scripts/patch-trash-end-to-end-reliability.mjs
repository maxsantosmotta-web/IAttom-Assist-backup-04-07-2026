import { readFileSync, writeFileSync } from "node:fs";

const hookUrl = new URL("../src/hooks/useSavedItems.ts", import.meta.url);
let hookSource = readFileSync(hookUrl, "utf8");

const apiFetchMarker = `async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: \`Bearer \${token}\`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? \`HTTP \${res.status}\`);
  }
  return res.json() as Promise<T>;
}`;

const apiFetchWithRetry = `${apiFetchMarker}

async function apiFetchWithTransientRetry<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const delays = [0, 400, 1000];
  let lastError: unknown;

  for (const delay of delays) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      return await apiFetch<T>(path, token, init);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      const statusMatch = message.match(/HTTP (\\d{3})/);
      const status = statusMatch ? Number(statusMatch[1]) : null;
      const transient = status === 401 || status === 403 || status === 429 || (status !== null && status >= 500);
      if (!transient) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Falha temporária ao acessar a Lixeira");
}`;

if (!hookSource.includes("async function apiFetchWithTransientRetry")) {
  if (!hookSource.includes(apiFetchMarker)) throw new Error("Saved-items apiFetch marker not found");
  hookSource = hookSource.replace(apiFetchMarker, apiFetchWithRetry);
}

const trashCallOld = '    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}`, token, { method: "DELETE" });';
const trashCallNew = '    const response = await apiFetchWithTransientRetry<{ ok: boolean }>(`/api/saved-items/${id}`, token, { method: "DELETE" });\n    if (!response.ok) throw new Error("O projeto não foi confirmado na Lixeira");';
if (!hookSource.includes(trashCallNew)) {
  if (!hookSource.includes(trashCallOld)) throw new Error("Saved-items trash call marker not found");
  hookSource = hookSource.replace(trashCallOld, trashCallNew);
}

const getTrashOld = `  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {
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
const getTrashAuthenticated = `  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {
    const token = await resolveToken(getToken);
    return apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);
  }, [getToken]);`;
const getTrashNew = `  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {
    const token = await resolveToken(getToken);
    return apiFetchWithTransientRetry<SavedItemRecord[]>("/api/saved-items/trash", token);
  }, [getToken]);`;
if (!hookSource.includes('return apiFetchWithTransientRetry<SavedItemRecord[]>("/api/saved-items/trash", token);')) {
  if (hookSource.includes(getTrashOld)) {
    hookSource = hookSource.replace(getTrashOld, getTrashNew);
  } else if (hookSource.includes(getTrashAuthenticated)) {
    hookSource = hookSource.replace(getTrashAuthenticated, getTrashNew);
  } else {
    throw new Error("Saved-items getTrash marker not found");
  }
}

writeFileSync(hookUrl, hookSource, "utf8");

const projectsUrl = new URL("../src/pages/dashboard/Projects.tsx", import.meta.url);
let projectsSource = readFileSync(projectsUrl, "utf8");
const projectCatchOld = `    } catch {
      toast({ title: "Erro ao mover para lixeira.", description: "Não foi possível excluir o projeto. Tente novamente.", variant: "destructive" });
    } finally {`;
const projectCatchNew = `    } catch (error) {
      toast({
        title: "Erro ao mover para lixeira.",
        description: error instanceof Error ? error.message : "Não foi possível excluir o projeto. Tente novamente.",
        variant: "destructive",
      });
    } finally {`;
if (!projectsSource.includes("description: error instanceof Error ? error.message")) {
  if (!projectsSource.includes(projectCatchOld)) throw new Error("Projects trash error marker not found");
  projectsSource = projectsSource.replace(projectCatchOld, projectCatchNew);
}
writeFileSync(projectsUrl, projectsSource, "utf8");

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let trashSource = readFileSync(trashUrl, "utf8");

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

if (!trashSource.includes("const loadAll = async () =>")) {
  const loadersStartMarker = "  const loadIntegrations = async () => {";
  const loadersEndMarker = "  // ── Unified list";
  const loadersStart = trashSource.indexOf(loadersStartMarker);
  const loadersEnd = loadersStart >= 0 ? trashSource.indexOf(loadersEndMarker, loadersStart) : -1;

  if (loadersStart < 0 || loadersEnd < 0) {
    throw new Error("Trash loader structural boundaries not found");
  }

  trashSource = `${trashSource.slice(0, loadersStart)}${loadersNew}${trashSource.slice(loadersEnd)}`;
}

for (const marker of [
  "async function apiFetchWithTransientRetry",
  'return apiFetchWithTransientRetry<SavedItemRecord[]>("/api/saved-items/trash", token);',
  "const loadAll = async () =>",
  "Promise.allSettled([",
  "description: error instanceof Error ? error.message",
]) {
  const combined = `${hookSource}\n${projectsSource}\n${trashSource}`;
  if (!combined.includes(marker)) throw new Error(`Trash reliability marker missing: ${marker}`);
}

writeFileSync(trashUrl, trashSource, "utf8");
console.log("Library deletion, authenticated trash loading, coordinated state and persistence are now stabilized.");
