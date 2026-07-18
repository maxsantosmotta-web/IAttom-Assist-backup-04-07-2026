import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`${label} marker was not found`);
  return source.replace(before, after);
}

// 1) Analytics: never trust partial or error payloads as complete analytics data.
const analyticsUrl = new URL("../src/pages/dashboard/Analytics.tsx", import.meta.url);
let analytics = readFileSync(analyticsUrl, "utf8");

analytics = replaceOnce(
  analytics,
  `    fetch(\`/api/analytics/user?days=\${days}\`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));`,
  `    fetch(\`/api/analytics/user?days=\${days}\`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as Partial<AnalyticsData> | null;
        if (!response.ok) throw new Error(\`Analytics request failed (HTTP \${response.status})\`);
        return {
          activityByModule: Array.isArray(payload?.activityByModule) ? payload.activityByModule : [],
          creditsSpent: Array.isArray(payload?.creditsSpent) ? payload.creditsSpent : [],
          recentHistory: Array.isArray(payload?.recentHistory) ? payload.recentHistory : [],
          projectStats: {
            total: Number(payload?.projectStats?.total ?? 0),
            completed: Number(payload?.projectStats?.completed ?? 0),
            inProgress: Number(payload?.projectStats?.inProgress ?? 0),
          },
          days: Number(payload?.days ?? days),
        } satisfies AnalyticsData;
      })
      .then((normalized) => setData(normalized))
      .catch((error) => {
        console.error("[Analytics] Failed to load:", error);
        setData({
          activityByModule: [],
          creditsSpent: [],
          recentHistory: [],
          projectStats: { total: 0, completed: 0, inProgress: 0 },
          days,
        });
      })
      .finally(() => setLoading(false));`,
  "Analytics request normalization",
);

analytics = replaceOnce(
  analytics,
  `  const totalAiRuns = data?.activityByModule.reduce((s, m) => s + m.count, 0) ?? 0;
  const totalCredits = data?.creditsSpent.reduce((s, m) => s + m.spent, 0) ?? 0;

  const chartModules = data?.activityByModule`,
  `  const activityByModule = Array.isArray(data?.activityByModule) ? data.activityByModule : [];
  const creditsSpent = Array.isArray(data?.creditsSpent) ? data.creditsSpent : [];
  const totalAiRuns = activityByModule.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
  const totalCredits = creditsSpent.reduce((sum, item) => sum + Number(item.spent ?? 0), 0);

  const chartModules = activityByModule`,
  "Analytics safe arrays",
);

analytics = replaceOnce(
  analytics,
  `  const creditsChart = data?.creditsSpent.map((d) => ({`,
  `  const creditsChart = creditsSpent.map((d) => ({`,
  "Analytics credits chart",
);

analytics = analytics.replace(`    })) ?? [];`, `    }));`);
writeFileSync(analyticsUrl, analytics);

// 2) Plan comparison modal: fit viewport and scroll vertically on mobile.
const modalUrl = new URL("../src/components/PlanComparisonModal.tsx", import.meta.url);
let modal = readFileSync(modalUrl, "utf8");

modal = replaceOnce(
  modal,
  `className="fixed inset-0 z-50 flex items-center justify-center p-4"`,
  `className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain p-2 sm:p-4"`,
  "Plan modal overlay scrolling",
);

modal = replaceOnce(
  modal,
  `className="relative w-full max-w-5xl bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-depth-lg overflow-hidden"`,
  `className="relative w-full max-w-5xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-depth-lg overflow-y-auto overscroll-contain"`,
  "Plan modal panel scrolling",
);

modal = replaceOnce(
  modal,
  `className="flex items-start justify-between p-6 pb-4 border-b border-white/[0.06]"`,
  `className="sticky top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"`,
  "Plan modal sticky header",
);

modal = replaceOnce(
  modal,
  `className="p-6"`,
  `className="p-4 sm:p-6"`,
  "Plan modal responsive padding",
);
writeFileSync(modalUrl, modal);

// 3) Signup: expose where time is spent and give immediate progress feedback.
const signupUrl = new URL("../src/pages/SignUpPage.tsx", import.meta.url);
let signup = readFileSync(signupUrl, "utf8");

if (!signup.includes(`const [progressText, setProgressText]`)) {
  signup = replaceOnce(
    signup,
    `  const [error, setError] = useState("");`,
    `  const [error, setError] = useState("");
  const [progressText, setProgressText] = useState("");`,
    "Signup progress state",
  );
}

const loadingSetter = signup.includes("setEmailLoading(true)") ? "setEmailLoading" : "setLoading";
const loadingState = signup.includes("emailLoading") ? "emailLoading" : "loading";

if (!signup.includes("[SignUp Timing] account creation")) {
  signup = replaceOnce(
    signup,
    `    ${loadingSetter}(true);
    setError("");

    try {`,
    `    ${loadingSetter}(true);
    setError("");
    setProgressText("Criando sua conta...");
    const signupStartedAt = performance.now();

    try {`,
    "Signup timing start",
  );

  signup = replaceOnce(
    signup,
    `      if (clerkError) {`,
    `      console.info("[SignUp Timing] account creation", Math.round(performance.now() - signupStartedAt), "ms");

      if (clerkError) {`,
    "Signup account timing",
  );

  signup = replaceOnce(
    signup,
    `      if (signUp.status === "missing_requirements") {
        const { error: verificationError } = await signUp.verifications.sendEmailCode();`,
    `      if (signUp.status === "missing_requirements") {
        setProgressText("Enviando código...");
        const codeStartedAt = performance.now();
        const { error: verificationError } = await signUp.verifications.sendEmailCode();
        console.info("[SignUp Timing] email code", Math.round(performance.now() - codeStartedAt), "ms", "total", Math.round(performance.now() - signupStartedAt), "ms");`,
    "Signup email timing",
  );

  signup = replaceOnce(
    signup,
    `    } finally {
      ${loadingSetter}(false);
    }`,
    `    } finally {
      ${loadingSetter}(false);
      setProgressText("");
    }`,
    "Signup progress cleanup",
  );
}

signup = signup.replace(
  `{${loadingState} ? "Aguarde..." : "Continuar"}`,
  `{${loadingState} ? (progressText || "Aguarde...") : "Continuar"}`,
);
writeFileSync(signupUrl, signup);

console.log("Analytics stability, mobile plan scrolling and signup timing are applied.");
