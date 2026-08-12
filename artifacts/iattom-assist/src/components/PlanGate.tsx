import { useEffect, useState } from "react";
import { Redirect, useLocation } from "wouter";
import {
  useGetMe, getGetMeQueryKey,
  useGetStripeSubscription, getGetStripeSubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useAuth, useUser } from "@clerk/react";

const GLOBAL_BETA = import.meta.env.VITE_GLOBAL_BETA_MODE === "true";
const OWNER_EMAIL = "maxsantosmotta@gmail.com";

type GooglePlayStatus = {
  hasSubscription?: boolean;
};

export function PlanGate({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn, isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const [googleStatus, setGoogleStatus] = useState<GooglePlayStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState(false);

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

  useEffect(() => {
    if (!isSignedIn) {
      setGoogleStatus(null);
      setGoogleError(false);
      setGoogleLoading(false);
      return;
    }

    let cancelled = false;
    setGoogleLoading(true);
    setGoogleError(false);

    void (async () => {
      try {
        const token = await getToken();
        const response = await fetch("/api/google-play/subscription/status", {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) throw new Error("google_play_status_failed");
        const payload = await response.json() as GooglePlayStatus;
        if (!cancelled) setGoogleStatus(payload);
      } catch {
        if (!cancelled) {
          setGoogleError(true);
          setGoogleStatus(null);
        }
      } finally {
        if (!cancelled) setGoogleLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  const email = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? "";
  const isOwner = email === OWNER_EMAIL;

  if (location === "/dashboard/billing") return <>{children}</>;
  if (isOwner) return <>{children}</>;
  if (!isLoaded || meLoading || subLoading || googleLoading) return <>{children}</>;
  if (me?.role === "admin") return <>{children}</>;
  if (me?.plan === "free" && me?.planSelected === true) return <>{children}</>;
  if (subscription?.hasSubscription === true) return <>{children}</>;
  if (googleStatus?.hasSubscription === true) return <>{children}</>;

  // Preserva o comportamento histórico de fail-open se ambos os provedores de assinatura estiverem indisponíveis.
  if (subError && googleError) return <>{children}</>;
  if (GLOBAL_BETA) return <>{children}</>;

  return <Redirect to="/dashboard/billing" />;
}
