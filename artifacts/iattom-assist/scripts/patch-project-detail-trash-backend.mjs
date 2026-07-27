import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/ProjectDetail.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

source = source.replace('import { moveToTrash } from "@/lib/trashStorage";\n', "");

source = source.replace(
  'const { getItems, getItemAssets, saveItemAssets, getItemVideoAssets } = useSavedItems();',
  'const { getItems, trashItem, getItemAssets, saveItemAssets, getItemVideoAssets } = useSavedItems();',
);
source = source.replace(
  'const { getItems, getTrash, trashItem, getItemAssets, saveItemAssets, getItemVideoAssets } = useSavedItems();',
  'const { getItems, trashItem, getItemAssets, saveItemAssets, getItemVideoAssets } = useSavedItems();',
);

const legacyHandler = `  const handleConfirmTrash = useCallback(() => {
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

const excessiveHandler = `  const handleConfirmTrash = useCallback(async () => {
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

const fixedHandler = `  const handleConfirmTrash = useCallback(async () => {
    if (!item || item === "not_found" || deletingId) return;
    const saved = item as SavedItem;
    setDeletingId(true);

    try {
      await trashItem(saved.id);
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
  }, [item, deletingId, trashItem, navigate, toast]);`;

if (!source.includes(fixedHandler)) {
  if (source.includes(excessiveHandler)) source = source.replace(excessiveHandler, fixedHandler);
  else if (source.includes(legacyHandler)) source = source.replace(legacyHandler, fixedHandler);
  else throw new Error("ProjectDetail trash handler marker not found");
}

if (source.includes('moveToTrash(saved)')) throw new Error("Legacy local-only trash path is still present");
if (!source.includes('await trashItem(saved.id)')) throw new Error("Backend trash call was not installed");
if (source.includes('Promise.all([getItems(), getTrash()])')) throw new Error("Excessive trash readback requests are still present");

writeFileSync(fileUrl, source);
console.log("ProjectDetail deletion now performs one authenticated backend request without redundant readbacks.");
