import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, Copy, Image, AlertCircle, RefreshCw, Palette, Type, Paperclip, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import { needsReferenceImage } from "@/lib/needsReferenceImage";
import { useReferenceAnalysis } from "@/hooks/useReferenceAnalysis";
import type { CreativeIdeasResult, CreativeConcept } from "@/types/ai";

interface CampaignCreativePanelProps {
  product: string;
  goal: string;
  audience: string;
  headline: string;
  uniqueAngle?: string;
  instagramCopy?: string;
  channels?: string[];
  platform?: string;
  onResult?: (result: CreativeIdeasResult) => void;
}

function InlineConceptCard({ concept, compact }: { concept: CreativeConcept; compact?: boolean }) {
  const { toast } = useToast();

  const handleCopy = () => {
    const text = [
      `HOOK: ${concept.copyHook}`,
      `COPY: ${concept.bodyText}`,
      `CTA: ${concept.cta}`,
      `VISUAL: ${concept.visualDirection}`,
    ].join("\n\n");
    navigator.clipboard.writeText(text);
    toast({ description: "Criativo copiado" });
  };

  return (
    <div className="bg-[#0d0d0d] border border-white/5 rounded-lg overflow-hidden">
      {concept.imageBase64 ? (
        <img
          src={`data:image/png;base64,${concept.imageBase64}`}
          alt={concept.label}
          className="w-full object-cover"
          style={{ maxHeight: compact ? "220px" : "176px" }}
        />
      ) : (
        <div className="h-28 bg-gradient-to-br from-primary/15 to-amber-900/10 flex items-center justify-center">
          <Image className="w-7 h-7 text-white/15" />
        </div>
      )}
      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">{concept.label}</p>
            {concept.bestPlatform && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">{concept.bestPlatform}</p>
            )}
          </div>
          {!compact && (
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:text-white transition-colors shrink-0 mt-0.5"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {!compact && (
          <>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Hook</p>
              <p className="text-sm font-semibold text-white leading-snug">{concept.copyHook}</p>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Copy</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{concept.bodyText}</p>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">CTA</p>
                <p className="text-xs text-primary font-semibold">{concept.cta}</p>
              </div>
              {concept.emotionalTrigger && (
                <div className="text-right">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Gatilho</p>
                  <p className="text-xs text-amber-400/80">{concept.emotionalTrigger}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function CampaignCreativePanel({
  product,
  goal,
  audience,
  headline,
  uniqueAngle,
  instagramCopy,
  channels,
  platform,
  onResult,
}: CampaignCreativePanelProps) {
  const { status, result, error, generate, reset } = useAiStream<CreativeIdeasResult>();
  const [started, setStarted] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<(() => void) | null>(null);

  const { analyze, analysisStatus, analysisResult, resetAnalysis } = useReferenceAnalysis();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      setReferenceImagePreview(dataUrl);
      setReferenceImage(base64);
      setConfirmed(false);
      resetAnalysis();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => {
    if (referenceImage && product.trim()) {
      void analyze(referenceImage, product);
    }
  }, [referenceImage, product]);

  const handleRemove = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setConfirmed(false);
    resetAnalysis();
  };

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const needsRef = needsReferenceImage(product ?? "", product);

  const canGenerate = (() => {
    if (!referenceImage) return false;
    if (analysisStatus !== "done") return false;
    if (analysisResult === null) return false;
    if (analysisResult.compatible) return true;
    if (analysisResult.confidence === "low") return confirmed;
    return false;
  })();

  const buildPrompt = () =>
    [
      product,
      goal ? `Objetivo: ${goal}` : "",
      headline ? `Manchete: ${headline}` : "",
      uniqueAngle ? `Ângulo: ${uniqueAngle}` : "",
      instagramCopy ? `Copy: ${instagramCopy.slice(0, 140)}` : "",
      channels?.length ? `Canais: ${channels.slice(0, 3).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 300);

  const runGenerate = (charge: () => void) => {
    setStarted(true);
    generate("/api/ai/creative-ideas", {
      prompt: buildPrompt(),
      product,
      targetAudience: audience || undefined,
      platform: platform || undefined,
      referenceImageBase64: referenceImage || undefined,
    }).then((res) => {
      if (res !== null) {
        charge();
        onResult?.(res);
      }
    });
  };

  return (
    <div className="border-t border-white/5 pt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-primary uppercase tracking-widest font-medium">Criativo da Campanha</p>
          <p className="text-sm text-white font-semibold mt-0.5">
            Imagens e conceitos visuais gerados para esta campanha
          </p>
        </div>
        {isDone && (
          <button
            onClick={() => { reset(); setStarted(false); }}
            className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3 h-3" /> Regenerar Criativos
          </button>
        )}
      </div>

      {!started && !isDone && !isGenerating && !isError && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="flex items-center gap-3">
            {referenceImage && referenceImagePreview ? (
              <div className="flex items-center gap-2">
                <img src={referenceImagePreview} alt="Referência" className="w-8 h-8 rounded object-cover border border-primary/40" />
                <span className="text-xs text-primary">Referência adicionada</span>
                <button onClick={handleRemove} className="text-muted-foreground hover:text-white transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary border border-white/10 hover:border-primary/40 rounded-md px-3 py-1.5 transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5" />
                Adicionar imagem
              </button>
            )}
          </div>

          {referenceImage && (
            <div className="space-y-2">
              {analysisStatus === "analyzing" && (
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
                  <p className="text-xs text-muted-foreground">Verificando imagem...</p>
                </div>
              )}

              {analysisStatus === "done" && analysisResult !== null && analysisResult.compatible && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-300/90">
                    Produto identificado: <span className="font-semibold">{analysisResult.productDetected}</span>
                  </p>
                </div>
              )}

              {analysisStatus === "done" && analysisResult !== null && !analysisResult.compatible && analysisResult.confidence !== "low" && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-3.5 py-3">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300/90 leading-relaxed">
                    A imagem enviada parece mostrar <span className="font-semibold">{analysisResult.productDetected}</span>, mas esta campanha é para <span className="font-semibold">{product}</span>. Envie uma imagem do produto correto.
                  </p>
                </div>
              )}

              {analysisStatus === "done" && analysisResult !== null && !analysisResult.compatible && analysisResult.confidence === "low" && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-3">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300/85 leading-relaxed">
                      Não foi possível confirmar com certeza se a imagem corresponde ao produto da campanha.
                    </p>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="w-3.5 h-3.5 accent-primary shrink-0"
                    />
                    <span className="text-xs text-zinc-400">Confirmo que esta imagem é do produto desta campanha.</span>
                  </label>
                </div>
              )}

              {analysisStatus === "error" && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-3">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-300/85 leading-relaxed">
                      Não foi possível verificar a imagem automaticamente.
                    </p>
                  </div>
                  <button
                    onClick={() => void analyze(referenceImage, product)}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors shrink-0"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          )}

          {!referenceImage && needsRef && (
            <p className="text-xs text-primary/60">
              Para gerar imagens mais fiéis ao produto, adicione uma foto de referência.
            </p>
          )}
        </div>
      )}

      {!started && !isDone && !isGenerating && !isError && (
        <CreditsGate feature="creative" onSuccess={runGenerate}>
          {({ trigger, isLoading }) => {
            triggerRef.current = trigger;
            if (!referenceImage) return null;
            return (
              <Button
                onClick={trigger}
                disabled={isLoading || isGenerating || !canGenerate}
                className="bg-primary text-black hover:bg-primary/90 font-semibold w-full disabled:opacity-40"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Preparando...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Gerar imagem da campanha</>
                )}
              </Button>
            );
          }}
        </CreditsGate>
      )}

      {isGenerating && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-sm">Gerando conceitos e imagens da campanha...</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-60 rounded-lg bg-white/5 border border-white/5 animate-pulse"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-950/20 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">Falha na geração</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { reset(); setStarted(false); }}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
          </Button>
        </div>
      )}

      {isDone && result && (
        <div className="space-y-4">
          {result.overarchingTheme && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-1.5">
              <p className="text-xs text-primary uppercase tracking-widest font-medium">Tema Criativo</p>
              <p className="text-sm text-white">{result.overarchingTheme}</p>
              <div className="flex flex-wrap gap-4">
                {result.colorPalette && (
                  <div className="flex items-center gap-1.5">
                    <Palette className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{result.colorPalette}</p>
                  </div>
                )}
                {result.typographyDirection && (
                  <div className="flex items-center gap-1.5">
                    <Type className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{result.typographyDirection}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {result.concepts?.map((concept, i) => (
              <InlineConceptCard key={concept.id ?? i} concept={concept} compact={true} />
            ))}
          </div>

          {result.brandVoiceNotes && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/5">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-1">Voz da Marca</p>
              <p className="text-sm text-muted-foreground">{result.brandVoiceNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
