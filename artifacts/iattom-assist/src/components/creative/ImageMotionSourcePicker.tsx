import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Image as ImageIcon, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { deleteProjectAssets, loadProjectAssets, saveProjectAssets } from "@/lib/assetStorage";
import { useSavedItems, type AssetData, type SavedItemRecord } from "@/hooks/useSavedItems";

const DRAFT_PROJECT_ID = "__iattom_image_motion_draft__";
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export interface ImageMotionSource {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
  name: string;
  origin: "gallery" | "library";
}

interface ImageMotionSourcePickerProps {
  value: ImageMotionSource | null;
  onChange: (value: ImageMotionSource | null) => void;
  disabled?: boolean;
  resetSignal?: number;
}

function stripDataUrl(value: string): { base64: string; mimeType: "image/png" | "image/jpeg" } | null {
  const match = value.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/i);
  if (!match) return null;
  return { base64: match[2], mimeType: match[1].toLowerCase() as "image/png" | "image/jpeg" };
}

function inferMime(label: string): "image/png" | "image/jpeg" {
  return /\.jpe?g$/i.test(label) ? "image/jpeg" : "image/png";
}

export function ImageMotionSourcePicker({ value, onChange, disabled = false, resetSignal = 0 }: ImageMotionSourcePickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [choosingSource, setChoosingSource] = useState(false);
  const [assets, setAssets] = useState<Array<{ project: SavedItemRecord; asset: AssetData }>>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [error, setError] = useState("");
  const { getItems, getItemAssets } = useSavedItems();

  useEffect(() => {
    void loadProjectAssets(DRAFT_PROJECT_ID)
      .then((saved) => {
        const first = saved[0];
        if (!first || value) return;
        onChange({
          base64: first.base64,
          mimeType: inferMime(first.label),
          name: first.label || "Imagem selecionada",
          origin: first.format === "library" ? "library" : "gallery",
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (resetSignal <= 0) return;
    onChange(null);
    setChoosingSource(false);
    setRemoveConfirmOpen(false);
    setLibraryOpen(false);
    setError("");
    void deleteProjectAssets(DRAFT_PROJECT_ID).catch(() => {});
  }, [resetSignal]);

  const persist = async (next: ImageMotionSource) => {
    await deleteProjectAssets(DRAFT_PROJECT_ID).catch(() => {});
    await saveProjectAssets(DRAFT_PROJECT_ID, [{
      conceptIndex: 0,
      base64: next.base64,
      label: next.name,
      format: next.origin,
    }]);
  };

  const selectSource = (next: ImageMotionSource) => {
    setError("");
    setChoosingSource(false);
    onChange(next);
    void persist(next).catch(() => {});
  };

  const confirmRemoveSource = () => {
    onChange(null);
    setChoosingSource(false);
    setRemoveConfirmOpen(false);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
    void deleteProjectAssets(DRAFT_PROJECT_ID).catch(() => {});
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Escolha uma imagem PNG, JPG ou JPEG.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("A imagem deve ter no máximo 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const parsed = stripDataUrl(reader.result);
      if (!parsed) {
        setError("Não foi possível ler a imagem escolhida.");
        return;
      }
      selectSource({ ...parsed, name: file.name, origin: "gallery" });
    };
    reader.onerror = () => setError("Não foi possível ler a imagem escolhida.");
    reader.readAsDataURL(file);
  };

  const openLibrary = async () => {
    setLibraryOpen(true);
    setLoadingLibrary(true);
    setError("");
    try {
      const items = (await getItems()).filter((item) => !item.deletedAt && item.hasImages);
      const loaded = await Promise.all(items.map(async (project) => ({ project, assets: await getItemAssets(project.id) })));
      setAssets(loaded.flatMap(({ project, assets: projectAssets }) => projectAssets.map((asset) => ({ project, asset }))));
    } catch {
      setError("Não foi possível carregar as imagens da Biblioteca.");
    } finally {
      setLoadingLibrary(false);
    }
  };

  const showSourceChoices = !value || choosingSource;

  return (
    <div className="space-y-3">
      <Label className="text-sm text-muted-foreground">Imagem-base</Label>

      {showSourceChoices ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button type="button" variant="outline" disabled={disabled} onClick={() => fileRef.current?.click()} className="border-white/10 bg-[#0a0a0a] text-zinc-300">
              <Upload className="w-4 h-4 mr-2" /> Buscar na galeria
            </Button>
            <Button type="button" variant="outline" disabled={disabled} onClick={() => void openLibrary()} className="border-white/10 bg-[#0a0a0a] text-zinc-300">
              <ImageIcon className="w-4 h-4 mr-2" /> Buscar na biblioteca
            </Button>
          </div>
          {value && choosingSource && (
            <Button type="button" variant="ghost" disabled={disabled} onClick={() => setChoosingSource(false)} className="w-full text-zinc-400 hover:text-zinc-200">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para a imagem atual
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-white/10 bg-black">
            <img src={`data:${value.mimeType};base64,${value.base64}`} alt="Prévia da imagem-base" className="w-full h-auto object-contain" />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" variant="outline" disabled={disabled} onClick={() => setChoosingSource(true)} className="border-white/10 text-zinc-300">
              <RefreshCw className="w-4 h-4 mr-2" /> Trocar
            </Button>
            <Button type="button" variant="outline" disabled={disabled} onClick={() => setRemoveConfirmOpen(true)} className="border-red-500/20 text-red-300 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4 mr-2" /> Remover
            </Button>
          </div>
          <p className="text-center text-[11px] text-zinc-600">Origem: {value.origin === "library" ? "Biblioteca" : "Galeria"}</p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto bg-[#111111] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Buscar na biblioteca</DialogTitle>
          </DialogHeader>
          <Button type="button" variant="ghost" onClick={() => setLibraryOpen(false)} className="w-fit px-0 text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          {loadingLibrary ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando imagens...</div>
          ) : assets.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">Nenhuma imagem disponível na Biblioteca.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {assets.map(({ project, asset }, index) => (
                <button
                  key={`${project.id}-${asset.conceptIndex}-${index}`}
                  type="button"
                  onClick={() => {
                    selectSource({ base64: asset.base64, mimeType: inferMime(asset.label), name: asset.label || project.title, origin: "library" });
                    setLibraryOpen(false);
                  }}
                  className="overflow-hidden rounded-lg border border-white/10 bg-black text-left hover:border-primary/40 transition-colors"
                >
                  <div className="aspect-square overflow-hidden"><img src={`data:${inferMime(asset.label)};base64,${asset.base64}`} alt={asset.label} className="w-full h-full object-cover" /></div>
                  <div className="p-2"><p className="text-xs text-zinc-300 truncate">{asset.label || project.title}</p></div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent className="max-w-sm bg-[#111111] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar remoção</DialogTitle>
          </DialogHeader>
          <Button type="button" onClick={confirmRemoveSource} className="w-full">
            Continuar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
