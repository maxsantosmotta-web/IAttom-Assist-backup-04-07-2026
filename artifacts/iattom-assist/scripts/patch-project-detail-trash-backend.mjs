import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/ProjectDetail.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

source = source.replace('import { moveToTrash } from "@/lib/trashStorage";\n', "");

source = source.replace(
  'const { getItems, getItemAssets, saveItemAssets, getItemVideoAssets } = useSavedItems();',
  'const { getItems, getTrash, trashItem, getItemAssets, saveItemAssets, getItemVideoAssets } = useSavedItems();',
);

const oldHandler = `  const handleConfirmTrash = useCallback(() => {
    if (!item || item === "not_found") return;
    setDeletingId(true);
    const saved = item as SavedItem;
    moveToTrash(saved);
    setConfirmTrashOpen(false);
    setTimeout(() => {
      toast({ description: "Projeto enviado para a lixeira." });
      navigate("/dashboard/projects");
    }, 200);
  }, [item, navigate, toast]);`;

const newHandler = `  const handleConfirmTrash = useCallback(async () => {
    if (!item || item === "not_found" || deletingId) return;
    const saved = item as SavedItem;
    setDeletingId(true);

    try {
      await trashItem(saved.id);

      const [activeItems, trashItems] = await Promise.all([getItems(), getTrash()]);
      const stillActive = activeItems.some((entry) => entry.id === saved.id);
      const inTrash = trashItems.some((entry) => entry.id === saved.id && entry.deletedAt !== null);

      if (stillActive || !inTrash) {
        throw new Error("O banco não confirmou o envio para a Lixeira");
      }

      const local = readStorage().filter((entry) => entry.id !== saved.id);
      writeStorage(local);
      setConfirmTrashOpen(false);
      toast({ description: "Projeto enviado para a lixeira." });
      navigate("/dashboard/projects");
    } catch (error) {
      toast({
        title: "Erro ao mover para a lixeira.",
        description: error instanceof Error ? error.message : "Não foi possível excluir o projeto.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(false);
    }
  }, [item, deletingId, trashItem, getItems, getTrash, navigate, toast]);`;

if (!source.includes(newHandler)) {
  if (!source.includes(oldHandler)) throw new Error("ProjectDetail local-trash handler marker not found");
  source = source.replace(oldHandler, newHandler);
}

if (source.includes('moveToTrash(saved)')) throw new Error("Legacy local-only trash path is still present");
if (!source.includes('await trashItem(saved.id)')) throw new Error("Backend trash call was not installed");
if (!source.includes('const [activeItems, trashItems]')) throw new Error("Trash confirmation readback was not installed");

writeFileSync(fileUrl, source);
console.log("ProjectDetail deletion now uses backend trash and confirms active/trash state before success.");
