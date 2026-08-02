import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const oldAuth = "  const { getToken } = useAuth();";
const newAuth = "  const { isLoaded, getToken } = useAuth();";
if (!source.includes(newAuth)) {
  if (!source.includes(oldAuth)) throw new Error("Billing auth marker not found");
  source = source.replace(oldAuth, newAuth);
}

const oldPlansQuery = `  const { data: plans = [], isLoading: plansLoading, isFetching: fetchingPlans, refetch: refetchPlans } = useGetStripePlans({
    query: { queryKey: getGetStripePlansQueryKey(), retry: false, staleTime: 0 },
  });`;

const newPlansQuery = `  const { data: plans = [], isLoading: plansLoading, isFetching: fetchingPlans, refetch: refetchPlans } = useGetStripePlans({
    query: {
      queryKey: getGetStripePlansQueryKey(),
      enabled: isLoaded,
      retry: 3,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 3000),
      staleTime: 0,
      placeholderData: (previous) => previous,
    },
  });`;

if (!source.includes("placeholderData: (previous) => previous")) {
  if (!source.includes(oldPlansQuery)) throw new Error("Billing plans query marker not found");
  source = source.replace(oldPlansQuery, newPlansQuery);
}

for (const marker of [
  "const { isLoaded, getToken } = useAuth();",
  "enabled: isLoaded",
  "retry: 3",
  "placeholderData: (previous) => previous",
]) {
  if (!source.includes(marker)) throw new Error(`Billing plans loading marker missing: ${marker}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Billing plans now wait for Clerk and retry transient initial loading failures.");
