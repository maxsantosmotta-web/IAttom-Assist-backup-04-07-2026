import { useRef, useState } from "react";
import { ArrowLeft, Image as ImageIcon, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { loadProjectAssets } from "@/lib/assetStorage";
import { useSavedItems, type AssetData, type SavedItemRecord } from "@/hooks/useSavedItems";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export interface PromptImageReference {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
  name: string;
  origin: "gallery" | "library";
}

interface PromptImageReferencePickerProps {
  value: PromptImageReference | null;
  onChange: (value: PromptImageReference | null) => void;
  disabled?: boolean;
}

function stripDataUrl(value: string): { base64: string; mimeType: "image/png" | "image/jpeg" } | null {
  const match = value.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/i);
  if (!match) return null;
  return {
    base64: match[2],
    mimeType: match[1].toLowerCase() as "image/png" | "image/jpeg",
  };
}

function inferMime(label: string): "image/png" | "image/jpeg" {
  return /\.jpe?g$/i.test(label) ? "image/jpeg" : "image/png";
}

export function PromptImageReferencePicker({ value, onChange, disabled = false }: PromptImageReferencePickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [choosingSource, setChoosingSource] = useState(false);
  const [assets, setAssets] = useState<Array<{ project: SavedItemRecord; asset: AssetData }>>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [error, setError] = useState("");
  const { getItems, getItemAssets } = useSavedItems();

  const selectSource = (next: PromptImageReference) => {
    setError("");
    setChoosingSource(false);
    onChange(next);
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
      const items = (await getItems()).filter((item) => !item.deletedAt);
      const loaded = await Promise.all(items.map(async (project) => {
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
        return { project, assets: projectAssets };
      }));
      setAssets(loaded.flatMap(({ project, assets: projectAssets }) =>
        projectAssets.map((asset) => ({ project, asset })),
      ));
    } catch {
      setAssets([]);
      setError("Não foi possível carregar as imagens da Biblioteca.");
    } finally {
      setLoadingLibrary(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Imagem-base</Label>

      {!value ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => fileRef.current?.click()} className="border-white/10 bg-[#0a0a0a] text-zinc-300">
            <Upload className="w-4 h-4 mr-2" /> Buscar na galeria
          </Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => void openLibrary()} className="border-white/10 bg-[#0a0a0a] text-zinc-300">
            <ImageIcon className="w-4 h-4 mr-2" /> Buscar na biblioteca
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-white/10 bg-black">
            <img src={`data:${value.mimeType};base64,${value.base64}`} alt="Prévia da imagem-base" className="w-full h-auto object-contain" />
          </div>

          {choosingSource ? (
            <div className="space-y-3">
              {value.origin === "gallery" ? (
                <Button type="button" variant="outline" disabled={disabled} onClick={() => void openLibrary()} className="w-full border-white/10 bg-[#0a0a0a] text-zinc-300">
                  <ImageIcon className="w-4 h-4 mr-2" /> Buscar na biblioteca
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled={disabled} onClick={() => fileRef.current?.click()} className="w-full border-white/10 bg-[#0a0a0a] text-zinc-300">
                  <Upload className="w-4 h-4 mr-2" /> Buscar na galeria
                </Button>
              )}
              <Button type="button" variant="ghost" disabled={disabled} onClick={() => setChoosingSource(false)} className="w-full text-zinc-400 hover:text-zinc-200">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setChoosingSource(true)} className="border-white/10 text-zinc-300">
                <RefreshCw className="w-4 h-4 mr-2" /> Trocar
              </Button>
              <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange(null)} className="border-white/10 text-zinc-300 hover:bg-white/5">
                <X className="w-4 h-4 mr-2" /> Remover
              </Button>
            </div>
          )}

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

      <Dialog open={libraryOpen} onOpenChange={(open) => { setLibraryOpen(open); if (!open) setError(""); }}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto bg-[#111111] border-white/10">
          <div className="flex items-center justify-between">
            <strong className="text-white">Buscar na biblioteca</strong>
            <button type="button" onClick={() => setLibraryOpen(false)} className="text-zinc-400 hover:text-white">×</button>
          </div>
          <Button type="button" variant="ghost" onClick={() => setLibraryOpen(false)} className="w-fit px-0 text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>

          {loadingLibrary ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando imagens...
            </div>
          ) : assets.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">Nenhuma imagem disponível na Biblioteca.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {assets.map(({ project, asset }, index) => (
                <button
                  key={`${project.id}-${asset.conceptIndex}-${index}`}
                  type="button"
                  onClick={() => {
                    selectSource({
                      base64: asset.base64,
                      mimeType: inferMime(asset.label),
                      name: asset.label || project.title,
                      origin: "library",
                    });
                    setLibraryOpen(false);
                  }}
                  className="overflow-hidden rounded-lg border border-white/10 bg-black text-left hover:border-primary/40 transition-colors"
                >
                  <div className="aspect-square overflow-hidden">
                    <img src={`data:${inferMime(asset.label)};base64,${asset.base64}`} alt={asset.label} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-zinc-300 truncate">{asset.label || project.title}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
