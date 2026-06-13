import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  useGetMe,
  getGetMeQueryKey,
  useGetCreditsBalance,
  getGetCreditsBalanceQueryKey,
} from "@workspace/api-client-react";
import { PLAN_NAMES, PLAN_CREDITS, PLAN_CREATIVE_CREDITS, FEATURE_COSTS, CREATIVE_FEATURES } from "@/lib/credits";
import type { FeatureKey } from "@/lib/credits";

export function useUserAccess() {
  const qc = useQueryClient();

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

  const isAdmin = me?.role === "admin";
  const planSlug = (me?.plan ?? "free") as keyof typeof PLAN_CREDITS;
  const planName = PLAN_NAMES[planSlug] ?? planSlug.toUpperCase();

  const credits = balance?.balance ?? 0;
  const creativeCredits = balance?.creativeBalance ?? 0;
  const planLimit = PLAN_CREDITS[planSlug] ?? PLAN_CREDITS.free;
  const creativePlanLimit = PLAN_CREATIVE_CREDITS[planSlug] ?? PLAN_CREATIVE_CREDITS.free;
  const percentage = balance?.percentage ?? 0;
  const creativePercentage = balance?.creativePercentage ?? 0;
  const isLoaded = !meLoading && me !== undefined;

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
    planSlug,
    planName,
    credits,
    creativeCredits,
    planLimit,
    creativePlanLimit,
    percentage,
    creativePercentage,
    isLoaded,
    canUseFeature,
    unlockedModules,
    me,
    balance,
  };
}
