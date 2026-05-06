import { useEffect, useRef, useState } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingScreen } from "@/components/LoadingScreen";
import NotFound from "@/pages/not-found";

import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminGuard } from "@/pages/admin/AdminGuard";
import { LandingPage } from "@/pages/LandingPage";
import { DashboardHome } from "@/pages/dashboard/DashboardHome";
import { FindProducts } from "@/pages/dashboard/FindProducts";
import { ValidateProducts } from "@/pages/dashboard/ValidateProducts";
import { CreateCampaign } from "@/pages/dashboard/CreateCampaign";
import { CreateContent } from "@/pages/dashboard/CreateContent";
import { CreativeGenerator } from "@/pages/dashboard/CreativeGenerator";
import { VideoScripts } from "@/pages/dashboard/VideoScripts";
import { Projects } from "@/pages/dashboard/Projects";
import { History } from "@/pages/dashboard/History";
import { Settings } from "@/pages/dashboard/Settings";
import { Credits } from "@/pages/dashboard/Credits";
import { Billing } from "@/pages/dashboard/Billing";
import { AdminOverview } from "@/pages/admin/AdminOverview";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminAnalytics } from "@/pages/admin/AdminAnalytics";
import { AdminActivity } from "@/pages/admin/AdminActivity";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#C9A84C",
    colorForeground: "#fafafa",
    colorMutedForeground: "#71717a",
    colorDanger: "#ef4444",
    colorBackground: "#111111",
    colorInput: "#0a0a0a",
    colorInputForeground: "#fafafa",
    colorNeutral: "#3f3f46",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111111] border border-white/10 rounded-xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold",
    headerSubtitle: "text-zinc-400",
    socialButtonsBlockButtonText: "text-white",
    formFieldLabel: "text-zinc-300 text-sm",
    footerActionLink: "text-[#C9A84C] hover:text-[#E8C96A]",
    footerActionText: "text-zinc-500",
    dividerText: "text-zinc-600",
    identityPreviewEditButton: "text-[#C9A84C]",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-white",
    logoBox: "flex justify-center py-2",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border border-white/10 bg-white/5 hover:bg-white/10 transition-colors",
    formButtonPrimary: "bg-[#C9A84C] hover:bg-[#b8943e] text-black font-semibold transition-colors",
    formFieldInput: "bg-[#0a0a0a] border-white/10 text-white",
    footerAction: "bg-[#0d0d0d] border-t border-white/5",
    dividerLine: "bg-white/10",
    alert: "bg-red-950/30 border border-red-500/20",
    otpCodeFieldInput: "bg-[#0a0a0a] border-white/10 text-white",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

function SignInPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-[#080808] px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-5%,_rgba(201,168,76,0.1)_0%,_transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_80%,_rgba(201,168,76,0.04)_0%,_transparent_60%)] pointer-events-none" />
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-[#080808] px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-5%,_rgba(201,168,76,0.1)_0%,_transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_80%,_rgba(201,168,76,0.04)_0%,_transparent_60%)] pointer-events-none" />
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedDashboard() {
  return (
    <>
      <Show when="signed-in">
        <SidebarLayout>
          <Switch>
            <Route path="/dashboard" component={DashboardHome} />
            <Route path="/dashboard/find-products" component={FindProducts} />
            <Route path="/dashboard/validate-products" component={ValidateProducts} />
            <Route path="/dashboard/create-campaign" component={CreateCampaign} />
            <Route path="/dashboard/create-content" component={CreateContent} />
            <Route path="/dashboard/creative-generator" component={CreativeGenerator} />
            <Route path="/dashboard/video-scripts" component={VideoScripts} />
            <Route path="/dashboard/projects" component={Projects} />
            <Route path="/dashboard/history" component={History} />
            <Route path="/dashboard/credits" component={Credits} />
            <Route path="/dashboard/billing" component={Billing} />
            <Route path="/dashboard/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </SidebarLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ProtectedAdmin() {
  return (
    <>
      <Show when="signed-in">
        <AdminGuard>
          <AdminLayout>
            <Switch>
              <Route path="/admin" component={AdminOverview} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route path="/admin/analytics" component={AdminAnalytics} />
              <Route path="/admin/activity" component={AdminActivity} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        </AdminGuard>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsub;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your IAttom Assist workspace",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Your AI business advantage starts here",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryInvalidator />
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dashboard/*?" component={ProtectedDashboard} />
            <Route path="/dashboard" component={ProtectedDashboard} />
            <Route path="/admin/*?" component={ProtectedAdmin} />
            <Route path="/admin" component={ProtectedAdmin} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(() => {
    try {
      if (sessionStorage.getItem("iattom_splash_seen")) return false;
      sessionStorage.setItem("iattom_splash_seen", "1");
      return true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <WouterRouter base={basePath}>
      <AnimatePresence mode="wait">
        {isLoading && <LoadingScreen key="loading" />}
      </AnimatePresence>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
