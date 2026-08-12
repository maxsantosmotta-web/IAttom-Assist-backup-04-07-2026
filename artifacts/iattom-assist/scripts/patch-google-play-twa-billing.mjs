import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let billing = readFileSync(billingUrl, "utf8");

const importMarker = 'import { PLAN_CREDITS, PLAN_NAMES, PLAN_PRICES, PLAN_SAVINGS } from "@/lib/credits";';
const playImport = `import {
  GOOGLE_PLAY_ONE_TIME_BY_UI_ID,
  GOOGLE_PLAY_SUBSCRIPTIONS,
  isGooglePlayBillingAvailable,
  purchaseGooglePlayOneTime,
  purchaseGooglePlaySubscription,
} from "@/lib/googlePlayBilling";`;

if (!billing.includes(playImport)) {
  if (!billing.includes(importMarker)) throw new Error("Billing credits import marker not found");
  billing = billing.replace(importMarker, `${importMarker}\n${playImport}`);
}

function replaceBlock(startMarker, endMarker, replacement) {
  const start = billing.indexOf(startMarker);
  const end = billing.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Billing block not found: ${startMarker} -> ${endMarker}`);
  }
  billing = billing.slice(0, start) + replacement + "\n\n" + billing.slice(end);
}

const stateMarker = '  const [videoBalance, setVideoBalance] = useState<number | null>(null);';
if (!billing.includes('const [playPending, setPlayPending]')) {
  if (!billing.includes(stateMarker)) throw new Error("Billing state marker not found");
  billing = billing.replace(
    stateMarker,
    `${stateMarker}\n  const [playPending, setPlayPending] = useState<string | null>(null);`,
  );
}

replaceBlock(
  "  const handleBuyImagePack = async (packId: string) => {",
  "  const handleBuyVideoPack = async (packId: string) => {",
  `  const handleBuyImagePack = async (packId: string) => {
    if (currentPlan === "free") {
      setShowComparison(true);
      return;
    }
    setImagePending(packId);
    try {
      if (await isGooglePlayBillingAvailable()) {
        const productId = GOOGLE_PLAY_ONE_TIME_BY_UI_ID[packId];
        if (!productId) throw new Error("Produto Google Play não mapeado");
        await purchaseGooglePlayOneTime(productId);
        await Promise.all([refetchMe(), refetchCredits()]);
        toast({ title: "Imagens adicionadas", description: "Seu pacote de imagens foi adicionado à conta." });
        return;
      }

      const resp = await fetch("/api/stripe/creatives/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: packId }),
        credentials: "include",
      });
      const data = await resp.json() as { url?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "checkout error");
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Não foi possível concluir a compra", description: "Tente novamente em alguns instantes.", variant: "destructive" });
    } finally {
      setImagePending(null);
    }
  };`,
);

replaceBlock(
  "  const handleBuyVideoPack = async (packId: string) => {",
  "  const handleBuyCredits = async (packageId: string) => {",
  `  const handleBuyVideoPack = async (packId: string) => {
    if (currentPlan === "free") {
      setShowComparison(true);
      return;
    }
    setVideoPending(packId);
    try {
      if (await isGooglePlayBillingAvailable()) {
        const productId = GOOGLE_PLAY_ONE_TIME_BY_UI_ID[packId];
        if (!productId) throw new Error("Produto Google Play não mapeado");
        await purchaseGooglePlayOneTime(productId);
        const balanceResponse = await fetch("/api/videos/balance", { credentials: "include" });
        if (balanceResponse.ok) {
          const balance = await balanceResponse.json() as { videoBalance?: number };
          setVideoBalance(balance.videoBalance ?? 0);
        }
        toast({ title: "Vídeos adicionados", description: "Seu pacote de vídeos foi adicionado à conta." });
        return;
      }

      const resp = await fetch("/api/stripe/videos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: packId }),
        credentials: "include",
      });
      const data = await resp.json() as { url?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "checkout error");
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Não foi possível concluir a compra", description: "Tente novamente em alguns instantes.", variant: "destructive" });
    } finally {
      setVideoPending(null);
    }
  };`,
);

replaceBlock(
  "  const handleBuyCredits = async (packageId: string) => {",
  "  const handleUpgrade = async (priceId: string | null | undefined, planKey: string) => {",
  `  const handleBuyCredits = async (packageId: string) => {
    if (currentPlan === "free") {
      setShowComparison(true);
      return;
    }
    setCreditsPending(packageId);
    try {
      if (await isGooglePlayBillingAvailable()) {
        const productId = GOOGLE_PLAY_ONE_TIME_BY_UI_ID[packageId];
        if (!productId) throw new Error("Produto Google Play não mapeado");
        await purchaseGooglePlayOneTime(productId);
        await Promise.all([refetchMe(), refetchCredits()]);
        toast({ title: "Créditos adicionados", description: "Seus créditos foram adicionados à conta." });
        return;
      }

      const resp = await fetch("/api/stripe/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
        credentials: "include",
      });
      const data = await resp.json() as { url?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "checkout error");
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Não foi possível concluir a compra", description: "Tente novamente em alguns instantes.", variant: "destructive" });
    } finally {
      setCreditsPending(null);
    }
  };`,
);

replaceBlock(
  "  const handleUpgrade = async (priceId: string | null | undefined, planKey: string) => {",
  "  /* ─── price display helpers",
  `  const handleUpgrade = async (priceId: string | null | undefined, planKey: string) => {
    if (planKey === "free") {
      setFreePending(true);
      try {
        const token = await getToken();
        const base = import.meta.env.BASE_URL ?? "/";
        await fetch(\`\${base}api/user/select-plan\`, {
          method: "POST",
          headers: { Authorization: \`Bearer \${token}\` },
        });
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/dashboard");
      } catch {
        toast({ title: "Erro ao selecionar plano", description: "Tente novamente em instantes.", variant: "destructive" });
      } finally {
        setFreePending(false);
      }
      return;
    }

    if (await isGooglePlayBillingAvailable()) {
      const config = GOOGLE_PLAY_SUBSCRIPTIONS[planKey as keyof typeof GOOGLE_PLAY_SUBSCRIPTIONS]?.[billing];
      if (!config) {
        toast({ title: "Plano indisponível", description: "Não foi possível localizar este plano no Google Play.", variant: "destructive" });
        return;
      }

      setPlayPending(planKey);
      try {
        await purchaseGooglePlaySubscription(config.productId, config.basePlanId);
        await Promise.all([refetchMe(), refetchCredits()]);
        toast({ title: "Assinatura confirmada", description: "Seu plano do Google Play foi ativado." });
      } catch {
        toast({ title: "Não foi possível concluir a assinatura", description: "Tente novamente em alguns instantes.", variant: "destructive" });
      } finally {
        setPlayPending(null);
      }
      return;
    }

    checkout.mutate({ data: { priceId: priceId ?? "free", planKey } });
  };`,
);

billing = billing.replaceAll(
  'disabled={planKey === "free" ? freePending : checkout.isPending}',
  'disabled={planKey === "free" ? freePending : (checkout.isPending || playPending !== null)}',
);

billing = billing.replaceAll(
  '(planKey === "free" ? freePending : checkout.isPending) && (',
  '(planKey === "free" ? freePending : (checkout.isPending || playPending === planKey)) && (',
);

for (const marker of [
  'GOOGLE_PLAY_SUBSCRIPTIONS',
  'purchaseGooglePlaySubscription',
  'purchaseGooglePlayOneTime',
  'playPending',
  'iattom_start_anual',
]) {
  if (!billing.includes(marker)) throw new Error(`Google Play Billing marker missing after patch: ${marker}`);
}

writeFileSync(billingUrl, billing);
console.log("Google Play TWA billing patch applied while preserving Stripe browser checkout.");