import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { EmailVerificationModal } from "@/components/EmailVerificationModal";

interface BetaGateProps {
  children: React.ReactNode;
}

const PLAN_GATE_BYPASS = "/dashboard/billing";

const Spinner = () => (
  <div className="flex items-center justify-center min-h-[100dvh] bg-[#0a0a0a]">
    <div className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

const ErrorScreen = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex items-center justify-center min-h-[100dvh] bg-[#0a0a0a]">
    <div className="flex flex-col items-center gap-4 text-center px-4 max-w-xs">
      <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-500/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">Erro ao carregar</p>
        <p className="text-xs text-zinc-500">Nao foi possivel conectar ao servidor.</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 px-5 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-zinc-300 text-xs font-medium hover:bg-white/[0.10] hover:text-white transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  </div>
);

export function BetaGate({ children }: BetaGateProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [location, navigate] = useLocation();

  const { data: me, isLoading, isError, refetch } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), staleTime: 0, enabled: isLoaded && !!isSignedIn },
  });

  const isBillingPage = location === PLAN_GATE_BYPASS;

  const needsVerification =
    me !== undefined &&
    me.role !== "admin" &&
    !me.registrationConfirmed;

  const needsOnboarding =
    !isBillingPage &&
    me !== undefined &&
    me.role !== "admin" &&
    me.plan === "free" &&
    !me.planSelected;

  useEffect(() => {
    if (!isLoaded || isLoading || me === undefined) return;
    if (needsOnboarding && !needsVerification) navigate(PLAN_GATE_BYPASS, { replace: true });
  }, [isLoaded, isLoading, me, needsOnboarding, needsVerification, navigate]);

  // Aguarda Clerk carregar e a query executar
  if (!isLoaded || isLoading) return <Spinner />;

  // GET /auth/me falhou — exibe tela de erro com botão de retry.
  // Antes dessa guarda, me===undefined caia no spinner eterno acima.
  if (isError || me === undefined) return <ErrorScreen onRetry={() => void refetch()} />;

  if (needsVerification) {
    return (
      <>
        <Spinner />
        <EmailVerificationModal
          open={true}
          email={user?.primaryEmailAddress?.emailAddress}
          onClose={() => {}}
          onSuccess={() => navigate(PLAN_GATE_BYPASS, { replace: true })}
        />
      </>
    );
  }

  if (needsOnboarding) return <Spinner />;

  return <>{children}</>;
}
