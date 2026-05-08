export const FEATURE_COSTS = {
  product_discovery: 5,
  product_validation: 5,
  campaign: 10,
  content: 8,
  creative: 15,
  video_script: 10,
} as const;

export const PLAN_CREDITS = {
  free: 50,
  pro: 500,
  business: 2000,
  agency: 10000,
} as const;

export const PLAN_NAMES: Record<string, string> = {
  free: "Cristal",
  pro: "Rubi",
  business: "Esmeralda",
  agency: "Diamante",
};

export const PLAN_PRICES: Record<string, { monthly: number; yearly: number; monthlyDisplay: string; yearlyDisplay: string; label: string; color: string }> = {
  free:     { monthly: 19.90, yearly: 197,  monthlyDisplay: "R$19,90/mês", yearlyDisplay: "R$197/ano",    label: "Cristal",   color: "text-sky-100"     },
  pro:      { monthly: 89,    yearly: 968,  monthlyDisplay: "R$89/mês",    yearlyDisplay: "R$968/ano",    label: "Rubi",      color: "text-rose-400"    },
  business: { monthly: 197,   yearly: 1997, monthlyDisplay: "R$197/mês",   yearlyDisplay: "R$1.997/ano",  label: "Esmeralda", color: "text-emerald-400" },
  agency:   { monthly: 497,   yearly: 4997, monthlyDisplay: "R$497/mês",   yearlyDisplay: "R$4.997/ano",  label: "Diamante",  color: "text-slate-100"   },
};

export type FeatureKey = keyof typeof FEATURE_COSTS;

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
