import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  useGetMe,
  getGetMeQueryKey,
  useGetCreditsBalance,
  getGetCreditsBalanceQueryKey,
} from "@workspace/api-client-react";
import { PLAN_NAMES, PLAN_CREDITS, FEATURE_COSTS } from "@/lib/credits";
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
  const planLimit = PLAN_CREDITS[planSlug] ?? PLAN_CREDITS.free;
  const percentage = balance?.percentage ?? 0;
  const isLoaded = !meLoading && me !== undefined;

  const canUseFeature = (feature: FeatureKey): boolean => {
    if (isAdmin) return true;
    return credits >= FEATURE_COSTS[feature];
  };

  const unlockedModules = (Object.keys(FEATURE_COSTS) as FeatureKey[]).filter(
    (f) => isAdmin || credits >= FEATURE_COSTS[f],
  );

  return {
    isAdmin,
    planSlug,
    planName,
    credits,
    planLimit,
    percentage,
    isLoaded,
    canUseFeature,
    unlockedModules,
    me,
    balance,
  };
}
