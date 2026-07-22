import { readFileSync, writeFileSync } from "node:fs";

function update(url, transform) {
  const source = readFileSync(url, "utf8");
  const next = transform(source);
  writeFileSync(url, next);
}

const analyticsUrl = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
update(analyticsUrl, (input) => {
  let source = input;

  source = source.replace(
    /const PLAN_COLORS: Record<string, string> = \{[\s\S]*?\n\};/,
    `const PLAN_COLORS: Record<string, string> = {
  Free: GOLD,
  Start: EMERALD,
  Premium: PURPLE,
  Pro: ROSE,
};`,
  );

  source = source.replace(
    /const PLAN_PT_SHORT: Record<string, string> = \{[\s\S]*?\n\};/,
    `const PLAN_PT_SHORT: Record<string, string> = {
  free: "FREE",
  pro: "START",
  business: "PREMIUM",
  agency: "PRO",
};`,
  );

  source = source.replace(
    /interface GrowthStats \{[\s\S]*?\n\}\n\nfunction StatTile/,
    `interface GrowthStats {
  mrr: number;
  activeSubscribers: number;
  totalUsers: number;
  conversionRate: number;
  activationRate: number;
  activatedCount: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  churnRisk: Array<{ clerkId: string; plan: string; credits: number; planLimit: number; pct: number }>;
  totalReferralCodes: number;
  totalReferralUses: number;
  creditsSpentThisMonth: number;
  planBreakdown: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
  mrrByPlan: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
}

interface RegisteredPlanStats {
  totalUsers: number;
  planBreakdown: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
}

function StatTile`,
  );

  if (!source.includes("const [registeredPlans, setRegisteredPlans]")) {
    source = source.replace(
      "  const [creditsLoading, setCreditsLoading] = useState(true);",
      `  const [creditsLoading, setCreditsLoading] = useState(true);
  const [registeredPlans, setRegisteredPlans] = useState<RegisteredPlanStats | null>(null);`,
    );
  }

  if (!source.includes("/api/admin/registered-plan-stats")) {
    source = source.replace(
      `  }, [growthTick, getToken]);

  useEffect(() => {
    setCreditsLoading(true);`,
      `  }, [growthTick, getToken]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(\`${basePath}/api/admin/registered-plan-stats\`, { headers: { Authorization: \`Bearer \${token}\` } });
        if (res.ok) setRegisteredPlans(await res.json() as RegisteredPlanStats);
      } catch {
        setRegisteredPlans(null);
      }
    })();
  }, [growthTick, getToken]);

  useEffect(() => {
    setCreditsLoading(true);`,
    );
  }

  source = source.replace(
    /  const hasPaidSubscribers = \(growthStats\?\.activeSubscribers \?\? 0\) > 0;\n/,
    "",
  );

  if (!source.includes("const revenuePlanDefinitions")) {
    source = source.replace(
      `  const planDefinitions = [
    { label: "Free", color: PLAN_COLORS.Free },
    { label: "Start", color: PLAN_COLORS.Start },
    { label: "Premium", color: PLAN_COLORS.Premium },
    { label: "Pro", color: PLAN_COLORS.Pro },
  ];`,
      `  const planDefinitions = [
    { label: "Free", color: PLAN_COLORS.Free },
    { label: "Start", color: PLAN_COLORS.Start },
    { label: "Premium", color: PLAN_COLORS.Premium },
    { label: "Pro", color: PLAN_COLORS.Pro },
  ];
  const revenuePlanDefinitions = planDefinitions.filter((plan) => plan.label !== "Free");`,
    );
  }

  source = source.replace(
    /  const revenueByLabel[\s\S]*?\n\n  const featureUsageDonut/,
    `  const planDistributionDonut = planDefinitions.map((plan) => {
    let value = 0;
    if (plan.label === "Free") value = registeredPlans?.planBreakdown.free ?? 0;
    if (plan.label === "Start") value = registeredPlans?.planBreakdown.pro ?? 0;
    if (plan.label === "Premium") value = registeredPlans?.planBreakdown.business ?? 0;
    if (plan.label === "Pro") value = registeredPlans?.planBreakdown.agency ?? 0;
    return { label: plan.label, value, color: plan.color };
  });

  const planRevenueDonut = revenuePlanDefinitions.map((plan) => {
    let value = 0;
    if (plan.label === "Start") value = growthStats?.mrrByPlan?.pro ?? 0;
    if (plan.label === "Premium") value = growthStats?.mrrByPlan?.business ?? 0;
    if (plan.label === "Pro") value = growthStats?.mrrByPlan?.agency ?? 0;
    return { label: plan.label, value, color: plan.color };
  });

  const featureUsageDonut`,
  );

  source = source.replace(
    'sub={`de ${growthStats?.totalUsers ?? 0} usuários no total`}',
    'sub={`de ${registeredPlans?.totalUsers ?? growthStats?.totalUsers ?? 0} usuários no total`}',
  );

  source = source.replace(
    '`$${p.value.toLocaleString()}`',
    'p.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })',
  );

  return source;
});

const overviewUrl = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
update(overviewUrl, (input) => {
  let source = input;

  source = source.replace(
    /interface GrowthStats \{[\s\S]*?\n\}\n\nfunction normalizeAction/,
    `interface GrowthStats {
  mrr: number;
  activeSubscribers: number;
  totalUsers: number;
  conversionRate: number;
  activationRate: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  creditsSpentThisMonth: number;
  planBreakdown: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
}

interface RegisteredPlanStats {
  totalUsers: number;
  planBreakdown: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
}

function normalizeAction`,
  );

  if (!source.includes("const [registeredPlans, setRegisteredPlans]")) {
    source = source.replace(
      "  const [growthTick, setGrowthTick] = useState(0);",
      `  const [growthTick, setGrowthTick] = useState(0);
  const [registeredPlans, setRegisteredPlans] = useState<RegisteredPlanStats | null>(null);`,
    );
  }

  if (!source.includes("/api/admin/registered-plan-stats")) {
    source = source.replace(
      `  }, [growthTick, getToken]);

  const isRefreshing`,
      `  }, [growthTick, getToken]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const response = await fetch(\`${BASE}/api/admin/registered-plan-stats\`, {
          headers: { Authorization: \`Bearer \${token}\` },
          credentials: "include",
        });
        if (response.ok) setRegisteredPlans(await response.json() as RegisteredPlanStats);
      } catch {
        setRegisteredPlans(null);
      }
    })();
  }, [growthTick, getToken]);

  const isRefreshing`,
    );
  }

  source = source.replace(
    /  const hasPaidSubscribers = \(growthStats\?\.activeSubscribers \?\? 0\) > 0;\n/,
    "",
  );

  source = source.replace(
    /  const planDonut = planDefinitions\.map\(\(plan\) => \{[\s\S]*?\n  \}\);/,
    `  const planDonut = planDefinitions.map((plan) => {
    let value = 0;
    if (plan.label === "Free") value = registeredPlans?.planBreakdown.free ?? 0;
    if (plan.label === "Start") value = registeredPlans?.planBreakdown.pro ?? 0;
    if (plan.label === "Premium") value = registeredPlans?.planBreakdown.business ?? 0;
    if (plan.label === "Pro") value = registeredPlans?.planBreakdown.agency ?? 0;
    return { label: plan.label, value, color: plan.color };
  });`,
  );

  source = source.replace(
    'value={String(growthStats?.totalUsers ?? stats?.totalUsers ?? 0)}',
    'value={String(registeredPlans?.totalUsers ?? growthStats?.totalUsers ?? stats?.totalUsers ?? 0)}',
  );

  return source;
});

console.log("Admin analytics and overview now separate registered plan counts from paid revenue.");
