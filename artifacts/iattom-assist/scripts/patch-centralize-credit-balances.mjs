import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);

let sidebar = readFileSync(sidebarUrl, "utf8");
let credits = readFileSync(creditsUrl, "utf8");

// Remove the entire balance widget from the sidebar without changing navigation or user controls.
sidebar = sidebar.replace(
  /\n\s*\{\/\* Credits Widget \*\/\}[\s\S]*?\n\s*\{\/\* User \*\/\}/,
  "\n\n      {/* User */}",
);

// Remove Help quota polling and credit-balance-only data from SidebarLayout.
sidebar = sidebar.replace(/\n\s*const \[helpUsage, setHelpUsage\] = useState<\{[\s\S]*?\} \| null>\(null\);/, "");
sidebar = sidebar.replace(/\n\s*useEffect\(\(\) => \{\n\s*if \(!isSignedIn\) \{\n\s*setHelpUsage\(null\);[\s\S]*?\n\s*\}, \[isSignedIn, helpOpen\]\);/, "");
sidebar = sidebar.replace(/\n\s*const \{ data: creditsData \} = useGetCreditsBalance\([\s\S]*?\n\s*\}\);/, "");
sidebar = sidebar.replace(/\n\s*const creditBalance = creditsData\?\.balance[\s\S]*?const helpTextColor = getCreditColor\(helpPct\);/, "");
sidebar = sidebar.replace(
  /\n\s*useGetCreditsBalance, getGetCreditsBalanceQueryKey,?/,
  "",
);
sidebar = sidebar.replace(/\nimport \{ getCreditColor, getCreditBarColor \} from "@\/lib\/credits";/, "");
sidebar = sidebar.replace(/\n\s*void qc\.invalidateQueries\(\{ queryKey: getGetCreditsBalanceQueryKey\(\) \}\);/, "");

if (sidebar.includes("{/* Credits Widget */}")) {
  throw new Error("Sidebar credit widget was not removed");
}

// Add isolated live reads for video balance and Help usage to the Credits page.
credits = credits.replace(
  'import { motion } from "framer-motion";',
  'import { motion } from "framer-motion";\nimport { useEffect, useState } from "react";',
);
credits = credits.replace(
  'import { Zap, TrendingUp, RefreshCw } from "lucide-react";',
  'import { Zap, TrendingUp, RefreshCw, Image, Video, HelpCircle } from "lucide-react";',
);

const componentMarker = `export function Credits() {\n  const [, navigate] = useLocation();`;
if (!credits.includes(componentMarker)) throw new Error("Credits component marker not found");
credits = credits.replace(
  componentMarker,
  `export function Credits() {\n  const [, navigate] = useLocation();\n  const [videoBalance, setVideoBalance] = useState(0);\n  const [helpUsed, setHelpUsed] = useState(0);\n\n  useEffect(() => {\n    let cancelled = false;\n    Promise.all([\n      fetch("/api/videos/balance", { credentials: "include" }).then((r) => r.ok ? r.json() : Promise.reject()),\n      fetch("/api/help/usage", { credentials: "include" }).then((r) => r.ok ? r.json() : Promise.reject()),\n    ]).then(([video, help]) => {\n      if (cancelled) return;\n      setVideoBalance(Number((video as { videoBalance?: number }).videoBalance ?? 0));\n      setHelpUsed(Number((help as { used?: number }).used ?? 0));\n    }).catch(() => {\n      if (!cancelled) { setVideoBalance(0); setHelpUsed(0); }\n    });\n    return () => { cancelled = true; };\n  }, []);`,
);

const balanceCardMarker = `      <motion.div\n        initial={{ opacity: 0, y: 12 }}\n        animate={{ opacity: 1, y: 0 }}\n        transition={{ duration: 0.4, delay: 0.1 }}\n      >`;
if (!credits.includes(balanceCardMarker)) throw new Error("Credits balance card marker not found");

const compactCards = `      <motion.div\n        initial={{ opacity: 0, y: 12 }}\n        animate={{ opacity: 1, y: 0 }}\n        transition={{ duration: 0.4, delay: 0.08 }}\n        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"\n      >\n        <Card className="bg-[#111111] border-white/5"><CardContent className="p-5">\n          <div className="flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-primary" /><span className="text-xs uppercase tracking-widest text-muted-foreground">Créditos gerais</span></div>\n          <p className="text-3xl font-bold text-white tabular-nums">{(balance?.balance ?? 0).toLocaleString("pt-BR")}</p>\n          <p className="text-xs text-muted-foreground mt-1">Disponíveis para os módulos e IAttom Help</p>\n        </CardContent></Card>\n        <Card className="bg-[#111111] border-white/5"><CardContent className="p-5">\n          <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-violet-400" /><span className="text-xs uppercase tracking-widest text-muted-foreground">Imagens</span></div>\n          <p className="text-3xl font-bold text-white tabular-nums">{Math.floor((balance?.creativeBalance ?? 0) / 10).toLocaleString("pt-BR")}</p>\n          <p className="text-xs text-muted-foreground mt-1">Saldo disponível</p>\n        </CardContent></Card>\n        <Card className="bg-[#111111] border-white/5"><CardContent className="p-5">\n          <div className="flex items-center gap-2 mb-3"><Video className="w-4 h-4 text-emerald-400" /><span className="text-xs uppercase tracking-widest text-muted-foreground">Vídeos com efeito</span></div>\n          <p className="text-3xl font-bold text-white tabular-nums">{videoBalance.toLocaleString("pt-BR")}</p>\n          <p className="text-xs text-muted-foreground mt-1">Saldo disponível</p>\n        </CardContent></Card>\n        <Card className="bg-[#111111] border-white/5"><CardContent className="p-5">\n          <div className="flex items-center gap-2 mb-3"><HelpCircle className="w-4 h-4 text-sky-400" /><span className="text-xs uppercase tracking-widest text-muted-foreground">IAttom Help</span></div>\n          <p className="text-3xl font-bold text-white tabular-nums">{helpUsed.toLocaleString("pt-BR")}</p>\n          <p className="text-xs text-muted-foreground mt-1">Mensagens utilizadas no histórico</p>\n        </CardContent></Card>\n      </motion.div>\n\n`;
credits = credits.replace(balanceCardMarker, compactCards + balanceCardMarker);

if (!credits.includes("Vídeos com efeito") || !credits.includes("Mensagens utilizadas no histórico")) {
  throw new Error("Credits centralized cards were not inserted");
}

writeFileSync(sidebarUrl, sidebar);
writeFileSync(creditsUrl, credits);
console.log("Credit balances centralized in Credits module; sidebar balances removed.");
