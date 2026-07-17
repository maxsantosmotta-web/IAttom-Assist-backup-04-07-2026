import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useUser } from "@clerk/react";
import {
  useGetMe,
  getGetMeQueryKey,
  useGetCreditsBalance,
  getGetCreditsBalanceQueryKey,
} from "@workspace/api-client-react";
import { PLAN_NAMES, PLAN_CREDITS, PLAN_CREATIVE_CREDITS, FEATURE_COSTS, CREATIVE_FEATURES } from "@/lib/credits";
import type { FeatureKey } from "@/lib/credits";

const OWNER_EMAIL = "maxsantosmotta@gmail.com";

export function useUserAccess() {
  const qc = useQueryClient();
  const { user, isLoaded: clerkLoaded } = useUser();

  const { data: me, isLoading: meLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), staleTime: 0 },
  });
  const { data: balance, isLoading: balanceLoading } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), staleTime: 0 },
  });

  useEffect(() => {
    void qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
  }, [qc]);

  const email = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? "";
  const isOwner = email === OWNER_EMAIL;
  const isAdmin = isOwner || me?.role === "admin";
  const planSlug = (isOwner ? "agency" : (me?.plan ?? "free")) as keyof typeof PLAN_CREDITS;
  const planName = PLAN_NAMES[planSlug] ?? planSlug.toUpperCase();

  const credits = isOwner ? 999999 : (balance?.balance ?? 0);
  const creativeCredits = isOwner ? 999999 : (balance?.creativeBalance ?? 0);
  const planLimit = isOwner ? 999999 : (PLAN_CREDITS[planSlug] ?? PLAN_CREDITS.free);
  const creativePlanLimit = isOwner ? 999999 : (PLAN_CREATIVE_CREDITS[planSlug] ?? PLAN_CREATIVE_CREDITS.free);
  const percentage = isOwner ? 100 : (balance?.percentage ?? 0);
  const creativePercentage = isOwner ? 100 : (balance?.creativePercentage ?? 0);
  const isLoaded = clerkLoaded && (isOwner || (!meLoading && me !== undefined));

  const canUseFeature = (feature: FeatureKey): boolean => {
    if (isAdmin) return true;
    if (CREATIVE_FEATURES.has(feature)) return creativeCredits >= FEATURE_COSTS[feature];
    return credits >= FEATURE_COSTS[feature];
  };

  const unlockedModules = (Object.keys(FEATURE_COSTS) as FeatureKey[]).filter((f) => {
    if (isAdmin) return true;
    if (CREATIVE_FEATURES.has(f)) return creativeCredits >= FEATURE_COSTS[f];
    return credits >= FEATURE_COSTS[f];
  });

  return {
    isAdmin,
    isOwner,
    planSlug,
    planName,
    credits,
    creativeCredits,
    planLimit,
    creativePlanLimit,
    percentage,
    creativePercentage,
    isLoaded: isLoaded && !balanceLoading,
    canUseFeature,
    unlockedModules,
    me,
    balance,
  };
}
