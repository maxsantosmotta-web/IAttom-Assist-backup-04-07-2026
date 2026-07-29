import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`${label} marker was not found`);
  return source.replace(before, after);
}

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let creative = readFileSync(creativeUrl, "utf8");

creative = replaceRequired(
  creative,
  `import { Sparkles, Loader2, RefreshCw, AlertCircle, Image, Save, Download, Video, ChevronRight } from "lucide-react";`,
  `import { Sparkles, Loader2, RefreshCw, AlertCircle, Image, Save, Download, Video, ChevronRight, Lock } from "lucide-react";
import { ImageMotionSourcePicker, type ImageMotionSource } from "@/components/creative/ImageMotionSourcePicker";`,
  "creative motion imports",
);

creative = replaceRequired(
  creative,
  `  const [videoBalance, setVideoBalance] = useState<number | null>(null);`,
  `  const [videoBalance, setVideoBalance] = useState<number | null>(null);
  const canOpenImageMotion = true;
  const [imageMotionSource, setImageMotionSource] = useState<ImageMotionSource | null>(null);
  const [imageMotionResetSignal, setImageMotionResetSignal] = useState(0);`,
  "image motion access and source state",
);

creative = replaceRequired(
  creative,
  `              <button
                onClick={() => {
                  setCreativeType("video");
                  try { localStorage.setItem("iattom_creative_tab_v1", "video"); } catch { /* ignore */ }
                }}
                className={\`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors \${
                  creativeType === "video"
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                }\`}
              >
                <Video className="w-4 h-4" />
                Vídeo
              </button>`,
  `              <button
                type="button"
                disabled={!canOpenImageMotion}
                aria-disabled={!canOpenImageMotion}
                title={canOpenImageMotion ? "Usar imagem com efeitos em movimento" : "Adquira um pacote de vídeo para liberar"}
                onClick={() => {
                  if (!canOpenImageMotion) return;
                  setCreativeType("video");
                  try { localStorage.setItem("iattom_creative_tab_v1", "video"); } catch { /* ignore */ }
                }}
                className={\`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors \${
                  creativeType === "video"
                    ? "bg-primary/15 text-primary border-primary/30"
                    : canOpenImageMotion
                    ? "bg-[#0a0a0a] text-zinc-500 border-white/[0.08] hover:border-white/20 hover:text-zinc-300"
                    : "bg-[#0a0a0a] text-zinc-600 border-white/[0.06] cursor-not-allowed"
                }\`}
              >
                {!canOpenImageMotion ? <Lock className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                Vídeo com Imagem
                {!canOpenImageMotion && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Bloqueado</span>}
              </button>`,
  "shared image motion selector",
);

creative = replaceRequired(
  creative,
  `{creativeType === "image" && (`,
  `{(creativeType === "image" || creativeType === "video") && (`,
  "shared creative form condition",
);

creative = replaceRequired(
  creative,
  `key="image-form"`,
  `key={creativeType === "image" ? "image-form" : "image-motion-form"}`,
  "shared creative form key",
);

creative = replaceRequired(
  creative,
  `                {/* Prompt */}
                <div className="space-y-2">`,
  `                {creativeType === "video" && (
                  <ImageMotionSourcePicker
                    value={imageMotionSource}
                    onChange={setImageMotionSource}
                    disabled={isGenerating}
                    resetSignal={imageMotionResetSignal}
                  />
                )}

                {/* Prompt */}
                <div className="space-y-2">`,
  "image motion source picker",
);

creative = replaceRequired(
  creative,
  `<Label className="text-sm text-muted-foreground">O que você quer gerar?</Label>
                  <Input
                    placeholder="Ex: Moto premium em rua neon noturna"`,
  `<Label className="text-sm text-muted-foreground">{creativeType === "image" ? "O que você quer gerar?" : "Descreva o efeito em movimento desejado"}</Label>
                  <Input
                    placeholder={creativeType === "image" ? "Ex: Moto premium em rua neon noturna" : "Ex: fumaça saindo dos pneus e luzes refletindo na lataria"}`,
  "shared prompt copy",
);

creative = replaceRequired(
  creative,
  `                {/* Botão de geração */}
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
                          Gerar {selectedFormats.length <= 1 ? "Imagem" : \`${selectedFormats.length} Imagens\`}
                        </>
                      )}
                    </Button>
                  )}
                </CreditsGate>`,
  `                {/* Botão de geração */}
                {creativeType === "image" ? (
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
                            Gerar {selectedFormats.length <= 1 ? "Imagem" : \`${selectedFormats.length} Imagens\`}
                          </>
                        )}
                      </Button>
                    )}
                  </CreditsGate>
                ) : (
                  <Button
                    type="button"
                    disabled
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary disabled:text-primary-foreground disabled:opacity-40"
                  >
                    <Video className="w-4 h-4 mr-2" /> Gerar Vídeo
                  </Button>
                )}`,
  "mode-specific generate action",
);

creative = replaceRequired(
  creative,
  `{creativeType === "video" && (`,
  `{false && creativeType === "video" && (`,
  "disable legacy avatar video form",
);

creative = creative.replace(
  `onClick={() => { reset(); setRestoredResult(null); clearModuleState("creative"); }}`,
  `onClick={() => { reset(); setRestoredResult(null); clearModuleState("creative"); if (creativeType === "video") { setImageMotionSource(null); setImageMotionResetSignal((value) => value + 1); } }}`,
);

if (creative.includes("ImageMotionTestDialog") || creative.includes("imageMotionTestOpen")) {
  throw new Error("Separated image motion test dialog must not be mounted");
}

writeFileSync(creativeUrl, creative);
console.log("Video package checkout remains open and the Vídeo com Imagem module is unlocked for commercial testing.");