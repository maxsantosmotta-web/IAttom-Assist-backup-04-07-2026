import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`${label} marker was not found`);
  return source.replace(before, after);
}

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let billing = readFileSync(billingUrl, "utf8");

billing = replaceRequired(
  billing,
  `              <div
                key={pkg.id}
                className={\`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 transition-all duration-200 \${pkg.bg} \${pkg.border}\`}
              >`,
  `              <div
                key={pkg.id}
                className={\`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 opacity-60 cursor-not-allowed \${pkg.bg} \${pkg.border}\`}
              >
                <div className="absolute inset-0 z-10 rounded-xl bg-black/25 pointer-events-none" />
                <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-semibold text-zinc-300">
                  <Lock className="w-3 h-3" /> Em breve
                </div>`,
  "video package card lock",
);

billing = replaceRequired(
  billing,
  `                <Button
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
  `                <Button
                  size="sm"
                  className="w-full h-9 text-xs bg-white/5 text-zinc-500 border border-white/10 cursor-not-allowed"
                  disabled
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> Em breve
                </Button>`,
  "video package checkout lock",
);

writeFileSync(billingUrl, billing);

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let creative = readFileSync(creativeUrl, "utf8");

creative = replaceRequired(
  creative,
  `import { Sparkles, Loader2, RefreshCw, AlertCircle, Image, Save, Download, Video, ChevronRight } from "lucide-react";`,
  `import { Sparkles, Loader2, RefreshCw, AlertCircle, Image, Save, Download, Video, ChevronRight, Lock } from "lucide-react";`,
  "creative lock import",
);

creative = replaceRequired(
  creative,
  `  const [creativeType, setCreativeType] = useState<CreativeType>(() => {
    try {
      const saved = localStorage.getItem("iattom_creative_tab_v1");
      if (saved === "video") return "video";
    } catch { /* ignore */ }
    return "image";
  });`,
  `  const [creativeType, setCreativeType] = useState<CreativeType>("image");`,
  "creative initial image tab",
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
                disabled
                aria-disabled="true"
                title="Geração de vídeo em breve"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium bg-[#0a0a0a] text-zinc-600 border-white/[0.06] cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                Vídeo
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Em breve</span>
              </button>`,
  "creative video tab lock",
);

creative = creative.replaceAll(`setCreativeType("video");`, `setCreativeType("image");`);

writeFileSync(creativeUrl, creative);
console.log("Video packages and generation are locked as coming soon.");
