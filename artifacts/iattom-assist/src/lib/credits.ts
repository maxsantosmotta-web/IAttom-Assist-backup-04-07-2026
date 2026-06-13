export const FEATURE_COSTS = {
  product_discovery: 5,
  product_validation: 5,
  campaign: 10,
  content: 8,
  creativeImage1: 10,
  creativeImage2: 20,
  creativeImage3: 30,
  video_script: 10,
  prompt_creation: 5,
} as const;

export const PLAN_CREDITS = {
  free: 0,
  pro: 600,
  business: 1350,
  agency: 3000,
} as const;

export const PLAN_CREATIVE_CREDITS = {
  free: 0,
  pro: 100,
  business: 150,
  agency: 250,
} as const;

export type FeatureKey = keyof typeof FEATURE_COSTS;

export const CREATIVE_FEATURES = new Set<FeatureKey>([
  "creativeImage1",
  "creativeImage2",
  "creativeImage3",
]);

export const PLAN_NAMES: Record<string, string> = {
  free:     "FREE",
  pro:      "START",
  business: "PREMIUM",
  agency:   "PRO",
};

export const PLAN_SAVINGS: Record<string, number> = {
  free:     17,
  pro:      15,
  business: 18,
  agency:   20,
};

export const PLAN_PRICES: Record<string, {
  monthly: number;
  yearly: number;
  monthlyDisplay: string;
  yearlyDisplay: string;
  yearlyMonthlyDisplay: string;
  label: string;
  color: string;
}> = {
  free:     { monthly: 19.90, yearly: 197,  monthlyDisplay: "R$19,90/mês",  yearlyDisplay: "R$197/ano",    yearlyMonthlyDisplay: "R$16,42/mês",  label: "START",    color: "text-blue-300"   },
  pro:      { monthly: 69,    yearly: 697,  monthlyDisplay: "R$69/mês",     yearlyDisplay: "R$697/ano",    yearlyMonthlyDisplay: "R$58,08/mês",  label: "START",    color: "text-[#C9A84C]"  },
  business: { monthly: 159,   yearly: 1565, monthlyDisplay: "R$159/mês",    yearlyDisplay: "R$1.565/ano",  yearlyMonthlyDisplay: "R$130,42/mês", label: "PREMIUM",  color: "text-violet-400" },
  agency:   { monthly: 299,   yearly: 2870, monthlyDisplay: "R$299/mês",    yearlyDisplay: "R$2.870/ano",  yearlyMonthlyDisplay: "R$239,20/mês", label: "PRO",      color: "text-[#E8C96A]"  },
};

export function getCreditColor(percentage: number): string {
  if (percentage > 50) return "text-primary";
  if (percentage > 20) return "text-amber-400";
  return "text-red-400";
}

export function getCreditBarColor(percentage: number): string {
  if (percentage > 50) return "bg-primary";
  if (percentage > 20) return "bg-amber-400";
  return "bg-red-400";
}
