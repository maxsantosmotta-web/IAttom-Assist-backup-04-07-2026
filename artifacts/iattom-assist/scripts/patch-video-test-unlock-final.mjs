import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);

let creative = readFileSync(creativeUrl, "utf8");
let billing = readFileSync(billingUrl, "utf8");

const videoPackages = `const VIDEO_PACKAGES = [
  {
    id: "video_10", tag: "PACK 10", videos: 10, price: "R$ 35,00",
    bg: "bg-[#0e0c06]",
    border: "border-[#C9A84C]/55 shadow-[0_0_36px_-4px_rgba(201,168,76,0.20)] hover:shadow-[0_0_44px_-4px_rgba(201,168,76,0.28)]",
    topLine: "via-[#C9A84C]/60",
    ambient: "from-[#C9A84C]/[0.06]",
    badge: "bg-[#C9A84C] text-black shadow-[0_2px_8px_rgba(201,168,76,0.35)]",
    iconBg: "bg-[#C9A84C]/15 border border-[#C9A84C]/30",
    iconColor: "text-[#E8C96A]",
    labelColor: "text-[#E8C96A]",
    btn: "bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black hover:brightness-110 font-black",
  },
  {
    id: "video_20", tag: "PACK 20", videos: 20, price: "R$ 65,00",
    bg: "bg-[#0a080e]",
    border: "border-violet-500/50 shadow-[0_0_36px_-6px_rgba(139,92,246,0.22)] hover:shadow-[0_0_44px_-6px_rgba(139,92,246,0.30)]",
    topLine: "via-violet-400/70",
    ambient: "from-violet-500/[0.06]",
    badge: "bg-violet-600 text-white shadow-[0_2px_8px_rgba(139,92,246,0.35)]",
    iconBg: "bg-violet-500/15 border border-violet-500/30",
    iconColor: "text-violet-400",
    labelColor: "text-violet-400",
    btn: "bg-violet-600 text-white hover:bg-violet-500 font-bold",
  },
  {
    id: "video_30", tag: "PACK 30", videos: 30, price: "R$ 90,00",
    bg: "bg-[#050e09]",
    border: "border-emerald-500/30 hover:border-emerald-500/45 shadow-[0_0_36px_-4px_rgba(16,185,129,0.16)]",
    topLine: "via-emerald-400/50",
    ambient: "from-emerald-500/[0.04]",
    badge: "bg-emerald-600 text-white",
    iconBg: "bg-emerald-500/10 border border-emerald-500/25",
    iconColor: "text-emerald-400",
    labelColor: "text-emerald-400",
    btn: "bg-emerald-600 text-white hover:bg-emerald-500 font-bold",
  },
] as const;`;

billing = billing.replace(/const VIDEO_PACKAGES = \[[\s\S]*?\] as const;/, videoPackages);

billing = billing.replace(
  /  const handleBuyVideoPack = async \(packId: string\) => \{\n(?:    if \(currentPlan === "free"\) \{\n      setShowComparison\(true\);\n      return;\n    \}\n)?    setVideoPending\(packId\);/,
  `  const handleBuyVideoPack = async (packId: string) => {\n    setVideoPending(packId);`,
);

const videoMapStart = billing.indexOf("{VIDEO_PACKAGES.map((pkg) => {");
const videoSectionEnd = billing.indexOf("{/* ── Referral CTA", videoMapStart);
if (videoMapStart >= 0 && videoSectionEnd > videoMapStart) {
  let section = billing.slice(videoMapStart, videoSectionEnd);

  section = section
    .replaceAll(" opacity-60 cursor-not-allowed", "")
    .replace(/\n\s*<div className="absolute inset-0 z-10 rounded-xl bg-black\/25 pointer-events-none" \/>/g, "")
    .replace(/\n\s*<div className="absolute top-3 right-3 z-20[\s\S]*?<Lock className="w-3 h-3" \/>\s*Em breve\s*<\/div>/g, "");

  section = section.replace(
    /<Button[\s\S]*?<Lock className="w-3\.5 h-3\.5 mr-1\.5" \/>\s*Em breve[\s\S]*?<\/Button>/,
    `<Button
                  size="sm"
                  className={\`w-full h-9 text-xs \${pkg.btn}\`}
                  onClick={() => handleBuyVideoPack(pkg.id)}
                  disabled={isPending || videoPending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar</>
                  }
                </Button>`,
  );

  billing = billing.slice(0, videoMapStart) + section + billing.slice(videoSectionEnd);
}

creative = creative.replace(
  /if \(!isAdmin && !\["pro", "business", "agency"\]\.includes\(planSlug\)\) return <ModuleLockGate allowedPlans=\{\["pro", "business", "agency"\]\} moduleName="Criar Imagem e Vídeo" \/>;/,
  `if (false && !isAdmin && !["pro", "business", "agency"].includes(planSlug)) return <ModuleLockGate allowedPlans={["pro", "business", "agency"]} moduleName="Criar Imagem e Vídeo" />;`,
);

creative = creative.replace(
  `  const canOpenImageMotion = isAdmin || (videoBalance ?? 0) > 0;`,
  `  const canOpenImageMotion = true;\n  const [videoBalanceDialogOpen, setVideoBalanceDialogOpen] = useState(false);`,
);

const executionStart = creative.indexOf("<ImageMotionExecution");
if (executionStart >= 0 && !creative.includes("video-balance-click-gate")) {
  const executionEnd = creative.indexOf("/>", executionStart);
  if (executionEnd > executionStart) {
    const executionBlock = creative.slice(executionStart, executionEnd + 2);
    const gatedExecution = `<>
                    <div
                      data-testid="video-balance-click-gate"
                      onClickCapture={(event) => {
                        if (!isAdmin && (videoBalance ?? 0) <= 0) {
                          const target = event.target as HTMLElement;
                          if (target.closest("button")) {
                            event.preventDefault();
                            event.stopPropagation();
                            setVideoBalanceDialogOpen(true);
                          }
                        }
                      }}
                    >
                      ${executionBlock}
                    </div>
                    <Dialog open={videoBalanceDialogOpen} onOpenChange={setVideoBalanceDialogOpen}>
                      <DialogContent className="bg-[#111111] border-white/10 max-w-md p-0 gap-0">
                        <div className="p-6 border-b border-white/5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Video className="w-4 h-4 text-amber-400" />
                                <p className="text-xs text-amber-400 uppercase tracking-widest font-medium">Saldo de vídeo com efeito</p>
                              </div>
                              <h2 className="text-xl font-bold text-white mb-1">Saldo de vídeo com efeito insuficiente</h2>
                              <p className="text-sm text-muted-foreground">Adquira um pacote avulso</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-6">
                          <Button
                            variant="outline"
                            className="w-full border-white/10 hover:border-primary/30 text-sm"
                            onClick={() => setVideoBalanceDialogOpen(false)}
                          >
                            Fechar
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>`;
    creative = creative.slice(0, executionStart) + gatedExecution + creative.slice(executionEnd + 2);
  }
}

billing = billing.replaceAll("Pacotes de Vídeo</p>", "Pacotes de Vídeo com Efeito</p>");

writeFileSync(creativeUrl, creative);
writeFileSync(billingUrl, billing);
console.log("Official video package prices and gold-violet-green visual order applied.");
