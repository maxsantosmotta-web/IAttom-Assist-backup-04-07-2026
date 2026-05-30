import { useState, useRef } from "react";
import { Sparkles, Loader2, Copy, Image, AlertCircle, RefreshCw, Palette, Type, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import { needsReferenceImage } from "@/lib/needsReferenceImage";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<(() => void) | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setReferenceImagePreview(dataUrl);
      setReferenceImage(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const needsRef = needsReferenceImage(product ?? "", product);

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
        <div className="space-y-2">
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
                <button onClick={() => { setReferenceImage(null); setReferenceImagePreview(null); }} className="text-muted-foreground hover:text-white transition-colors">
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
          {referenceImage ? (
            <p className="text-xs text-amber-300/70 leading-relaxed">
              A imagem enviada deve ser uma foto real do produto desta campanha.
            </p>
          ) : needsRef ? (
            <p className="text-xs text-primary/60">
              Para gerar imagens mais fiéis ao produto, adicione uma foto de referência.
            </p>
          ) : null}
        </div>
      )}

      {!started && !isDone && !isGenerating && !isError && (
        <CreditsGate feature="creative" onSuccess={runGenerate}>
          {({ trigger, isLoading }) => {
            triggerRef.current = trigger;
            return (
              <Button
                onClick={trigger}
                disabled={isLoading || isGenerating}
                className="bg-primary text-black hover:bg-primary/90 font-semibold w-full"
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
