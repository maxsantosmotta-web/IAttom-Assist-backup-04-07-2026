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

// 3) Adiciona saldos independentes de vídeo e uso do Help na tela Créditos.
if (!credits.includes('import { useEffect, useState } from "react";')) {
  credits = credits.replace(
    'import { motion } from "framer-motion";',
    'import { motion } from "framer-motion";\nimport { useEffect, useState } from "react";',
  );
}
credits = credits.replace(
  'import { Zap, TrendingUp, RefreshCw } from "lucide-react";',
  'import { Zap, TrendingUp, RefreshCw, Image, Video, HelpCircle } from "lucide-react";',
);

const componentMarker = `export function Credits() {\n  const [, navigate] = useLocation();`;
const resilientStateBlock = `export function Credits() {
  const [, navigate] = useLocation();
  const [videoBalance, setVideoBalance] = useState<number | null>(null);
  const [helpUsed, setHelpUsed] = useState<number | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [helpLoading, setHelpLoading] = useState(true);

  const loadVideoBalance = async () => {
    setVideoLoading(true);
    try {
      const response = await fetch("/api/videos/balance", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("video balance request failed");
      const video = await response.json() as { videoBalance?: number };
      setVideoBalance(Number(video.videoBalance ?? 0));
    } catch {
      // Mantém o último saldo válido em falhas temporárias.
    } finally {
      setVideoLoading(false);
    }
  };

  const loadHelpUsage = async () => {
    setHelpLoading(true);
    try {
      const response = await fetch("/api/help/usage", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("help usage request failed");
      const help = await response.json() as { used?: number };
      setHelpUsed(Number(help.used ?? 0));
    } catch {
      // Mantém o último contador válido em falhas temporárias.
    } finally {
      setHelpLoading(false);
    }
  };

  useEffect(() => {
    void loadVideoBalance();
    void loadHelpUsage();
  }, []);`;

if (credits.includes(componentMarker) && !credits.includes("const loadVideoBalance = async")) {
  credits = credits.replace(componentMarker, resilientStateBlock);
} else {
  credits = credits.replace(
    /export function Credits\(\) \{\n  const \[, navigate\] = useLocation\(\);\n  const \[videoBalance, setVideoBalance\][\s\S]*?\n  \}, \[\]\);/,
    resilientStateBlock,
  );
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
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
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
        <Card className="bg-[#111111] border-white/5"><CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3"><HelpCircle className="w-4 h-4 text-sky-400" /><span className="text-xs uppercase tracking-widest text-muted-foreground">IAttom Help</span></div>
          {helpUsed === null ? <Skeleton className="h-9 w-16 bg-white/5" /> : <p className="text-3xl font-bold text-white tabular-nums">{helpUsed.toLocaleString("pt-BR")}</p>}
          <p className="text-xs text-muted-foreground mt-1">{helpLoading && helpUsed !== null ? "Atualizando..." : "Mensagens utilizadas"}</p>
        </CardContent></Card>
      </motion.div>

`;
  credits = credits.replace(balanceCardMarker, compactCards + balanceCardMarker);
}

// 4) Atualiza os quatro dados sem recarregar a plataforma.
const refreshHandler = 'onClick={() => { void refetchBalance(); void refetchTx(); void loadVideoBalance(); void loadHelpUsage(); }}';
credits = credits.replace(
  /onClick=\{\(\) => \{ void refetchBalance\(\); void refetchTx\(\); \}\}/,
  refreshHandler,
);
credits = credits.replace(
  'onClick={() => window.location.reload()}',
  refreshHandler,
);
credits = credits.replace(
  /disabled=\{fetchingBalance \|\| fetchingTx\}/,
  'disabled={fetchingBalance || fetchingTx || videoLoading || helpLoading}',
);
credits = credits.replace(
  /\$\{\(fetchingBalance \|\| fetchingTx\) \? "animate-spin" : ""\}/,
  '${(fetchingBalance || fetchingTx || videoLoading || helpLoading) ? "animate-spin" : ""}',
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

if (!credits.includes('data-testid="centralized-credit-balances"')) {
  throw new Error("Centralized credit cards were not inserted");
}
if (!credits.includes("Vídeos com efeito") || !credits.includes("Mensagens utilizadas")) {
  throw new Error("Centralized credit card labels are missing");
}
if (!credits.includes("const loadVideoBalance = async") || !credits.includes("void loadHelpUsage()")) {
  throw new Error("Independent credit loading was not applied");
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
console.log("Credit balances refresh independently without reloading the application.");
