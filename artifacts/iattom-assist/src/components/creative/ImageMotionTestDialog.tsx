import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ImageMotionTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MotionFormat = "feed" | "story";
type GenerationState = "idle" | "submitting" | "processing" | "done" | "error";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const POLL_INTERVAL_MS = 5_000;
const POLL_LIMIT = 120;

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export function ImageMotionTestDialog({ open, onOpenChange }: ImageMotionTestDialogProps) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState<MotionFormat>("feed");
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<GenerationState>("idle");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) cancelledRef.current = true;
    if (open) cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, [open]);

  const resetResult = () => {
    setState("idle");
    setStatusText("");
    setError("");
    setVideoUrl("");
  };

  const handleFile = (file: File | undefined) => {
    resetResult();
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Envie uma imagem PNG, JPG ou JPEG.");
      setState("error");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("A imagem deve ter no máximo 8 MB.");
      setState("error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setImageDataUrl(reader.result);
      setFileName(file.name);
      setError("");
      setState("idle");
    };
    reader.onerror = () => {
      setError("Não foi possível ler a imagem.");
      setState("error");
    };
    reader.readAsDataURL(file);
  };

  const pollUntilComplete = async (requestId: string): Promise<void> => {
    for (let attempt = 0; attempt < POLL_LIMIT; attempt++) {
      if (cancelledRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      if (cancelledRef.current) return;

      const response = await fetch(`/api/image-motion/status/${requestId}`, { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response, "Falha ao consultar o processamento."));
      const payload = await response.json() as {
        status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
        queuePosition?: number;
        error?: string;
      };

      if (payload.error) throw new Error(payload.error);
      if (payload.status === "IN_QUEUE") {
        setStatusText(typeof payload.queuePosition === "number" ? `Na fila: posição ${payload.queuePosition}` : "Na fila de processamento...");
        continue;
      }
      if (payload.status === "IN_PROGRESS") {
        setStatusText("Aplicando os efeitos em movimento...");
        continue;
      }
      if (payload.status === "COMPLETED") {
        const resultResponse = await fetch(`/api/image-motion/result/${requestId}`, { credentials: "include" });
        if (!resultResponse.ok) throw new Error(await readError(resultResponse, "Falha ao recuperar o vídeo."));
        const result = await resultResponse.json() as { videoUrl?: unknown };
        if (typeof result.videoUrl !== "string" || !result.videoUrl) throw new Error("O vídeo foi concluído, mas o arquivo não foi retornado.");
        setVideoUrl(result.videoUrl);
        setState("done");
        setStatusText("Vídeo concluído.");
        return;
      }
    }
    throw new Error("O processamento ultrapassou o tempo de espera. A solicitação pode continuar na fila da IA.");
  };

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (!imageDataUrl) {
      setError("Escolha uma imagem antes de gerar.");
      setState("error");
      return;
    }
    if (!cleanPrompt) {
      setError("Descreva o efeito em movimento desejado.");
      setState("error");
      return;
    }

    setError("");
    setVideoUrl("");
    setState("submitting");
    setStatusText("Enviando imagem para a nova IA...");
    cancelledRef.current = false;

    try {
      const response = await fetch("/api/image-motion/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl, prompt: cleanPrompt, format }),
      });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível iniciar a geração."));
      const payload = await response.json() as { requestId?: unknown };
      if (typeof payload.requestId !== "string" || !payload.requestId) throw new Error("A nova IA não retornou o identificador da solicitação.");

      setState("processing");
      setStatusText("Processamento iniciado...");
      await pollUntilComplete(payload.requestId);
    } catch (generationError) {
      if (cancelledRef.current) return;
      setError(generationError instanceof Error ? generationError.message : "Não foi possível gerar o vídeo.");
      setState("error");
      setStatusText("");
    }
  };

  const isBusy = state === "submitting" || state === "processing";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!isBusy) onOpenChange(nextOpen); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-[#111111] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Vídeo com Imagem — teste administrativo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-zinc-400">
            Arquitetura de teste isolada. O prompt será enviado exatamente como digitado, sem melhoria automática nesta fase. Duração fixa: 6 segundos, 720p e sem áudio.
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Imagem base</Label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-[#0a0a0a] px-4 py-4 text-sm text-zinc-400 hover:border-primary/40 hover:text-zinc-200">
              <Upload className="h-4 w-4" />
              {fileName || "Escolher imagem PNG, JPG ou JPEG"}
              <input
                type="file"
                accept="image/png,image/jpeg,.jpg,.jpeg,.png"
                className="hidden"
                disabled={isBusy}
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </label>
          </div>

          {imageDataUrl && (
            <div className={`mx-auto overflow-hidden rounded-xl border border-white/10 bg-black ${format === "story" ? "max-w-[280px] aspect-[9/16]" : "max-w-[440px] aspect-[4/5]"}`}>
              <img src={imageDataUrl} alt="Prévia da imagem enviada" className="h-full w-full object-cover" />
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">Formato</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["feed", "story"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isBusy}
                  onClick={() => { setFormat(option); resetResult(); }}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    format === option
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-white/10 bg-[#0a0a0a] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                  }`}
                >
                  {option === "feed" ? "Feed" : "Story"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Descreva o efeito em movimento desejado</Label>
            <Input
              value={prompt}
              disabled={isBusy}
              maxLength={1200}
              onChange={(event) => { setPrompt(event.target.value); resetResult(); }}
              placeholder="Ex: fumaça acinzentada saindo dos pés e se espalhando suavemente"
              className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
            />
            <p className="text-[11px] text-zinc-600">Nesta primeira fase, o texto não será reescrito ou melhorado pelo IAttom.</p>
          </div>

          {isBusy && (
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 py-4 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {statusText || "Processando..."}
            </div>
          )}

          {state === "error" && error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>
          )}

          {state === "done" && videoUrl && (
            <div className="space-y-3">
              <video src={videoUrl} controls playsInline className={`mx-auto w-full rounded-xl border border-white/10 bg-black ${format === "story" ? "max-w-[320px] aspect-[9/16]" : "max-w-[520px]"}`} />
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" download="iattom-video-com-imagem.mp4">
                <Button type="button" variant="outline" className="w-full border-white/10 text-zinc-300">
                  <Download className="mr-2 h-4 w-4" /> Baixar vídeo
                </Button>
              </a>
            </div>
          )}

          <Button
            type="button"
            disabled={isBusy || !imageDataUrl || !prompt.trim()}
            onClick={handleGenerate}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : imageDataUrl ? <Sparkles className="mr-2 h-4 w-4" /> : <ImageIcon className="mr-2 h-4 w-4" />}
            {isBusy ? "Gerando vídeo..." : "Gerar teste de 6 segundos"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
