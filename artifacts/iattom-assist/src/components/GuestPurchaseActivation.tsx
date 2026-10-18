import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

const STORAGE_KEY = "iattom_guest_paid_checkout";
const VALID_SESSION = /^cs_live_[A-Za-z0-9_]{6,255}$/;
type State = "idle" | "waiting-login" | "submitting" | "success" | "attention";
type Result = { ok?: boolean; code?: string; plan?: string; creditsGranted?: number };

function captureReturn(): string | null {
  try {
    const url = new URL(window.location.href);
    if (url.pathname.endsWith("/commercial/activate")) {
      const id = url.searchParams.get("session_id") ?? "";
      if (VALID_SESSION.test(id)) {
        sessionStorage.setItem(STORAGE_KEY, id);
        // Remove the Stripe Session ID from subsequent URL sharing or history.
        window.history.replaceState(window.history.state, "", url.pathname);
      }
    }
    const stored = sessionStorage.getItem(STORAGE_KEY) ?? "";
    return VALID_SESSION.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Isolated guest purchase return. Reactivates after Clerk redirects the user
 * to any page; never trusts a client-supplied plan, price, credits or email.
 * The server verifies Stripe + signed prereg + Clerk and grants via canonical.
 */
export function GuestPurchaseRecovery() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const queries = useQueryClient();
  const tried = useRef("");
  const [checkoutId, setCheckoutId] = useState<string | null>(captureReturn);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  const submit = async (force = false) => {
    if (!checkoutId || !isLoaded || !isSignedIn || !userId) return;
    const attempt = userId + ":" + checkoutId;
    if (!force && tried.current === attempt) return;
    tried.current = attempt;
    setState("submitting");
    setMessage("Validando sua assinatura com segurança...");
    try {
      const token = await getToken();
      if (!token) throw new Error("CLERK_SESSION_REQUIRED");
      const reply = await fetch("/api/stripe/guest/claim", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: checkoutId }),
      });
      const result = (await reply.json()) as Result;
      if (reply.ok && result.ok === true && (
        result.code === "GUEST_SUBSCRIPTION_RECOGNIZED" ||
        result.code === "ALREADY_RECONCILED"
      )) {
        sessionStorage.removeItem(STORAGE_KEY);
        setCheckoutId(null);
        setState("success");
        setMessage("Assinatura reconhecida! Seu plano e seus créditos já podem ser consultados no painel.");
        await queries.invalidateQueries();
        return;
      }
      setState("attention");
      if (result.code === "CLERK_PRIMARY_EMAIL_NOT_VERIFIED" ||
          result.code === "PURCHASE_LINK_NOT_AUTHORIZED") {
        setMessage("Entre com a conta cujo e-mail principal verificado corresponde ao pré-cadastro. Sua compra permanece pendente para conferência.");
      } else if (result.code === "GUEST_CLAIM_NOT_RELEASED" ||
                 result.code === "PAID_PURCHASE_NOT_STORED") {
        setMessage("O recebimento de assinaturas pela landing ainda não foi liberado. Nenhuma compra será ativada por esta tela.");
      } else {
        setMessage("A compra ainda não foi reconhecida nesta conta. Não faça outra compra: você pode tentar a verificação novamente.");
      }
    } catch {
      setState("attention");
      setMessage("Não foi possível conferir a assinatura agora. Não faça outra compra; tente novamente.");
    }
  };

  useEffect(() => {
    if (!checkoutId || !isLoaded) return;
    if (!isSignedIn) {
      setState("waiting-login");
      setMessage("Entre com o e-mail informado no pré-cadastro para ativar a compra.");
      return;
    }
    void submit();
  }, [checkoutId, isLoaded, isSignedIn, userId]);

  if (!checkoutId && state !== "success") return null;
  return <section role="status" aria-live="polite"
    className="fixed bottom-3 left-3 right-3 z-[900] mx-auto max-w-md rounded-xl border border-amber-600/50 bg-[#101010] p-4 text-sm text-white shadow-2xl">
    <div className="mb-2 font-semibold text-amber-300">Compra realizada pela landing IAttom</div>
    <p>{message || "Preparando verificação da assinatura..."}</p>
    {state === "waiting-login" && <div className="mt-3 flex gap-3 text-amber-300">
      <Link href="/sign-in">Entrar na minha conta</Link>
      <Link href="/sign-up">Criar conta</Link>
    </div>}
    {state === "attention" && !!checkoutId && !!isSignedIn &&
      <button type="button" onClick={() => void submit(true)}
        className="mt-3 rounded bg-amber-500 px-3 py-2 font-semibold text-black">
        Verificar novamente
      </button>}
    {state === "success" &&
      <Link href="/dashboard/credits" className="mt-3 inline-block text-amber-300">
        Conferir meus créditos
      </Link>}
  </section>;
}

export function GuestPurchaseActivation() {
  return <main className="flex min-h-[65vh] items-center justify-center bg-[#0a0a0a] px-5 text-center text-white">
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-amber-300">Ativação da assinatura IAttom</h1>
      <p>Para reconhecer a compra, entre com a conta correspondente ao e-mail do pré-cadastro. Se ainda não possui conta, faça seu cadastro.</p>
      <div className="flex justify-center gap-6 text-amber-300">
        <Link href="/sign-in">Entrar</Link>
        <Link href="/sign-up">Criar conta</Link>
        <Link href="/dashboard/credits">Meus créditos</Link>
      </div>
      <p className="text-xs text-zinc-400">Nenhuma compra adicional é necessária para verificar uma assinatura já paga.</p>
    </div>
  </main>;
}
