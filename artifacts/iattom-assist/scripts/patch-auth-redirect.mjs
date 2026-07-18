import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`${label} marker was not found`);
  return source.replace(before, after);
}

const appUrl = new URL("../src/App.tsx", import.meta.url);
let appSource = readFileSync(appUrl, "utf8");

const appBefore = `function SignInCallbackPage() {
  const [location] = useLocation();
  return location.includes("/sso-callback") ? <AuthenticateWithRedirectCallback /> : <SignInPage />;
}`;

const appAfter = `function SignInCallbackPage() {
  const [location] = useLocation();
  if (location.includes("/sso-callback")) return <AuthenticateWithRedirectCallback />;
  return <>
    <Show when="signed-in"><Redirect to="/dashboard" /></Show>
    <Show when="signed-out"><SignInPage /></Show>
  </>;
}`;

if (appSource.includes(appAfter)) {
  console.log("Authenticated sign-in redirect already applied.");
} else if (appSource.includes(appBefore)) {
  appSource = appSource.replace(appBefore, appAfter);
  console.log("Authenticated sign-in redirect applied.");
} else {
  throw new Error("Sign-in redirect marker was not found");
}

appSource = replaceRequired(
  appSource,
  `import { ClerkProvider, Show, useClerk, AuthenticateWithRedirectCallback } from "@clerk/react";`,
  `import { ClerkProvider, Show, useClerk, useUser, AuthenticateWithRedirectCallback } from "@clerk/react";`,
  "App Clerk import",
);

appSource = replaceRequired(
  appSource,
  `import { PlanGate } from "@/components/PlanGate";`,
  `import { PlanGate } from "@/components/PlanGate";\nimport { useSyncUser, getGetMeQueryKey } from "@workspace/api-client-react";`,
  "App sync import",
);

const bootstrapMarker = `function ProtectedDashboard() {
  return <>
    <Show when="signed-in"><BetaGate><SidebarLayout><PlanGate><Suspense fallback={<PageLoader />}><Switch>`;

const bootstrapReplacement = `function UserBootstrap({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const syncUser = useSyncUser();
  const syncedUserIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "syncing" | "ready" | "error">("idle");
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (syncedUserIdRef.current === user.id) {
      setStatus("ready");
      return;
    }

    const email = user.primaryEmailAddress?.emailAddress?.trim();
    if (!email) {
      setSyncError("Não foi possível identificar o e-mail da conta.");
      setStatus("error");
      return;
    }

    let cancelled = false;
    setStatus("syncing");
    setSyncError("");

    syncUser.mutateAsync({
      data: {
        email,
        name: user.fullName ?? user.firstName ?? undefined,
      },
    }).then(async () => {
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      if (!cancelled) {
        syncedUserIdRef.current = user.id;
        setStatus("ready");
      }
    }).catch((error: unknown) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : "Não foi possível sincronizar sua conta.";
      setSyncError(message);
      setStatus("error");
    });

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, user?.id]);

  if (!isLoaded || (isSignedIn && status !== "ready")) {
    if (status === "error") {
      return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm font-semibold text-white">Não foi possível preparar sua conta</p>
          <p className="mt-2 text-xs text-zinc-500">{syncError}</p>
          <button type="button" onClick={() => { syncedUserIdRef.current = null; setStatus("idle"); window.location.reload(); }} className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300">Tentar novamente</button>
        </div>
      </div>;
    }
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

function ProtectedDashboard() {
  return <>
    <Show when="signed-in"><UserBootstrap><BetaGate><SidebarLayout><PlanGate><Suspense fallback={<PageLoader />}><Switch>`;

appSource = replaceRequired(appSource, bootstrapMarker, bootstrapReplacement, "User bootstrap");
appSource = replaceRequired(
  appSource,
  `    </Switch></Suspense></PlanGate></SidebarLayout></BetaGate></Show>`,
  `    </Switch></Suspense></PlanGate></SidebarLayout></BetaGate></UserBootstrap></Show>`,
  "User bootstrap close",
);

writeFileSync(appUrl, appSource);

const signInUrl = new URL("../src/pages/SignInPage.tsx", import.meta.url);
let signInSource = readFileSync(signInUrl, "utf8");

const relativeConstants = `const dashboardPath = \`${"${basePath}"}/dashboard\` || "/dashboard";
const googleCallbackPath = \`${"${basePath}"}/sign-in/sso-callback\` || "/sign-in/sso-callback";`;

const rootAbsoluteConstants = `const dashboardPath = \`${"${basePath}"}/dashboard\` || "/dashboard";
const canonicalOrigin = window.location.hostname === "www.iattomassist.com.br"
  ? "https://iattomassist.com.br"
  : window.location.origin;
const googleCallbackUrl = \`${"${canonicalOrigin}${basePath}"}/sign-in/sso-callback\`;
const googleRedirectUrl = \`${"${canonicalOrigin}${dashboardPath}"}\`;`;

const wwwAbsoluteConstants = `const dashboardPath = \`${"${basePath}"}/dashboard\` || "/dashboard";
const canonicalOrigin = "https://www.iattomassist.com.br";
const googleCallbackUrl = \`${"${canonicalOrigin}${basePath}"}/sign-in/sso-callback\`;
const googleRedirectUrl = \`${"${canonicalOrigin}${dashboardPath}"}\`;`;

const relativeRedirects = `redirectCallbackUrl: googleCallbackPath,
        redirectUrl: dashboardPath,`;

const absoluteRedirects = `redirectCallbackUrl: googleCallbackUrl,
        redirectUrl: googleRedirectUrl,`;

let signInChanged = false;

if (signInSource.includes(relativeConstants)) {
  signInSource = signInSource.replace(relativeConstants, wwwAbsoluteConstants);
  signInChanged = true;
} else if (signInSource.includes(rootAbsoluteConstants)) {
  signInSource = signInSource.replace(rootAbsoluteConstants, wwwAbsoluteConstants);
  signInChanged = true;
}

if (signInSource.includes(relativeRedirects)) {
  signInSource = signInSource.replace(relativeRedirects, absoluteRedirects);
  signInChanged = true;
}

if (signInChanged) {
  writeFileSync(signInUrl, signInSource);
  console.log("Google OAuth redirects pinned to www.iattomassist.com.br.");
} else if (signInSource.includes(wwwAbsoluteConstants) && signInSource.includes(absoluteRedirects)) {
  console.log("Google OAuth redirects already use www.iattomassist.com.br.");
} else {
  throw new Error("Google OAuth redirect markers were not found");
}

const signUpUrl = new URL("../src/pages/SignUpPage.tsx", import.meta.url);
let signUpSource = readFileSync(signUpUrl, "utf8");

if (signUpSource.includes(`const [loading, setLoading] = useState(false);`)) {
  signUpSource = signUpSource
    .replace(`const [loading, setLoading] = useState(false);`, `const [emailLoading, setEmailLoading] = useState(false);\n  const [googleLoading, setGoogleLoading] = useState(false);`)
    .replace(/\bsetLoading\b/g, "setEmailLoading")
    .replace(/\bloading\b/g, "emailLoading");

  const googleStart = signUpSource.indexOf("  const handleGoogle = async () => {");
  const googleEnd = signUpSource.indexOf("  const returnToEmail = () => {", googleStart);
  if (googleStart < 0 || googleEnd < 0) throw new Error("Google signup handler markers were not found");
  const googleBlock = signUpSource.slice(googleStart, googleEnd)
    .replace(/\bsetEmailLoading\b/g, "setGoogleLoading")
    .replace(/\bemailLoading\b/g, "googleLoading");
  signUpSource = signUpSource.slice(0, googleStart) + googleBlock + signUpSource.slice(googleEnd);

  signUpSource = replaceRequired(signUpSource, `disabled={emailLoading}\n                  className="w-full h-[44px] flex items-center`, `disabled={emailLoading || googleLoading}\n                  className="w-full h-[44px] flex items-center`, "Google button disabled state");
  signUpSource = replaceRequired(signUpSource, `{emailLoading ? "Abrindo Google..." : "Continuar com Google"}`, `{googleLoading ? "Abrindo Google..." : "Continuar com Google"}`, "Google button label");
  signUpSource = replaceRequired(signUpSource, `disabled={emailLoading}\n                    className="w-full h-[44px] rounded-lg`, `disabled={emailLoading || googleLoading}\n                    className="w-full h-[44px] rounded-lg`, "Email button disabled state");
} else if (!signUpSource.includes(`const [emailLoading, setEmailLoading] = useState(false);`) || !signUpSource.includes(`const [googleLoading, setGoogleLoading] = useState(false);`)) {
  throw new Error("Signup loading state markers were not found");
}

writeFileSync(signUpUrl, signUpSource);

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let billingSource = readFileSync(billingUrl, "utf8");

billingSource = replaceRequired(
  billingSource,
  `const { data: me, isFetching: fetchingMe, refetch: refetchMe } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 0 } });`,
  `const { data: me, isLoading: meLoading, isFetching: fetchingMe, refetch: refetchMe } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 0 } });`,
  "Billing me loading",
);

billingSource = replaceRequired(
  billingSource,
  `  const currentPlan  = me?.plan ?? "free";
  const hasActiveSub = subscription?.hasSubscription === true;
  const subStatus    = subscription?.status;
  const isLoading    = plansLoading || subLoading;`,
  `  const currentPlan = me?.plan ?? "free";
  const hasSelectedFree = me?.plan === "free" && me?.planSelected === true;
  const hasActivePaidPlan = me?.plan !== "free" && subscription?.hasSubscription === true;
  const hasActivePlan = hasSelectedFree || hasActivePaidPlan;
  const subStatus = subscription?.status;
  const isLoading = plansLoading || subLoading || meLoading;`,
  "Billing active plan state",
);

const freeHandlerBefore = `        const token = await getToken();
        const base = import.meta.env.BASE_URL ?? "/";
        await fetch(\`${"${base}"}api/user/select-plan\`, {
          method: "POST",
          headers: { Authorization: \`Bearer ${"${token}"}\` },
        });
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/dashboard");
      } catch {
        toast({ title: "Erro ao selecionar plano", description: "Tente novamente em instantes.", variant: "destructive" });`;

const freeHandlerAfter = `        const token = await getToken();
        if (!token) throw new Error("Sessão expirada. Entre novamente.");

        const base = import.meta.env.BASE_URL ?? "/";
        const response = await fetch(\`${"${base}"}api/user/select-plan\`, {
          method: "POST",
          headers: { Authorization: \`Bearer ${"${token}"}\` },
        });
        const payload = await response.json().catch(() => null) as { ok?: boolean; plan?: string; planSelected?: boolean; error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? \`Falha ao selecionar o plano (HTTP ${"${response.status}"}).\`);
        }
        if (payload?.ok !== true || payload.plan !== "free" || payload.planSelected !== true) {
          throw new Error("O servidor não confirmou a seleção do plano FREE.");
        }

        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        const refreshed = await refetchMe();
        if (refreshed.data?.plan !== "free" || refreshed.data?.planSelected !== true) {
          throw new Error("O plano foi salvo, mas a confirmação da conta ainda não foi atualizada.");
        }

        setLocation("/dashboard");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Tente novamente em instantes.";
        toast({ title: "Erro ao selecionar plano", description: message, variant: "destructive" });`;

billingSource = replaceRequired(billingSource, freeHandlerBefore, freeHandlerAfter, "FREE selection confirmation");
billingSource = replaceRequired(billingSource, `      ) : hasActiveSub ? (`, `      ) : hasActivePlan ? (`, "Billing current plan status");
billingSource = replaceRequired(billingSource, `            {!hasActiveSub && (`, `            {!hasActivePlan && (`, "Billing plan helper text");
billingSource = replaceRequired(
  billingSource,
  `              const isCurrent  = planKey === currentPlan && hasActiveSub;`,
  `              const isCurrent = planKey === currentPlan && (planKey === "free" ? hasSelectedFree : hasActivePaidPlan);`,
  "Billing current plan card",
);
billingSource = billingSource.replaceAll("hasActiveSub && isDowngrade", "hasActivePaidPlan && isDowngrade");
billingSource = billingSource.replaceAll("hasActiveSub && isUpgrade", "hasActivePaidPlan && isUpgrade");

const portalBefore = `              <Button
                variant="outline"
                size="sm"
                className="border-white/10 hover:border-primary/30 text-sm text-zinc-300"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending
                  ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <ExternalLink className="w-3.5 h-3.5 mr-1.5" />}
                Gerenciar Assinatura
              </Button>`;
const portalAfter = `              {hasActivePaidPlan && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 hover:border-primary/30 text-sm text-zinc-300"
                  onClick={() => portal.mutate()}
                  disabled={portal.isPending}
                >
                  {portal.isPending
                    ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <ExternalLink className="w-3.5 h-3.5 mr-1.5" />}
                  Gerenciar Assinatura
                </Button>
              )}`;
billingSource = replaceRequired(billingSource, portalBefore, portalAfter, "Paid billing portal");

writeFileSync(billingUrl, billingSource);
console.log("Signup loading, user bootstrap and FREE billing persistence patches applied.");
