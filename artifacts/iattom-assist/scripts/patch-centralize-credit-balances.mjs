import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
const dashboardUrl = new URL("../src/pages/dashboard/DashboardHome.tsx", import.meta.url);

let sidebar = readFileSync(sidebarUrl, "utf8");
let credits = readFileSync(creditsUrl, "utf8");
let dashboard = readFileSync(dashboardUrl, "utf8");

// 1) Remove saldos do layout compartilhado. A fonte oficial fica em Créditos.
sidebar = sidebar.replace(
  /\n\s*\{\/\* Credits Widget \*\/\}[\s\S]*?\n\s*\{\/\* User \*\/\}/,
  "\n\n      {/* User */}",
);
sidebar = sidebar.replace(
  /\n\s*\{isLowCredit && \([\s\S]*?\n\s*\)\}\n\s*\{creditsData && \([\s\S]*?\n\s*\)\}/,
  "",
);

if (sidebar.includes("{/* Credits Widget */}")) {
  throw new Error("Sidebar credit widget was not removed");
}
if (sidebar.includes("Créditos Baixos") || sidebar.includes("creditBalance.toLocaleString()")) {
  throw new Error("Top bar credit visibility was not removed");
}

// 2) Remove avisos e saldos numéricos do Dashboard.
dashboard = dashboard.replace(/\nimport \{ UpgradeNudge \} from "@\/components\/UpgradeNudge";/, "");
dashboard = dashboard.replace(
  /\n\s*const \{ planName, credits, balance \} = useUserAccess\(\);/,
  "\n  const { planName } = useUserAccess();",
);
dashboard = dashboard.replace(/\n\s*<UpgradeNudge totalActions=\{summary\?\.totalActions \?\? 0\} \/>/, "");
dashboard = dashboard.replace(
  /\n\s*<Link href="\/dashboard\/credits" className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">\n\s*<Zap className="w-3\.5 h-3\.5" \/>\n\s*\{balance \? `\$\{credits\.toLocaleString\(\)\} créditos restantes` : "Ver créditos"\}\n\s*<\/Link>/,
  "",
);

if (dashboard.includes("<UpgradeNudge") || dashboard.includes("créditos restantes")) {
  throw new Error("Dashboard credit visibility was not removed");
}

// 3) A tela do usuário possui apenas três contadores:
// créditos gerais, imagens e vídeos com efeito.
// O IAttom Help consome o saldo geral e permanece apenas no histórico e no ADM.
if (!credits.includes('import { useEffect, useRef, useState } from "react";')) {
  credits = credits.replace(
    'import { motion } from "framer-motion";',
    'import { motion } from "framer-motion";\nimport { useEffect, useRef, useState } from "react";',
  );
  credits = credits.replace(
    'import { useEffect, useState } from "react";',
    'import { useEffect, useRef, useState } from "react";',
  );
}
credits = credits.replace(
  'import { Zap, TrendingUp, RefreshCw } from "lucide-react";',
  'import { Zap, TrendingUp, RefreshCw, Image, Video } from "lucide-react";',
);

const componentMarker = `export function Credits() {\n  const [, navigate] = useLocation();`;
const stateBlock = `export function Credits() {
  const [, navigate] = useLocation();
  const [videoBalance, setVideoBalance] = useState<number | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const videoRetryRef = useRef<number | null>(null);
  const videoRequestInFlightRef = useRef(false);
  const videoMountedRef = useRef(true);

  const loadVideoBalance = async (signal?: AbortSignal): Promise<boolean> => {
    if (videoRequestInFlightRef.current) return false;
    videoRequestInFlightRef.current = true;
    if (videoMountedRef.current) setVideoLoading(true);

    try {
      const response = await fetch("/api/videos/balance", {
        credentials: "include",
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("video balance request failed");
      const video = await response.json() as { videoBalance?: number };
      if (!videoMountedRef.current || signal?.aborted) return false;
      setVideoBalance(Number(video.videoBalance ?? 0));
      setVideoLoading(false);
      if (videoRetryRef.current !== null) {
        window.clearTimeout(videoRetryRef.current);
        videoRetryRef.current = null;
      }
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      if (videoMountedRef.current && videoRetryRef.current === null) {
        videoRetryRef.current = window.setTimeout(() => {
          videoRetryRef.current = null;
          void loadVideoBalance();
        }, 3000);
      }
      return false;
    } finally {
      videoRequestInFlightRef.current = false;
    }
  };

  useEffect(() => {
    videoMountedRef.current = true;
    const controller = new AbortController();
    void loadVideoBalance(controller.signal);
    return () => {
      videoMountedRef.current = false;
      controller.abort("credits-unmounted");
      if (videoRetryRef.current !== null) {
        window.clearTimeout(videoRetryRef.current);
        videoRetryRef.current = null;
      }
    };
  }, []);`;

if (credits.includes(componentMarker) && !credits.includes("const loadVideoBalance = async")) {
  credits = credits.replace(componentMarker, stateBlock);
} else if (!credits.includes("const loadVideoBalance = async")) {
  throw new Error("Credits component marker not found");
} else if (!credits.includes("const videoRetryRef = useRef<number | null>(null);")) {
  const existingStateStart = credits.indexOf("export function Credits() {");
  const existingStateEnd = existingStateStart >= 0 ? credits.indexOf("\n  const { data: balance", existingStateStart) : -1;
  if (existingStateStart < 0 || existingStateEnd < 0) {
    throw new Error("Existing Credits video state boundaries not found");
  }
  credits = `${credits.slice(0, existingStateStart)}${stateBlock}${credits.slice(existingStateEnd)}`;
}

const balanceCardMarker = `      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >`;

if (!credits.includes('data-testid="centralized-credit-balances"')) {
  if (!credits.includes(balanceCardMarker)) throw new Error("Credits balance card marker not found");
  const compactCards = `      <motion.div
        data-testid="centralized-credit-balances"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <Card className="bg-[#111111] border-white/5"><CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-primary" /><span className="text-xs uppercase tracking-widest text-muted-foreground">Créditos gerais</span></div>
          <p className="text-3xl font-bold text-white tabular-nums">{(balance?.balance ?? 0).toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">Disponíveis para os módulos e IAttom Help</p>
        </CardContent></Card>
        <Card className="bg-[#111111] border-white/5"><CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-violet-400" /><span className="text-xs uppercase tracking-widest text-muted-foreground">Imagens</span></div>
          <p className="text-3xl font-bold text-white tabular-nums">{Math.floor((balance?.creativeBalance ?? 0) / 10).toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">Saldo disponível</p>
        </CardContent></Card>
        <Card className="bg-[#111111] border-white/5"><CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3"><Video className="w-4 h-4 text-emerald-400" /><span className="text-xs uppercase tracking-widest text-muted-foreground">Vídeos com efeito</span></div>
          {videoBalance === null ? <Skeleton className="h-9 w-16 bg-white/5" /> : <p className="text-3xl font-bold text-white tabular-nums">{videoBalance.toLocaleString("pt-BR")}</p>}
          <p className="text-xs text-muted-foreground mt-1">{videoLoading && videoBalance !== null ? "Atualizando..." : "Saldo disponível"}</p>
        </CardContent></Card>
      </motion.div>

`;
  credits = credits.replace(balanceCardMarker, compactCards + balanceCardMarker);
}

// 4) Atualiza os três dados sem recarregar a plataforma.
const refreshHandler = 'onClick={() => { void refetchBalance(); void refetchTx(); void loadVideoBalance(); }}';
credits = credits.replace(
  /onClick=\{\(\) => \{ void refetchBalance\(\); void refetchTx\(\); \}\}/,
  refreshHandler,
);
credits = credits.replace('onClick={() => window.location.reload()}', refreshHandler);
credits = credits.replace(
  /disabled=\{fetchingBalance \|\| fetchingTx\}/,
  'disabled={fetchingBalance || fetchingTx || videoLoading}',
);
credits = credits.replace(
  /\$\{\(fetchingBalance \|\| fetchingTx\) \? "animate-spin" : ""\}/,
  '${(fetchingBalance || fetchingTx || videoLoading) ? "animate-spin" : ""}',
);

// 5) Transações de vídeo usam unidade própria.
if (!credits.includes("function isVideoTransaction")) {
  credits = credits.replace(
    `function isCreativeTransaction(tx: { balanceType?: string | null; description?: string }): boolean {
  return tx.balanceType === "creative" || /imagem|criativo/i.test(tx.description ?? "");
}`,
    `function isCreativeTransaction(tx: { balanceType?: string | null; description?: string }): boolean {
  return tx.balanceType === "creative" || /imagem|criativo/i.test(tx.description ?? "");
}

function isVideoTransaction(tx: { balanceType?: string | null; description?: string }): boolean {
  return tx.balanceType === "video" || /vídeo com efeito/i.test(tx.description ?? "");
}`,
  );
}
credits = credits.replace(
  /function formatTransactionAmount\(tx: \{ amount: number; balanceType\?: string \| null; description\?: string \}\): string \{[\s\S]*?\n\}/,
  `function formatTransactionAmount(tx: { amount: number; balanceType?: string | null; description?: string }): string {
  const video = isVideoTransaction(tx);
  const creative = isCreativeTransaction(tx);
  const value = creative ? tx.amount / 10 : tx.amount;
  const unit = video
    ? (Math.abs(value) === 1 ? " vídeo" : " vídeos")
    : creative
      ? (Math.abs(value) === 1 ? " imagem" : " imagens")
      : " créditos";
  return \`${'${value >= 0 ? "+" : ""}'}${'${value.toLocaleString("pt-BR")}'}${'${unit}'}\`;
}`,
);
credits = credits.replace(
  /function formatTransactionBalance\(tx: \{ balanceAfter: number; balanceType\?: string \| null; description\?: string \}\): string \{[\s\S]*?\n\}/,
  `function formatTransactionBalance(tx: { balanceAfter: number; balanceType?: string | null; description?: string }): string {
  const video = isVideoTransaction(tx);
  const creative = isCreativeTransaction(tx);
  const value = creative ? tx.balanceAfter / 10 : tx.balanceAfter;
  const unit = video
    ? (Math.abs(value) === 1 ? "vídeo" : "vídeos")
    : creative
      ? (Math.abs(value) === 1 ? "imagem" : "imagens")
      : "créditos";
  return \`${'${value.toLocaleString("pt-BR")}'} ${'${unit}'}\`;
}`,
);
credits = credits.replace(
  'if (lower.includes("criação de prompt")) return "Criação de prompt";',
  'if (lower.includes("criação de prompt")) return "Criação de prompt";\n  if (lower.includes("vídeo com efeito entregue")) return "Geração de vídeo com efeito";',
);

for (const forbidden of [
  "helpUsed",
  "helpLoading",
  "loadHelpUsage",
  'fetch("/api/help/usage"',
  "Mensagens utilizadas",
  "HelpCircle",
]) {
  if (credits.includes(forbidden)) {
    throw new Error(`User Credits still contains Help-specific loading: ${forbidden}`);
  }
}
if (!credits.includes('data-testid="centralized-credit-balances"')) {
  throw new Error("Centralized credit cards were not inserted");
}
if (!credits.includes("Vídeos com efeito") || !credits.includes("Créditos gerais") || !credits.includes("Imagens")) {
  throw new Error("Three user credit cards are missing");
}
if (!credits.includes("const loadVideoBalance = async")) {
  throw new Error("Video balance loading was not applied");
}
if (!credits.includes("const videoRetryRef = useRef<number | null>(null);")) {
  throw new Error("Video balance automatic recovery was not applied");
}
if (!credits.includes("void loadVideoBalance();") || !credits.includes("}, 3000);")) {
  throw new Error("Video balance retry scheduling was not applied");
}
if (credits.includes("window.location.reload()")) {
  throw new Error("Credits refresh still reloads the whole application");
}
if (!credits.includes("function isVideoTransaction")) {
  throw new Error("Video transaction formatting was not applied");
}

writeFileSync(sidebarUrl, sidebar);
writeFileSync(creditsUrl, credits);
writeFileSync(dashboardUrl, dashboard);
console.log("Video balance now retries automatically in isolation until it loads, without changing other credit blocks.");
