import { Redirect, useLocation } from "wouter";
import {
  useGetMe, getGetMeQueryKey,
  useGetStripeSubscription, getGetStripeSubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

const GLOBAL_BETA = import.meta.env.VITE_GLOBAL_BETA_MODE === "true";
const OWNER_EMAIL = "maxsantosmotta@gmail.com";

function DashboardDataLoader() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <p className="text-xs text-zinc-500">Carregando seus dados...</p>
      </div>
    </div>
  );
}

export function PlanGate({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn, isLoaded, user } = useUser();

  const { data: me, isLoading: meLoading, isFetching: meFetching } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: 3, staleTime: 30_000, enabled: !!isSignedIn },
  });
  const { data: subscription, isLoading: subLoading, isFetching: subFetching, isError: subError } = useGetStripeSubscription({
    query: {
      queryKey: getGetStripeSubscriptionQueryKey(),
      retry: 3,
      staleTime: 30_000,
      enabled: !!isSignedIn,
    },
  });

  const email = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? "";
  const isOwner = email === OWNER_EMAIL;

  // Never gate on the billing page itself (prevents redirect loop)
  if (location === "/dashboard/billing") return <>{children}</>;

  // Owner account always has full access for platform testing after Clerk is ready.
  if (isOwner && isLoaded) return <>{children}</>;

  // Do not mount dashboard modules before Clerk, plan and subscription data are ready.
  // Mounting early caused modules to interpret temporary loading failures as empty data.
  if (!isLoaded || !isSignedIn || meLoading || meFetching || subLoading || subFetching || me === undefined) {
    return <DashboardDataLoader />;
  }

  // Admins bypass gate
  if (me.role === "admin") return <>{children}</>;

  // A FREE plan is valid after the user explicitly selects it.
  // FREE has no Stripe subscription, so it must be recognized from /auth/me.
  if (me.plan === "free" && me.planSelected === true) return <>{children}</>;

  // If Stripe check errored (not configured), fail open — let user through
  if (subError) return <>{children}</>;

  // Has an active paid subscription — access granted
  if (subscription?.hasSubscription === true) return <>{children}</>;

  // Global beta mode: bypass plan restriction temporarily
  if (GLOBAL_BETA) return <>{children}</>;

  // No selected FREE plan and no active paid subscription → billing
  return <Redirect to="/dashboard/billing" />;
}
