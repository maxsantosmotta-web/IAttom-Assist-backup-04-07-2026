import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(billingUrl, "utf8");

const priceMapMarker = "const STRIPE_BILLING_PRICE_IDS";
if (!source.includes(priceMapMarker)) {
  const insertAfter = `const IMAGE_PACKAGES = [`;
  const index = source.indexOf(insertAfter);
  if (index === -1) throw new Error("IMAGE_PACKAGES marker not found");
  const map = `const STRIPE_BILLING_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  pro: {
    monthly: "price_1TvgAOAYtu5nLhAZmgqhsTxJ",
    annual: "price_1TvgDBAYtu5nLhAZsgenq5SJ",
  },
  business: {
    monthly: "price_1TvgEwAYtu5nLhAZvWozumfH",
    annual: "price_1TvgFWAYtu5nLhAZuT001wT5",
  },
  agency: {
    monthly: "price_1TvgGHAYtu5nLhAZt4gYmBM5",
    annual: "price_1TvgGgAYtu5nLhAZO8FYa6nK",
  },
};

`;
  source = source.slice(0, index) + map + source.slice(index);
}

const oldCheckout = `    checkout.mutate({ data: { priceId: priceId ?? "free", planKey } });`;
const newCheckout = `    const officialPriceId = STRIPE_BILLING_PRICE_IDS[planKey]?.[billing];
    const selectedPriceId = officialPriceId ?? priceId;
    if (!selectedPriceId) {
      toast({ title: "Preço indisponível", description: "O plano selecionado ainda não está disponível para compra.", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId: selectedPriceId, planKey }),
      });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? \`HTTP \${response.status}\`);
      }
      if (!payload.url) {
        throw new Error("Checkout sem URL de redirecionamento");
      }
      window.location.href = payload.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ title: "Não foi possível iniciar o upgrade", description: message, variant: "destructive" });
    }`;
if (source.includes(oldCheckout)) {
  source = source.replace(oldCheckout, newCheckout);
} else if (!source.includes('fetch("/api/stripe/checkout"')) {
  throw new Error("Billing checkout handler marker not found");
}

const oldPaymentEffect = `  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      toast({ title: "Pagamento realizado", description: "Seu plano foi ativado. Créditos adicionados à sua conta." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "credits_success") {
      toast({ title: "Créditos adicionados", description: "Seus créditos foram somados ao saldo da conta." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "video_success") {
      toast({ title: "Pacote de vídeos adicionado", description: "Seus vídeos foram adicionados ao saldo da conta." });
      window.history.replaceState({}, "", window.location.pathname);
      fetch("/api/videos/balance", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setVideoBalance((d as { videoBalance: number }).videoBalance ?? 0))
        .catch(() => {});
    } else if (payment === "canceled") {
      toast({ title: "Checkout cancelado", description: "Nenhuma cobrança foi realizada." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location]);`;

const newPaymentEffect = `  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success") {
      const reconcile = async () => {
        try {
          const endpoint = sessionId ? "/api/stripe/reconcile-session" : "/api/stripe/reconcile-latest";
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: sessionId ? JSON.stringify({ sessionId }) : JSON.stringify({}),
          });
          const payload = await response.json() as { ok?: boolean; error?: string; message?: string };
          if (!response.ok || payload.ok === false) {
            throw new Error(payload.error ?? payload.message ?? "Falha ao ativar a assinatura");
          }
          await Promise.all([refetchSub(), refetchMe(), refetchCredits()]);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getGetStripeSubscriptionQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() }),
          ]);
          toast({ title: "Pagamento confirmado", description: "Plano ativado e créditos adicionados à sua conta." });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao ativar a assinatura";
          toast({ title: "Pagamento confirmado, ativação pendente", description: message, variant: "destructive" });
        } finally {
          window.history.replaceState({}, "", window.location.pathname);
        }
      };
      void reconcile();
    } else if (payment === "credits_success") {
      toast({ title: "Créditos adicionados", description: "Seus créditos foram somados ao saldo da conta." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "video_success") {
      toast({ title: "Pacote de vídeos adicionado", description: "Seus vídeos foram adicionados ao saldo da conta." });
      window.history.replaceState({}, "", window.location.pathname);
      fetch("/api/videos/balance", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setVideoBalance((d as { videoBalance: number }).videoBalance ?? 0))
        .catch(() => {});
    } else if (payment === "canceled") {
      toast({ title: "Checkout cancelado", description: "Nenhuma cobrança foi realizada." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location]);`;

if (source.includes(oldPaymentEffect)) {
  source = source.replace(oldPaymentEffect, newPaymentEffect);
} else if (
  !source.includes('"/api/stripe/reconcile-latest"') &&
  !source.includes('"/api/stripe/reconcile-session"')
) {
  throw new Error("Billing payment reconciliation effect marker not found");
}

const refreshNeedle = '  const handleBillingRefresh = () => { void refetchPlans(); void refetchSub(); void refetchMe(); void refetchCredits(); };';
const refreshReplacement = `  const handleBillingRefresh = async () => {
    try {
      await fetch("/api/stripe/reconcile-latest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
    } catch {
      // Refresh still proceeds even when there is no completed Stripe session.
    }
    await Promise.all([refetchPlans(), refetchSub(), refetchMe(), refetchCredits()]);
  };`;
if (source.includes(refreshNeedle)) {
  source = source.replace(refreshNeedle, refreshReplacement);
} else if (!source.includes('await fetch("/api/stripe/reconcile-latest"')) {
  throw new Error("Billing refresh reconciliation marker not found");
}

const imageStart = source.indexOf("{/* ── Pacotes de Imagem (Criativos)");
const videoStart = source.indexOf("{/* ── Pacotes de Vídeo", imageStart);
if (imageStart === -1 || videoStart === -1) throw new Error("Package section markers not found");

let imageSection = source.slice(imageStart, videoStart);
imageSection = imageSection.replace(
  `className={\`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 opacity-60 cursor-not-allowed \${pkg.bg} \${pkg.border}\`}
              >
                <div className="absolute inset-0 z-10 rounded-xl bg-black/25 pointer-events-none" />
                <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-semibold text-zinc-300">
                  <Lock className="w-3 h-3" /> Em breve
                </div>`,
  `className={\`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 transition-all duration-200 \${pkg.bg} \${pkg.border}\`}
              >`,
);
imageSection = imageSection.replace(
  `                <Button
                  size="sm"
                  className="w-full h-9 text-xs bg-white/5 text-zinc-500 border border-white/10 cursor-not-allowed"
                  disabled
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> Em breve
                </Button>`,
  `                <Button
                  size="sm"
                  className={\`w-full h-9 text-xs \${pkg.btn}\`}
                  onClick={() => handleBuyImagePack(pkg.id)}
                  disabled={isPending || imagePending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar</>
                  }
                </Button>`,
);
source = source.slice(0, imageStart) + imageSection + source.slice(videoStart);

const refreshedVideoStart = source.indexOf("{/* ── Pacotes de Vídeo");
const videoEnd = source.indexOf("{/* ── Referral CTA", refreshedVideoStart);
if (refreshedVideoStart === -1 || videoEnd === -1) throw new Error("Video section boundaries not found");
let videoSection = source.slice(refreshedVideoStart, videoEnd);

const activeVideoButton = `                <Button
                  size="sm"
                  className={\`w-full h-9 text-xs \${pkg.btn}\`}
                  onClick={() => handleBuyVideoPack(pkg.id)}
                  disabled={isPending || videoPending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar</>
                  }
                </Button>`;
const brightLockedVideoButton = `                <Button
                  size="sm"
                  className={\`w-full h-9 text-xs \${pkg.btn} opacity-100 cursor-not-allowed\`}
                  disabled
                  aria-disabled="true"
                  title="Pacotes de vídeo em breve"
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> Em breve
                </Button>`;
if (videoSection.includes(activeVideoButton)) {
  videoSection = videoSection.replace(activeVideoButton, brightLockedVideoButton);
} else {
  videoSection = videoSection.replace(
    `className="w-full h-9 text-xs bg-white/5 text-zinc-500 border border-white/10 cursor-not-allowed"`,
    `className={\`w-full h-9 text-xs \${pkg.btn} opacity-100 cursor-not-allowed\`}`,
  );
}
videoSection = videoSection
  .replace("opacity-60 cursor-not-allowed", "transition-all duration-200")
  .replace(`                <div className="absolute inset-0 z-10 rounded-xl bg-black/25 pointer-events-none" />\n`, "")
  .replace(`                <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-semibold text-zinc-300">\n                  <Lock className="w-3 h-3" /> Em breve\n                </div>\n`, "");
source = source.slice(0, refreshedVideoStart) + videoSection + source.slice(videoEnd);

writeFileSync(billingUrl, source);

await import("./patch-temporary-billing-test.mjs");

console.log("Billing checkout and post-payment reconciliation applied; temporary prices and credit tests remain enabled.");