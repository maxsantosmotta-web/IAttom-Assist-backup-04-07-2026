import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, RefreshCw, AlertCircle, Image, Save, Download, Video, ChevronRight } from "lucide-react";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { saveProjectAssets } from "@/lib/assetStorage";
import { useSavedItems, type SavedItemRecord } from "@/hooks/useSavedItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import type { CreativeIdeasResult, CreativeConcept, VideoGenerationResult } from "@/types/ai";
import type { FeatureKey } from "@/lib/credits";

type CreativeType = "image" | "video";
type PlatformKey = "instagram" | "facebook" | "tiktok" | "mercado_livre" | "shopee" | "hotmart" | "kiwify" | "perfil";
type VideoEstilo = "executivo" | "consultor" | "criador";
type VideoFormato = "9:16" | "1:1" | "16:9";
type VideoDuration = 20 | 40 | 60;

const MAX_FORMATS = 3;

const PLATFORMS: {
  key: PlatformKey;
  label: string;
  formats: { key: string; label: string }[];
}[] = [
  { key: "instagram",     label: "Instagram",    formats: [{ key: "feed", label: "Feed" }, { key: "stories", label: "Stories" }] },
  { key: "facebook",      label: "Facebook",      formats: [{ key: "feed", label: "Feed" }, { key: "stories", label: "Stories" }, { key: "banner", label: "Banner" }] },
  { key: "tiktok",        label: "TikTok",        formats: [{ key: "feed", label: "Feed" }, { key: "stories", label: "Stories" }] },
  { key: "mercado_livre", label: "Mercado Livre", formats: [{ key: "produto", label: "Produto" }, { key: "banner", label: "Banner" }] },
  { key: "shopee",        label: "Shopee",        formats: [{ key: "produto", label: "Produto" }, { key: "banner", label: "Banner" }] },
  { key: "hotmart",       label: "Hotmart",       formats: [{ key: "capa", label: "Capa" }, { key: "banner", label: "Banner" }] },
  { key: "kiwify",        label: "Kiwify",        formats: [{ key: "capa", label: "Capa" }, { key: "banner", label: "Banner" }] },
  { key: "perfil",        label: "Perfil",        formats: [{ key: "perfil", label: "Perfil" }] },
];

const VIDEO_ESTILOS: { key: VideoEstilo; label: string; desc: string }[] = [
  { key: "executivo", label: "Executivo",  desc: "Tom corporativo, roupa social, autoridade" },
  { key: "consultor", label: "Consultor",  desc: "Tom explicativo, especialista, orientador" },
  { key: "criador",   label: "Criador",    desc: "Tom dinâmico, influenciador, apresentador" },
];

const VIDEO_AMBIENTES: { key: string; label: string }[] = [
  { key: "corporativo",  label: "Corporativo" },
  { key: "casa",         label: "Casa" },
  { key: "loja",         label: "Loja" },
  { key: "shopping",     label: "Shopping" },
  { key: "restaurante",  label: "Restaurante" },
  { key: "rua",          label: "Rua" },
  { key: "praia",        label: "Praia" },
  { key: "parque",       label: "Parque" },
  { key: "veiculo",      label: "Veículo" },
  { key: "consultorio",  label: "Consultório" },
  { key: "estudio",      label: "Estúdio / Podcast" },
];

const VIDEO_FORMATOS: { key: VideoFormato; label: string }[] = [
  { key: "9:16", label: "Reels / Stories" },
  { key: "1:1",  label: "Feed" },
  { key: "16:9", label: "YouTube / Apresentação" },
];

const VIDEO_DURACOES: { key: VideoDuration; label: string }[] = [
  { key: 20, label: "20 segundos" },
  { key: 40, label: "40 segundos" },
  { key: 60, label: "60 segundos" },
];

function formatToAspectClass(format: string): string {
  if (format === "stories" || format === "vertical") return "aspect-[9/16]";
  if (format === "banner") return "aspect-[16/9]";
  return "aspect-square";
}

function downloadImage(base64: string, filename: string) {
  const a = document.createElement("a");
  a.href = `data:image/png;base64,${base64}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function estiloLabel(estilo: string): string {
  return VIDEO_ESTILOS.find((e) => e.key === estilo)?.label ?? estilo;
}

function ambienteLabel(amb: string): string {
  return VIDEO_AMBIENTES.find((a) => a.key === amb)?.label ?? amb.charAt(0).toUpperCase() + amb.slice(1);
}

function formatoLabel(fmt: string): string {
  return VIDEO_FORMATOS.find((f) => f.key === fmt)?.label ?? fmt;
}

function VideoResultCard({
  result,
  onSave,
  isSaving,
  onReset,
  saved,
}: {
  result: VideoGenerationResult;
  onSave: () => void;
  isSaving: boolean;
  onReset: () => void;
  saved?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Vídeo Gerado
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={isSaving || saved}
            className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {isSaving ? "Salvando..." : saved ? "Salvo" : "Salvar"}
          </button>
          <button
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Gerar novamente
          </button>
        </div>
      </div>

      <Card className="bg-[#111111] border-white/5 overflow-hidden">
        {result.isMock ? (
          <div className="aspect-video bg-[#0a0a0a] flex flex-col items-center justify-center gap-3 border-b border-white/5">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs text-zinc-500 text-center max-w-xs px-4">
              Modo demonstração — configure HeyGen para gerar vídeos reais
            </p>
          </div>
        ) : result.videoUrl ? (
          <video
            src={result.videoUrl}
            controls
            playsInline
            className="w-full aspect-video bg-black"
          />
        ) : (
          <div className="aspect-video bg-[#0a0a0a] flex flex-col items-center justify-center gap-3 border-b border-white/5">
            <Video className="w-6 h-6 text-zinc-600" />
            <p className="text-xs text-zinc-600 text-center max-w-xs px-4">
              URL do vídeo não disponível
            </p>
          </div>
        )}

        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                  {estiloLabel(result.videoEstilo)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                  {ambienteLabel(result.videoAmbiente)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                  {result.videoAvatar === "masculino" ? "Masculino" : "Feminino"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                  {formatoLabel(result.videoFormato ?? "16:9")}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                  {result.durationSeconds}s
                </span>
              </div>
              <p className="text-xs text-zinc-600 truncate max-w-xs">{result.prompt}</p>
            </div>
            {!result.isMock && result.videoUrl && (
              <a
                href={result.videoUrl}
                download="iattom-video.mp4"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar
              </a>
            )}
          </div>
          {!result.isMock && result.videoUrl && (
            <p className="text-xs text-amber-500/70">
              Faça o download agora — o link expira em alguns dias.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ConceptCard({ concept, index }: { concept: CreativeConcept; index: number }) {
  const aspectClass = formatToAspectClass(concept.format ?? "feed");
  const filename = `${concept.label.replace(/[\s/]+/g, "-").toLowerCase()}.png`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
      <Card className="bg-[#111111] border-white/5 hover:border-primary/20 transition-colors overflow-hidden">
        {concept.imageBase64 ? (
          <div className={`relative bg-black overflow-hidden w-full ${aspectClass}`}>
            <img
              src={`data:image/png;base64,${concept.imageBase64}`}
              alt={concept.label}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={`w-full ${aspectClass} bg-gradient-to-br from-white/[0.03] to-transparent flex items-center justify-center`}>
            <Image className="w-8 h-8 text-white/20" />
          </div>
        )}
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest truncate">{concept.label}</p>
          {concept.imageBase64 && (
            <button
              onClick={() => downloadImage(concept.imageBase64!, filename)}
              className="text-muted-foreground hover:text-white transition-colors shrink-0"
              title="Baixar imagem"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function CreativeGenerator() {
  const [creativeType, setCreativeType] = useState<CreativeType>("image");
  const [platform, setPlatform] = useState<PlatformKey | "">("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [restoredResult, setRestoredResult] = useState<CreativeIdeasResult | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogStep, setSaveDialogStep] = useState<"choose" | "pick-project" | "confirm-replace">("choose");
  const [existingProjects, setExistingProjects] = useState<SavedItemRecord[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Video state
  const [videoEstilo, setVideoEstilo] = useState<VideoEstilo>("executivo");
  const [videoAvatar, setVideoAvatar] = useState<"masculino" | "feminino">("masculino");
  const [videoAmbiente, setVideoAmbiente] = useState<string>("corporativo");
  const [videoFormato, setVideoFormato] = useState<VideoFormato>("16:9");
  const [videoDuration, setVideoDuration] = useState<VideoDuration>(20);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [restoredVideoResult, setRestoredVideoResult] = useState<VideoGenerationResult | null>(null);

  const { status, result, error, generate, reset } = useAiStream<CreativeIdeasResult>();
  const {
    status: videoStatus,
    result: videoResult,
    error: videoError,
    generate: videoGenerate,
    reset: videoReset,
  } = useAiStream<VideoGenerationResult>();
  const [videoIsSaving, setVideoIsSaving] = useState(false);
  const [videoAutoSaved, setVideoAutoSaved] = useState(false);
  const { toast } = useToast();
  const { saveItem, saveItemAssets, getItems } = useSavedItems();
  const { isFetching: fetchingCredits, refetch: refetchCredits } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), staleTime: 0 },
  });

  const refundCalledRef = useRef(false);
  const chargedFeatureRef = useRef<FeatureKey>("creativeImage1");
  const videoRefundCalledRef = useRef(false);
  const videoChargedFeatureRef = useRef<FeatureKey>("creativeVideo20");
  const autoVideoSavedRef = useRef(false);

  useEffect(() => {
    if (status === "error" && !refundCalledRef.current) {
      refundCalledRef.current = true;
      fetch("/api/credits/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: chargedFeatureRef.current }),
        credentials: "include",
      }).catch(() => {});
    }
    if (status === "idle" || status === "generating") {
      refundCalledRef.current = false;
    }
  }, [status]);

  useEffect(() => {
    if (videoStatus === "error" && !videoRefundCalledRef.current) {
      videoRefundCalledRef.current = true;
      fetch("/api/credits/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: videoChargedFeatureRef.current }),
        credentials: "include",
      }).catch(() => {});
    }
    if (videoStatus === "idle" || videoStatus === "generating") {
      videoRefundCalledRef.current = false;
    }
  }, [videoStatus]);

  // Auto-save vídeo ao concluir geração
  useEffect(() => {
    if (videoStatus === "idle" || videoStatus === "generating") {
      autoVideoSavedRef.current = false;
      if (videoStatus === "idle") setVideoAutoSaved(false);
      return;
    }
    if (
      videoStatus !== "done" ||
      !videoResult ||
      videoResult.isMock ||
      !videoResult.videoUrl ||
      autoVideoSavedRef.current
    ) return;

    autoVideoSavedRef.current = true;
    const vr = videoResult;

    const content = [
      `Tipo: Vídeo`,
      `Estilo: ${estiloLabel(vr.videoEstilo)}`,
      `Personagem: ${vr.videoAvatar === "masculino" ? "Masculino" : "Feminino"}`,
      `Ambiente: ${ambienteLabel(vr.videoAmbiente)}`,
      `Formato: ${formatoLabel(vr.videoFormato ?? "16:9")}`,
      `Duração: ${vr.durationSeconds}s`,
      `Prompt: ${vr.prompt}`,
    ].join(" | ");

    const data = JSON.stringify({
      type: "video",
      videoEstilo: vr.videoEstilo,
      videoAvatar: vr.videoAvatar,
      videoAmbiente: vr.videoAmbiente,
      videoFormato: vr.videoFormato ?? "16:9",
      videoDuration: vr.durationSeconds,
      prompt: vr.prompt,
      videoUrl: vr.videoUrl,
      durationSeconds: vr.durationSeconds,
      generatedAt: vr.generatedAt,
      isMock: vr.isMock,
    });

    const projectId = crypto.randomUUID();
    const title = `Vídeo ${estiloLabel(vr.videoEstilo)} — ${vr.prompt.slice(0, 50) || "Criativo"}`;

    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift({
        id: projectId, title, type: "creative", content, data, hasImages: false,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
    } catch { /* ignore */ }

    saveItem({ id: projectId, title, type: "creative", content, data, hasImages: false })
      .then(() => {
        setVideoAutoSaved(true);
        toast({ description: "Vídeo salvo em Projetos." });
      })
      .catch(() => {
        autoVideoSavedRef.current = false;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoStatus, videoResult]);

  useEffect(() => { setSelectedFormats([]); }, [platform]);

  // Prefill a partir do módulo Campanha
  useEffect(() => {
    const saved = sessionStorage.getItem("iattom_creative_prefill");
    if (saved) {
      try {
        const d = JSON.parse(saved) as { prompt?: string };
        if (d.prompt) setPrompt(d.prompt);
      } catch { /* ignore */ }
      sessionStorage.removeItem("iattom_creative_prefill");
    }
  }, []);

  // Restaurar de Projetos Salvos
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("iattom_restore_creative_v1");
      if (!raw) return;
      sessionStorage.removeItem("iattom_restore_creative_v1");
      const saved = JSON.parse(raw) as {
        type?: string;
        briefing?: {
          prompt?: string;
          platform?: string;
          selectedFormats?: string[];
        };
        result?: unknown;
        // video fields
        videoEstilo?: string;
        videoAvatar?: string;
        videoAmbiente?: string;
        videoFormato?: string;
        videoDuration?: number;
        prompt?: string;
        videoUrl?: string;
        durationSeconds?: number;
        generatedAt?: string;
        isMock?: boolean;
      };

      if (saved.type === "video") {
        // Restaurar vídeo salvo
        setCreativeType("video");
        if (saved.videoEstilo && ["executivo", "consultor", "criador"].includes(saved.videoEstilo)) {
          setVideoEstilo(saved.videoEstilo as VideoEstilo);
        }
        if (saved.videoAvatar && ["masculino", "feminino"].includes(saved.videoAvatar)) {
          setVideoAvatar(saved.videoAvatar as "masculino" | "feminino");
        }
        if (saved.videoAmbiente) setVideoAmbiente(saved.videoAmbiente);
        if (saved.videoFormato && ["9:16", "1:1", "16:9"].includes(saved.videoFormato)) {
          setVideoFormato(saved.videoFormato as VideoFormato);
        }
        if (saved.videoDuration && [20, 40, 60].includes(saved.videoDuration as number)) {
          setVideoDuration(saved.videoDuration as VideoDuration);
        }
        if (saved.prompt) setVideoPrompt(saved.prompt);
        if (saved.videoUrl !== undefined) {
          setRestoredVideoResult({
            videoUrl: saved.videoUrl ?? "",
            durationSeconds: saved.durationSeconds ?? 20,
            videoEstilo: (saved.videoEstilo as VideoEstilo) ?? "executivo",
            videoAvatar: (saved.videoAvatar as "masculino" | "feminino") ?? "masculino",
            videoAmbiente: saved.videoAmbiente ?? "",
            videoFormato: (saved.videoFormato as VideoFormato) ?? "16:9",
            prompt: saved.prompt ?? "",
            generatedAt: saved.generatedAt ?? "",
            isMock: saved.isMock ?? false,
          });
        }
        return;
      }

      // Restaurar imagem criativa
      if (saved.briefing?.prompt) setPrompt(saved.briefing.prompt);
      const savedPlatform = saved.briefing?.platform;
      if (savedPlatform && PLATFORMS.some((p) => p.key === savedPlatform)) {
        setPlatform(savedPlatform as PlatformKey);
      }
      if (Array.isArray(saved.briefing?.selectedFormats)) {
        setSelectedFormats((saved.briefing.selectedFormats as string[]).slice(0, MAX_FORMATS));
      }
      if (saved.result && typeof saved.result === "object" && "concepts" in (saved.result as object)) {
        setRestoredResult(saved.result as CreativeIdeasResult);
      }
    } catch { /* ignore */ }
  }, []);

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";
  const isRestoredMode = !!restoredResult && status === "idle";
  const activeResult = result ?? restoredResult;

  const featureKey: FeatureKey =
    selectedFormats.length <= 1 ? "creativeImage1" :
    selectedFormats.length === 2 ? "creativeImage2" :
    "creativeImage3";

  const toggleFormat = (fmt: string) => {
    setSelectedFormats((prev) => {
      if (prev.includes(fmt)) return prev.filter((f) => f !== fmt);
      if (prev.length >= MAX_FORMATS) return prev;
      return [...prev, fmt];
    });
  };

  const canGenerate = !!prompt.trim() && !!platform && selectedFormats.length > 0;

  const runGenerate = (charge: () => void) => {
    chargedFeatureRef.current = featureKey;
    generate("/api/ai/creative-ideas", {
      prompt,
      platform,
      selectedFormats,
    }).then((res) => {
      if (res !== null) charge();
    });
  };

  const handleSave = () => {
    if (!activeResult || isSaving) return;
    if (!Array.isArray(activeResult.concepts)) return;
    setSaveDialogOpen(true);
    setSaveDialogStep("choose");
    setSelectedProjectId(null);
  };

  const doSaveNew = async () => {
    if (!activeResult || isSaving) return;
    const concepts = activeResult.concepts;
    if (!Array.isArray(concepts)) return;
    setSaveDialogOpen(false);
    setIsSaving(true);

    const platformLabel = PLATFORMS.find((p) => p.key === platform)?.label ?? String(platform);
    const content = [
      `Tipo: Imagem`,
      `Plataforma: ${platformLabel}`,
      `Formatos: ${selectedFormats.join(", ")}`,
      `Prompt: ${prompt.trim()}`,
    ].join(" | ");

    const resultWithoutImages: CreativeIdeasResult = {
      ...activeResult,
      concepts: concepts.map(({ imageBase64: _removed, ...rest }) => rest),
    };

    const data = JSON.stringify({
      type: "image",
      briefing: { platform, selectedFormats, prompt: prompt.trim() },
      result: resultWithoutImages,
    });

    const projectId = crypto.randomUUID();
    const title = `${platformLabel} — ${prompt.trim().slice(0, 60) || "Criativo"}`;
    const hasImages = concepts.some((c) => !!c.imageBase64);

    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift({
        id: projectId, title, type: "creative", content, data, hasImages,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
    } catch { /* ignore */ }

    const imageAssets = concepts
      .map((c, i) => c.imageBase64
        ? { conceptIndex: i, base64: c.imageBase64, label: c.label ?? `Imagem ${i + 1}`, format: c.format ?? "PNG" }
        : null)
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (imageAssets.length > 0) void saveProjectAssets(projectId, imageAssets);

    try {
      await saveItem({ id: projectId, title, type: "creative", content, data, hasImages });
      if (imageAssets.length > 0) {
        try {
          await saveItemAssets(projectId, imageAssets);
          toast({ description: "Criativo salvo com imagens sincronizadas." });
        } catch {
          toast({ description: "Criativo salvo, mas as imagens não foram sincronizadas.", variant: "destructive" });
        }
      } else {
        toast({ description: "Criativo salvo." });
      }
    } catch {
      toast({ description: "Erro ao salvar. Tente novamente.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const loadExistingProjects = async () => {
    setLoadingProjects(true);
    try {
      const items = await getItems();
      setExistingProjects(items.filter((i) => !i.deletedAt));
    } catch {
      toast({ description: "Erro ao carregar projetos.", variant: "destructive" });
    } finally {
      setLoadingProjects(false);
    }
  };

  const doSaveToExisting = async (projectId: string) => {
    if (!activeResult || isSaving) return;
    const concepts = activeResult.concepts;
    if (!Array.isArray(concepts)) return;
    const imageAssets = concepts
      .map((c, i) => c.imageBase64
        ? { conceptIndex: i, base64: c.imageBase64, label: c.label ?? `Imagem ${i + 1}`, format: c.format ?? "PNG" }
        : null)
      .filter((a): a is NonNullable<typeof a> => a !== null);
    if (imageAssets.length === 0) {
      toast({ description: "Nenhuma imagem disponível para salvar." });
      setSaveDialogOpen(false);
      return;
    }
    setSaveDialogOpen(false);
    setIsSaving(true);
    try {
      await saveItemAssets(projectId, imageAssets);
      void saveProjectAssets(projectId, imageAssets);
      toast({ description: "Imagem adicionada ao projeto." });
    } catch {
      toast({ description: "Erro ao salvar no projeto. Tente novamente.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickExisting = async () => {
    setSaveDialogStep("pick-project");
    await loadExistingProjects();
  };

  const handleSelectProject = (proj: SavedItemRecord) => {
    setSelectedProjectId(proj.id);
    if (proj.hasImages) {
      setSaveDialogStep("confirm-replace");
    } else {
      void doSaveToExisting(proj.id);
    }
  };

  const currentPlatformFormats = platform ? (PLATFORMS.find((p) => p.key === platform)?.formats ?? []) : [];
  const loadingCount = Math.max(selectedFormats.length, 1);
  const resultCount = Array.isArray(activeResult?.concepts) ? activeResult.concepts.length : 0;

  // ── Vídeo ────────────────────────────────────────────────────────────────
  const canGenerateVideo = !!videoPrompt.trim();
  const isVideoGenerating = videoStatus === "generating";
  const isVideoDone = videoStatus === "done";
  const isVideoError = videoStatus === "error";

  const activeVideoResult = videoResult ?? restoredVideoResult;
  const isVideoRestoredMode = !!restoredVideoResult && videoStatus === "idle";

  const runVideoGenerate = (charge: () => void) => {
    setRestoredVideoResult(null);
    videoChargedFeatureRef.current = "creativeVideo20";
    videoGenerate("/api/ai/generate-video", {
      videoEstilo,
      videoAvatar,
      videoAmbiente,
      videoFormato,
      videoDuration,
      videoPrompt: videoPrompt.trim(),
    }).then((res) => {
      if (res !== null) charge();
    });
  };

  const handleSaveVideo = async () => {
    if (!activeVideoResult || videoIsSaving) return;
    setVideoIsSaving(true);

    const content = [
      `Tipo: Vídeo`,
      `Estilo: ${estiloLabel(activeVideoResult.videoEstilo)}`,
      `Personagem: ${activeVideoResult.videoAvatar === "masculino" ? "Masculino" : "Feminino"}`,
      `Ambiente: ${ambienteLabel(activeVideoResult.videoAmbiente)}`,
      `Formato: ${formatoLabel(activeVideoResult.videoFormato ?? "16:9")}`,
      `Duração: ${activeVideoResult.durationSeconds}s`,
      `Prompt: ${activeVideoResult.prompt}`,
    ].join(" | ");

    const data = JSON.stringify({
      type: "video",
      videoEstilo: activeVideoResult.videoEstilo,
      videoAvatar: activeVideoResult.videoAvatar,
      videoAmbiente: activeVideoResult.videoAmbiente,
      videoFormato: activeVideoResult.videoFormato ?? "16:9",
      videoDuration: activeVideoResult.durationSeconds,
      prompt: activeVideoResult.prompt,
      videoUrl: activeVideoResult.videoUrl,
      durationSeconds: activeVideoResult.durationSeconds,
      generatedAt: activeVideoResult.generatedAt,
      isMock: activeVideoResult.isMock,
    });

    const projectId = crypto.randomUUID();
    const title = `Vídeo ${estiloLabel(activeVideoResult.videoEstilo)} — ${activeVideoResult.prompt.slice(0, 50) || "Criativo"}`;

    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift({
        id: projectId, title, type: "creative", content, data, hasImages: false,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
    } catch { /* ignore */ }

    try {
      await saveItem({ id: projectId, title, type: "creative", content, data, hasImages: false });
      setVideoAutoSaved(true);
      toast({ description: "Vídeo salvo em Projetos." });
    } catch {
      toast({ description: "Erro ao salvar. Tente novamente.", variant: "destructive" });
    } finally {
      setVideoIsSaving(false);
    }
  };

  return (
    <>
    <div className="space-y-6">
      {/* Cabeçalho */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Módulo Criativo</p>
          <h2 className="text-2xl font-bold text-white mb-1">Gerador Criativo</h2>
          <p className="text-muted-foreground text-sm">Gere imagens e vídeos prontos para publicação.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refetchCredits()}
          disabled={fetchingCredits}
          className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fetchingCredits ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </motion.div>

      {/* Tipo de criativo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Card className="bg-[#111111] border-white/5">
          <CardContent className="p-5">
            <Label className="text-sm text-muted-foreground block mb-3">Tipo de criativo</Label>
            <div className="flex gap-3">
              <button
                onClick={() => setCreativeType("image")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  creativeType === "image"
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                }`}
              >
                <Image className="w-4 h-4" />
                Imagem
              </button>
              <button
                onClick={() => setCreativeType("video")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  creativeType === "video"
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                }`}
              >
                <Video className="w-4 h-4" />
                Vídeo
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Formulário condicional */}
      <AnimatePresence mode="wait">
        {creativeType === "image" && (
          <motion.div
            key="image-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="bg-[#111111] border-white/5">
              <CardContent className="p-6 space-y-6">

                {/* Plataforma */}
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Plataforma</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPlatform(p.key)}
                        className={`py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors text-center ${
                          platform === p.key
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Formatos */}
                <AnimatePresence>
                  {platform && (
                    <motion.div
                      key={platform}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-muted-foreground">Formatos</Label>
                        <span className="text-xs text-zinc-600">
                          {selectedFormats.length} de {MAX_FORMATS} selecionado{selectedFormats.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentPlatformFormats.map((f) => {
                          const isSelected = selectedFormats.includes(f.key);
                          const isDisabled = !isSelected && selectedFormats.length >= MAX_FORMATS;
                          return (
                            <button
                              key={f.key}
                              onClick={() => toggleFormat(f.key)}
                              disabled={isDisabled}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                isSelected
                                  ? "bg-primary/15 text-primary border-primary/30"
                                  : isDisabled
                                  ? "bg-[#0a0a0a] text-zinc-700 border-white/[0.04] cursor-not-allowed"
                                  : "bg-[#0a0a0a] text-zinc-400 border-white/[0.08] hover:border-white/20 hover:text-zinc-300 cursor-pointer"
                              }`}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                  isSelected ? "bg-primary border-primary" : "border-white/20"
                                }`}
                              >
                                {isSelected && <span className="w-1.5 h-1.5 rounded-sm bg-black" />}
                              </span>
                              {f.label}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Prompt */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">O que você quer gerar?</Label>
                  <Input
                    placeholder="Ex: Moto premium em rua neon noturna"
                    className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>

                {/* Botão de geração */}
                <CreditsGate
                  feature={featureKey}
                  onSuccess={runGenerate}
                  disabled={!canGenerate || isGenerating}
                  hideCostBadge
                >
                  {({ trigger, isLoading }) => (
                    <Button
                      onClick={trigger}
                      disabled={isLoading || isGenerating || !canGenerate}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                    >
                      {isLoading || isGenerating ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando...</>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Gerar {selectedFormats.length <= 1 ? "Imagem" : `${selectedFormats.length} Imagens`}
                        </>
                      )}
                    </Button>
                  )}
                </CreditsGate>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Vídeo */}
        {creativeType === "video" && (
          <motion.div
            key="video-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="bg-[#111111] border-white/5">
              <CardContent className="p-6 space-y-6">

                {/* Estilo do personagem */}
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Estilo do Personagem</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {VIDEO_ESTILOS.map((e) => (
                      <button
                        key={e.key}
                        onClick={() => setVideoEstilo(e.key)}
                        className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg border text-xs font-medium transition-colors text-center gap-1 ${
                          videoEstilo === e.key
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                        }`}
                      >
                        <span className="font-semibold">{e.label}</span>
                        <span className={`text-[10px] leading-tight ${videoEstilo === e.key ? "text-primary/70" : "text-zinc-600"}`}>
                          {e.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personagem (M/F) */}
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Personagem</Label>
                  <div className="flex gap-3">
                    {(["masculino", "feminino"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => setVideoAvatar(a)}
                        className={`flex-1 flex items-center justify-center py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          videoAvatar === a
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                        }`}
                      >
                        {a === "masculino" ? "Masculino" : "Feminino"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ambiente */}
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Ambiente</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {VIDEO_AMBIENTES.map((amb) => (
                      <button
                        key={amb.key}
                        onClick={() => setVideoAmbiente(amb.key)}
                        className={`py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors text-center ${
                          videoAmbiente === amb.key
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                        }`}
                      >
                        {amb.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Formato do vídeo */}
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Formato</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {VIDEO_FORMATOS.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setVideoFormato(f.key)}
                        className={`flex items-center justify-center py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors text-center ${
                          videoFormato === f.key
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duração */}
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Duração</Label>
                  <div className="flex gap-3">
                    {VIDEO_DURACOES.map((d) => (
                      <button
                        key={d.key}
                        onClick={() => setVideoDuration(d.key)}
                        className={`flex-1 flex items-center justify-center py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          videoDuration === d.key
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Prompt</Label>
                  <Input
                    placeholder="Descreva o contexto do vídeo..."
                    className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                  />
                </div>

                {/* Gerar vídeo */}
                <CreditsGate
                  feature="creativeVideo20"
                  onSuccess={runVideoGenerate}
                  disabled={!canGenerateVideo || isVideoGenerating}
                  hideCostBadge
                >
                  {({ trigger, isLoading }) => (
                    <Button
                      onClick={trigger}
                      disabled={!canGenerateVideo || isVideoGenerating || isLoading}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                    >
                      {isVideoGenerating || isLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando vídeo...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Gerar Vídeo</>
                      )}
                    </Button>
                  )}
                </CreditsGate>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resultados — Imagem */}
      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3 text-muted-foreground mb-5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-sm">
                Gerando {loadingCount === 1 ? "imagem" : `${loadingCount} imagens`}...
              </span>
            </div>
            <div className={`grid gap-4 ${
              loadingCount === 1 ? "grid-cols-1 max-w-sm mx-auto" :
              loadingCount === 2 ? "grid-cols-2" :
              "grid-cols-3"
            }`}>
              {Array.from({ length: loadingCount }).map((_, i) => {
                const fmt = selectedFormats[i] ?? "feed";
                return (
                  <div
                    key={i}
                    className={`rounded-lg bg-white/5 border border-white/5 animate-pulse ${formatToAspectClass(fmt)}`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                );
              })}
            </div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-red-950/20 border-red-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-400">Falha na geração</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    reset();
                    generate("/api/ai/creative-ideas", { prompt, platform, selectedFormats });
                  }}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(isDone || isRestoredMode) && activeResult && Array.isArray(activeResult.concepts) && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {isRestoredMode && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <p className="text-xs text-primary">Criativo restaurado de Projetos Salvos</p>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Imagens Geradas</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {isSaving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={() => { reset(); setRestoredResult(null); }}
                  className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Gerar novamente
                </button>
              </div>
            </div>

            <div className={`grid gap-4 ${
              resultCount <= 1 ? "grid-cols-1 max-w-sm mx-auto" :
              resultCount === 2 ? "md:grid-cols-2" :
              "md:grid-cols-3"
            }`}>
              {activeResult.concepts.map((concept: CreativeConcept, i: number) => (
                <ConceptCard key={concept.id ?? i} concept={concept} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resultados — Vídeo */}
      {creativeType === "video" && (
        <AnimatePresence mode="wait">
          {isVideoGenerating && (
            <motion.div key="video-generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-3 text-muted-foreground mb-5">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <span className="text-sm">Gerando vídeo...</span>
              </div>
              <div className="aspect-video rounded-lg bg-white/5 border border-white/5 animate-pulse" />
            </motion.div>
          )}

          {isVideoError && (
            <motion.div key="video-error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="bg-red-950/20 border-red-500/20">
                <CardContent className="p-5 flex items-center gap-4">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-400">Falha na geração do vídeo</p>
                    <p className="text-xs text-muted-foreground">{videoError}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={videoReset}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {(isVideoDone || isVideoRestoredMode) && activeVideoResult && (
            <>
              {isVideoRestoredMode && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <p className="text-xs text-primary">Vídeo restaurado de Projetos Salvos</p>
                </motion.div>
              )}
              <VideoResultCard
                key="video-result"
                result={activeVideoResult}
                onSave={() => void handleSaveVideo()}
                isSaving={videoIsSaving}
                onReset={() => { videoReset(); setRestoredVideoResult(null); setVideoAutoSaved(false); }}
                saved={videoAutoSaved}
              />
            </>
          )}
        </AnimatePresence>
      )}
    </div>

    {/* ── Dialog: Onde salvar o criativo ── */}
    <Dialog open={saveDialogOpen} onOpenChange={(open) => { if (!isSaving) setSaveDialogOpen(open); }}>
      <DialogContent className="bg-[#111111] border-white/10 max-w-sm">

        {/* Passo 1 — Escolher destino */}
        {saveDialogStep === "choose" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base text-white">Onde deseja salvar este criativo?</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 mt-1">
              <button
                onClick={() => void doSaveNew()}
                disabled={isSaving}
                className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-white/[0.08] bg-[#0a0a0a] hover:border-primary/30 hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Salvar como novo projeto</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Cria um novo projeto com este criativo</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
              </button>
              <button
                onClick={() => void handlePickExisting()}
                disabled={isSaving}
                className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-white/[0.08] bg-[#0a0a0a] hover:border-primary/30 hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Salvar em projeto existente</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Adiciona a imagem a uma campanha já criada</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
              </button>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="ghost" size="sm" onClick={() => setSaveDialogOpen(false)} className="text-zinc-500 hover:text-white text-xs">
                Cancelar
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Passo 2 — Selecionar projeto existente */}
        {saveDialogStep === "pick-project" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base text-white">Selecionar projeto</DialogTitle>
            </DialogHeader>
            {loadingProjects ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
              </div>
            ) : existingProjects.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-zinc-500">Nenhum projeto salvo encontrado.</p>
                <p className="text-xs text-zinc-600 mt-1">Gere e salve uma campanha primeiro.</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1.5 mt-2 pr-0.5">
                {existingProjects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => handleSelectProject(proj)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-white/[0.07] bg-[#0a0a0a] hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{proj.title}</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {({ campaign: "Campanha", content: "Conteúdo", creative: "Criativo", video_script: "Script", product_discovery: "Produtos", product_validation: "Validação" }[proj.type] ?? "Projeto")}
                        {proj.hasImages ? " · Já tem imagem" : ""}
                      </p>
                    </div>
                    {proj.hasImages && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                        Substituir
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <DialogFooter className="mt-3">
              <Button variant="ghost" size="sm" onClick={() => setSaveDialogStep("choose")} className="text-zinc-500 hover:text-white text-xs">
                Voltar
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Passo 3 — Confirmar substituição */}
        {saveDialogStep === "confirm-replace" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base text-white">Substituir imagem existente?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
              Este projeto já possui uma imagem salva. Deseja substituir pela nova imagem gerada?
            </p>
            <DialogFooter className="mt-5 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaveDialogStep("pick-project")}
                className="text-zinc-500 hover:text-white text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => { if (selectedProjectId) void doSaveToExisting(selectedProjectId); }}
                disabled={isSaving}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
              >
                {isSaving
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Salvando...</>
                  : "Substituir imagem"
                }
              </Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
    </>
  );
}
