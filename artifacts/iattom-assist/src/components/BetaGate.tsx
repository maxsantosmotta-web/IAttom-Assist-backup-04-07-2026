import { Redirect } from "wouter";
import { useUser } from "@clerk/react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

interface BetaGateProps {
  children: React.ReactNode;
}

export function BetaGate({ children }: BetaGateProps) {
  const { user, isLoaded } = useUser();
  const { data: me, isLoading: meLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 30_000 },
  });

  if (!isLoaded || meLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-[#0a0a0a]">
        <div className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const hasOnboarded = user
    ? !!localStorage.getItem(`iattom_onboarded_${user.id}`)
    : false;
  const hasPaidPlan = me?.plan !== undefined && me.plan !== "free";

  if (!hasOnboarded && !hasPaidPlan) {
    return <Redirect to="/onboarding" />;
  }

  return <>{children}</>;
}
