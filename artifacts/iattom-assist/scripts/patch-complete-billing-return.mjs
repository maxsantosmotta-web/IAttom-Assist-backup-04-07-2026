import fs from "node:fs";

const billingPath = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = fs.readFileSync(billingPath, "utf8");

const startMarker = "  useEffect(() => {\n    const params = new URLSearchParams(window.location.search);\n    const payment = params.get(\"payment\");";
const endMarker = "  }, [location]);";
const start = source.indexOf(startMarker);
const end = start === -1 ? -1 : source.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  if (!source.includes('fetch("/api/stripe/reconcile-session"')) {
    throw new Error("Billing return effect markers not found");
  }
} else {
  const replacement = `  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (!payment) return;

    if (payment === "canceled") {
      toast({ title: "Checkout cancelado", description: "Nenhuma cobrança foi realizada." });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    const isCheckoutReturn = payment === "success" || payment === "credits_success" || payment === "video_success";
    const isUpgradeReturn = payment === "upgrade_success";
    if (!isCheckoutReturn && !isUpgradeReturn) return;

    let cancelled = false;
    const reconcileReturn = async () => {
      try {
        if (isCheckoutReturn) {
          if (!sessionId) throw new Error("Sessão de pagamento não encontrada no retorno do Stripe.");

          const response = await fetch("/api/stripe/reconcile-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ sessionId }),
          });
          const result = await response.json() as { ok?: boolean; message?: string; error?: string };
          if (!response.ok || result.ok === false) {
            throw new Error(result.error ?? result.message ?? "Falha ao confirmar o pagamento.");
          }
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetStripeSubscriptionQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() }),
        ]);
        await Promise.all([refetchSub(), refetchMe(), refetchCredits()]);

        if (cancelled) return;
        if (payment === "success") {
          toast({ title: "Pagamento confirmado", description: "Plano e créditos aplicados à sua conta." });
        } else if (payment === "upgrade_success") {
          toast({ title: "Upgrade confirmado", description: "Seu plano e seus saldos foram atualizados sem criar outra assinatura." });
        } else if (payment === "credits_success") {
          toast({ title: "Compra confirmada", description: "O pacote foi somado ao saldo extra da sua conta." });
        } else {
          toast({ title: "Pacote confirmado", description: "Seus vídeos foram adicionados ao saldo da conta." });
          fetch("/api/videos/balance", { credentials: "include" })
            .then((r) => r.json())
            .then((d) => setVideoBalance((d as { videoBalance: number }).videoBalance ?? 0))
            .catch(() => {});
        }
        window.history.replaceState({}, "", window.location.pathname);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Não foi possível confirmar o pagamento.";
        console.error("Billing return reconciliation failed", error);
        toast({
          title: "Pagamento recebido, confirmação pendente",
          description: message,
          variant: "destructive",
        });
      }
    };

    void reconcileReturn();
    return () => { cancelled = true; };
  }, [location]);`;

  source = source.slice(0, start) + replacement + source.slice(end + endMarker.length);
}

const refreshPattern = /  const handleBillingRefresh = (?:async )?\(\) => \{[\s\S]*?\n  \};/;
const refreshReplacement = `  const handleBillingRefresh = async () => {
    try {
      const response = await fetch("/api/stripe/reconcile-latest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const result = await response.json() as {
        ok?: boolean;
        message?: string;
        generalGranted?: number;
        creativeGranted?: number;
      };

      if (!response.ok || result.ok === false) {
        throw new Error(result.message ?? "Falha ao reconciliar a assinatura.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetStripeSubscriptionQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() }),
      ]);
      await Promise.all([refetchPlans(), refetchSub(), refetchMe(), refetchCredits()]);

      const granted = (result.generalGranted ?? 0) + (result.creativeGranted ?? 0);
      toast({
        title: granted > 0 ? "Franquias atualizadas" : "Faturamento atualizado",
        description: result.message ?? "Plano e saldos conferidos com sucesso.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar o faturamento.";
      console.error("Billing manual reconciliation failed", error);
      toast({
        title: "Não foi possível atualizar",
        description: message,
        variant: "destructive",
      });
    }
  };`;

if (refreshPattern.test(source)) {
  source = source.replace(refreshPattern, refreshReplacement);
} else if (!source.includes('fetch("/api/stripe/reconcile-latest"')) {
  throw new Error("Billing refresh reconciliation marker not found");
}

fs.writeFileSync(billingPath, source);
console.log("Stripe checkout return and manual billing refresh expose the real reconciliation result.");
