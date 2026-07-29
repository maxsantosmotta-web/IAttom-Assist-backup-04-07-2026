import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);

let creative = readFileSync(creativeUrl, "utf8");
let billing = readFileSync(billingUrl, "utf8");

const videoPackages = `const VIDEO_PACKAGES = [
  {
    id: "video_10", tag: "PACK 10", videos: 10, price: "R$ 0,50",
    bg: "bg-[#060a10]",
    border: "border-blue-400/20 hover:border-blue-400/35",
    topLine: "via-blue-400/25",
    ambient: "from-blue-500/[0.03]",
    badge: "bg-blue-500/10 text-blue-300 border border-blue-400/20 border-t-0",
    iconBg: "bg-blue-500/12 border border-blue-400/20",
    iconColor: "text-blue-300",
    labelColor: "text-blue-300",
    btn: "bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 border border-blue-400/25",
  },
  {
    id: "video_20", tag: "PACK 20", videos: 20, price: "R$ 0,50",
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
    id: "video_30", tag: "PACK 30", videos: 30, price: "R$ 0,50",
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
    const gatedExecution = `<div\n                      data-testid="video-balance-click-gate"\n                      onClickCapture={(event) => {\n                        if (!isAdmin && (videoBalance ?? 0) <= 0) {\n                          const target = event.target as HTMLElement;\n                          if (target.closest("button")) {\n                            event.preventDefault();\n                            event.stopPropagation();\n                            setVideoBalanceDialogOpen(true);\n                          }\n                        }\n                      }}\n                    >\n                      ${executionBlock}\n                    </div>\n                    <Dialog open={videoBalanceDialogOpen} onOpenChange={setVideoBalanceDialogOpen}>\n                      <DialogContent className="bg-[#111111] border-white/10 max-w-md">\n                        <DialogHeader>\n                          <DialogTitle>Saldo de vídeos com efeito insuficiente</DialogTitle>\n                        </DialogHeader>\n                        <p className="text-sm text-muted-foreground">Adquira um pacote avulso</p>\n                        <DialogFooter>\n                          <Button variant="outline" onClick={() => setVideoBalanceDialogOpen(false)}>Fechar</Button>\n                        </DialogFooter>\n                      </DialogContent>\n                    </Dialog>`;
    creative = creative.slice(0, executionStart) + gatedExecution + creative.slice(executionEnd + 2);
  }
}

billing = billing.replaceAll("Pacotes de Vídeo</p>", "Pacotes de Vídeo com Efeito</p>");

writeFileSync(creativeUrl, creative);
writeFileSync(billingUrl, billing);
console.log("Video packages remain purchasable; video generation now checks balance only when the user clicks Gerar Vídeo.");
