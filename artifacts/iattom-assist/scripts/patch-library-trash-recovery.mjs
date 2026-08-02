import { readFileSync, writeFileSync } from "node:fs";

const projectsUrl = new URL("../src/pages/dashboard/Projects.tsx", import.meta.url);
let source = readFileSync(projectsUrl, "utf8");

const oldHandler = `  const handleConfirmTrash = async (id: string) => {
    const item = savedItems.find(i => i.id === id);
    if (!item) return;
    setDeletingId(id);
    try {
      await trashItem(id);
      const updated = savedItems.filter(i => i.id !== id);
      setSavedItems(updated);
      try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify(updated)); } catch { /* noop */ }
      setConfirmDeleteId(null);
      toast({ description: "Projeto enviado para a lixeira. Acesse a Lixeira para restaurar." });
    } catch {
      toast({ title: "Erro ao mover para lixeira.", description: "Não foi possível excluir o projeto. Tente novamente.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };`;

const newHandler = `  const handleConfirmTrash = async (id: string) => {
    const item = savedItems.find(i => i.id === id);
    if (!item || deletingId) return;

    const delays = [0, 1200, 2500, 4000, 6500];
    setDeletingId(id);

    try {
      let confirmed = false;
      let lastError: unknown = null;

      for (const delay of delays) {
        if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));

        try {
          await trashItem(id);
          confirmed = true;
          break;
        } catch (error) {
          lastError = error;

          // A resposta pode se perder depois de o banco já ter concluído a operação.
          // Confirma pelo estado canônico antes de repetir o DELETE.
          try {
            const activeItems = await getItems();
            if (!activeItems.some((active) => active.id === id)) {
              confirmed = true;
              break;
            }
          } catch { /* mantém o carregamento e tenta novamente */ }

          const message = error instanceof Error ? error.message : String(error ?? "");
          const transient = /HTTP 429|HTTP 5\\d\\d|fetch|network|sessão ainda carregando|failed/i.test(message);
          if (!transient) throw error;
        }
      }

      if (!confirmed) throw lastError ?? new Error("A exclusão não foi confirmada");

      const updated = savedItems.filter(i => i.id !== id);
      setSavedItems(updated);
      try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify(updated)); } catch { /* noop */ }
      setConfirmDeleteId(null);
      toast({ description: "Projeto enviado para a lixeira. Acesse a Lixeira para restaurar." });
    } catch {
      toast({
        title: "Não foi possível concluir agora.",
        description: "O projeto continua na Biblioteca. Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };`;

if (!source.includes(newHandler)) {
  if (!source.includes(oldHandler)) throw new Error("Library trash handler anchor was not found");
  source = source.replace(oldHandler, newHandler);
}

source = source.replace(
  `              {deletingId && <Loader2 className="w-4 h-4 animate-spin" />}
              Mover para lixeira`,
  `              {deletingId && <Loader2 className="w-4 h-4 animate-spin" />}
              {deletingId ? "Movendo..." : "Mover para lixeira"}`,
);

if (!source.includes("const delays = [0, 1200, 2500, 4000, 6500];")) {
  throw new Error("Library trash controlled retry was not applied");
}
if (!source.includes("const activeItems = await getItems();")) {
  throw new Error("Library trash canonical confirmation was not applied");
}
if (!source.includes('{deletingId ? "Movendo..." : "Mover para lixeira"}')) {
  throw new Error("Library trash visible loading label was not applied");
}

writeFileSync(projectsUrl, source, "utf8");
console.log("Library project deletion now stays visibly loading, confirms canonical state, and retries only transient overload failures.");
