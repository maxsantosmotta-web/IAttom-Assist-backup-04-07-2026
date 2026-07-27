import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, RefreshCw, Save, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSavedItems } from "@/hooks/useSavedItems";
import type { ImageMotionSource } from "@/components/creative/ImageMotionSourcePicker";

type MotionFormat = "vertical" | "horizontal" | "automatic" | "feed" | "story";
type Phase = "idle" | "submitting" | "processing" | "done" | "error";

type MotionResult = {
  format: MotionFormat;
  videoUrl: string;
  contentType?: string;
  fileName?: string;
  fileSize?: number;
};

type PendingRequest = { requestId: string; format: MotionFormat };

type PersistedState = {
  phase: Phase;
  pending: PendingRequest[];
  results: MotionResult[];
  error: string;
};

const STORAGE_KEY = "iattom_image_motion_execution_v1";
const POLL_INTERVAL_MS = 4_000;
const MAX_POLL_ATTEMPTS = 150;

interface ImageMotionExecutionProps {
  source: ImageMotionSource | null;
  prompt: string;
  platform: string;
  formats: string[];
  onNew: () => void;
}

function asMotionFormats(formats: string[]): MotionFormat[] {
  const normalized = formats.map((format): MotionFormat => {
    if (format === "stories" || format === "story" || format === "vertical") return "vertical";
    if (format === "banner" || format === "horizontal") return "horizontal";
    return "automatic";
  });
  return Array.from(new Set(normalized));
}

function formatLabel(format: MotionFormat): string {
  if (format === "vertical" || format === "story") return "Vertical";
  if (format === "horizontal") return "Horizontal";
  return "Automático";
}

function videoAspectClass(format: MotionFormat): string {
  if (format === "vertical" || format === "story") return "w-full aspect-[9/16] bg-black object-contain";
  if (format === "horizontal") return "w-full aspect-video bg-black object-contain";
  return "w-full bg-black object-contain";
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export function ImageMotionExecution({ source, prompt, platform, formats, onNew }: ImageMotionExecutionProps) {
  const { toast } = useToast();
  const { saveItem, saveItemVideoAssets } = useSavedItems();
  const mountedRef = useRef(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [results, setResults] = useState<MotionResult[]>([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const motionFormats = useMemo(() => asMotionFormats(formats), [formats]);
  const canGenerate = Boolean(source && prompt.trim() && platform && motionFormats.length > 0 && phase !== "submitting" && phase !== "processing");

  useEffect(() => {
    mountedRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedState;
        setPhase(saved.phase === "submitting" ? "processing" : saved.phase);
        setPending(Array.isArray(saved.pending) ? saved.pending : []);
        setResults(Array.isArray(saved.results) ? saved.results : []);
        setError(saved.error || "");
      }
    } catch { /* ignore */ }
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ phase, pending, results, error } satisfies PersistedState));
    } catch { /* ignore */ }
  }, [phase, pending, results, error]);

  const pollRequest = async (item: PendingRequest): Promise<MotionResult> => {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const statusResponse = await fetch(`/api/image-motion/status/${encodeURIComponent(item.requestId)}`, { credentials: "include" });
      if (!statusResponse.ok) throw new Error(await readError(statusResponse, "Não foi possível consultar o processamento."));
      const status = await statusResponse.json() as { status?: string; error?: string };
      if (status.error) throw new Error(status.error);
      if (status.status === "COMPLETED") {
        const resultResponse = await fetch(`/api/image-motion/result/${encodeURIComponent(item.requestId)}`, { credentials: "include" });
        if (!resultResponse.ok) throw new Error(await readError(resultResponse, "Não foi possível recuperar o vídeo gerado."));
        const result = await resultResponse.json() as Omit<MotionResult, "format">;
        if (!result.videoUrl) throw new Error("A IA não retornou o arquivo do vídeo.");
        return { ...result, format: item.format };
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error("A geração excedeu o tempo de espera. O processo foi preservado para nova consulta.");
  };

  const resumePending = async (requests: PendingRequest[]) => {
    if (requests.length === 0) return;
    setPhase("processing");
    setError("");
    try {
      const completed = await Promise.all(requests.map(pollRequest));
      if (!mountedRef.current) return;
      setResults(completed);
      setPending([]);
      setPhase("done");
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a geração.");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (pending.length > 0 && phase === "processing") void resumePending(pending);
    // Executa apenas quando uma fila persistida é restaurada ou criada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.map((item) => item.requestId).join("|")]);

  const generate = async () => {
    if (!source || !canGenerate) return;
    setPhase("submitting");
    setError("");
    setResults([]);
    try {
      const imageDataUrl = `data:${source.mimeType};base64,${source.base64}`;
      const submitted: PendingRequest[] = [];
      for (const format of motionFormats) {
        const response = await fetch("/api/image-motion/submit", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl, prompt: prompt.trim(), format }),
        });
        if (!response.ok) throw new Error(await readError(response, "Não foi possível enviar a imagem para processamento."));
        const body = await response.json() as { requestId?: string };
        if (!body.requestId) throw new Error("O servidor não retornou o identificador da geração.");
        submitted.push({ requestId: body.requestId, format });
      }
      setPending(submitted);
      setPhase("processing");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a geração.");
      setPhase("error");
    }
  };

  const save = async () => {
    if (results.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const id = crypto.randomUUID();
      const platformLabel = platform || "Plataforma";
      const title = `Vídeo com imagem — ${platformLabel}`;
      const data = JSON.stringify({
        type: "image-motion-video",
        provider: "fal",
        durationSeconds: 6,
        resolution: "720p",
        audio: false,
        prompt: prompt.trim(),
        platform,
        results,
        generatedAt: new Date().toISOString(),
      });
      await saveItem({
        id,
        title,
        type: "creative",
        content: `Tipo: Vídeo com imagem | Plataforma: ${platformLabel} | Formatos: ${motionFormats.map(formatLabel).join(", ")} | Prompt: ${prompt.trim()}`,
        data,
        hasImages: false,
      });
      await saveItemVideoAssets(id, results.map((result, index) => ({
        videoUrl: result.videoUrl,
        title: `Vídeo ${formatLabel(result.format)}`,
        durationSeconds: 6,
        savedAt: new Date().toISOString(),
        provider: "fal",
        videoEstilo: "movimento de imagem",
        videoAvatar: result.fileName || `formato-${index + 1}`,
      })));
      toast({ description: "Vídeo salvo na Biblioteca." });
    } catch {
      toast({ description: "Não foi possível salvar o vídeo.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const downloadAll = async () => {
    if (results.length === 0 || isDownloading) return;
    setIsDownloading(true);
    try {
      for (const [index, result] of results.entries()) {
        const response = await fetch(result.videoUrl);
        if (!response.ok) throw new Error("download failed");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = result.fileName || `iattom-video-${result.format}-${index + 1}.mp4`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      toast({ description: "Não foi possível baixar o vídeo.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const resetAll = () => {
    setPhase("idle");
    setPending([]);
    setResults([]);
    setError("");
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    onNew();
  };

  return (
    <div className="space-y-4">
      {phase !== "done" && (
        <Button
          type="button"
          onClick={() => void generate()}
          disabled={!canGenerate}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary disabled:text-primary-foreground disabled:opacity-40"
        >
          {phase === "submitting" || phase === "processing" ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando vídeo...</>
          ) : (
            <><Video className="w-4 h-4 mr-2" /> Gerar Vídeo</>
          )}
        </Button>
      )}

      {(phase === "submitting" || phase === "processing") && (
        <p className="text-center text-xs text-zinc-500">Processando {motionFormats.length > 1 ? `${motionFormats.length} formatos` : "o vídeo"}. Não feche esta operação.</p>
      )}

      {phase === "error" && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-3">
          <p className="text-sm text-red-300">{error}</p>
          <div className="flex gap-2">
            {pending.length > 0 && <Button type="button" variant="outline" onClick={() => void resumePending(pending)}><RefreshCw className="w-4 h-4 mr-2" /> Consultar novamente</Button>}
            <Button type="button" variant="outline" onClick={resetAll}>Novo</Button>
          </div>
        </div>
      )}

      {phase === "done" && results.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((result) => (
              <Card key={`${result.format}-${result.videoUrl}`} className="overflow-hidden border-white/10 bg-[#111111]">
                <video src={result.videoUrl} controls playsInline className={videoAspectClass(result.format)} />
                <CardContent className="p-3"><p className="text-xs text-zinc-400">{formatLabel(result.format)} · 6 segundos · 720p · sem áudio</p></CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button type="button" variant="outline" onClick={() => void save()} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar</Button>
            <Button type="button" variant="outline" onClick={() => void downloadAll()} disabled={isDownloading}>{isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Baixar</Button>
            <Button type="button" variant="outline" onClick={resetAll}><RefreshCw className="w-4 h-4 mr-2" />Novo</Button>
          </div>
        </div>
      )}
    </div>
  );
}
