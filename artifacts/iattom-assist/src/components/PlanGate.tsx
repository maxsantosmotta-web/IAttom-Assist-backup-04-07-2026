import { Redirect, useLocation } from "wouter";
import {
  useGetMe, getGetMeQueryKey,
  useGetStripeSubscription, getGetStripeSubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

const GLOBAL_BETA = import.meta.env.VITE_GLOBAL_BETA_MODE === "true";
const OWNER_EMAIL = "maxsantosmotta@gmail.com";

export function PlanGate({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn, isLoaded, user } = useUser();

  const { data: me, isLoading: meLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 0, enabled: !!isSignedIn },
  });
  const { data: subscription, isLoading: subLoading, isError: subError } = useGetStripeSubscription({
    query: {
      queryKey: getGetStripeSubscriptionQueryKey(),
      retry: false,
      staleTime: 30_000,
      enabled: !!isSignedIn,
    },
  });

  const email = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? "";
  const isOwner = email === OWNER_EMAIL;

  // Never gate on the billing page itself (prevents redirect loop)
  if (location === "/dashboard/billing") return <>{children}</>;

  // Owner account always has full access for platform testing.
  if (isOwner) return <>{children}</>;

  // Wait for essential data — render children while loading (no flash redirect)
  if (!isLoaded || meLoading || subLoading) return <>{children}</>;

  // Admins bypass gate
  if (me?.role === "admin") return <>{children}</>;

  // If Stripe check errored (not configured), fail open — let user through
  if (subError) return <>{children}</>;

  // Has an active paid subscription — access granted
  if (subscription?.hasSubscription === true) return <>{children}</>;

  // Global beta mode: bypass plan restriction temporarily
  if (GLOBAL_BETA) return <>{children}</>;

  // No active subscription → force to billing/plans screen
  return <Redirect to="/dashboard/billing" />;
}
