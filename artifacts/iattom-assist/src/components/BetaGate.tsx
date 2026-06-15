import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

interface BetaGateProps {
  children: React.ReactNode;
}

const Spinner = () => (
  <div className="flex items-center justify-center min-h-[100dvh] bg-[#0a0a0a]">
    <div className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

export function BetaGate({ children }: BetaGateProps) {
  const { isLoaded } = useUser();
  const [, navigate] = useLocation();

  const { data: me, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), staleTime: 0, enabled: isLoaded },
  });

  const needsOnboarding =
    me !== undefined &&
    me.role !== "admin" &&
    me.plan === "free" &&
    !me.betaAccess;

  useEffect(() => {
    if (!isLoaded || isLoading || me === undefined) return;
    if (needsOnboarding) navigate("/onboarding", { replace: true });
  }, [isLoaded, isLoading, me, needsOnboarding, navigate]);

  if (!isLoaded || isLoading || me === undefined) return <Spinner />;

  if (needsOnboarding) return <Spinner />;

  return <>{children}</>;
}
