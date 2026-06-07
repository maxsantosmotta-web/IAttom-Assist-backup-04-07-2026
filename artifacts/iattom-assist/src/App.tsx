import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, Show, useClerk, SignIn, SignUp } from "@clerk/react";
import { ptBR } from "@clerk/localizations";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";

import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminGuard } from "@/pages/admin/AdminGuard";
import { LandingPage } from "@/pages/LandingPage";
import { TermsPage } from "@/pages/TermsPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { AboutPage } from "@/pages/AboutPage";
import { HelpPage } from "@/pages/HelpPage";
import { BetaGate } from "@/components/BetaGate";
import { PlanGate } from "@/components/PlanGate";

// Eager load lightweight pages
import { DashboardHome } from "@/pages/dashboard/DashboardHome";
import { Credits } from "@/pages/dashboard/Credits";
import { Billing } from "@/pages/dashboard/Billing";
import { Settings } from "@/pages/dashboard/Settings";
import { Projects } from "@/pages/dashboard/Projects";
import { History } from "@/pages/dashboard/History";

// Lazy load heavy AI + data pages
const FindProducts = lazy(() => import("@/pages/dashboard/FindProducts").then((m) => ({ default: m.FindProducts })));
const ValidateProducts = lazy(() => import("@/pages/dashboard/ValidateProducts").then((m) => ({ default: m.ValidateProducts })));
const CreateCampaign = lazy(() => import("@/pages/dashboard/CreateCampaign").then((m) => ({ default: m.CreateCampaign })));
const CreateContent = lazy(() => import("@/pages/dashboard/CreateContent").then((m) => ({ default: m.CreateContent })));
const CreativeGenerator = lazy(() => import("@/pages/dashboard/CreativeGenerator").then((m) => ({ default: m.CreativeGenerator })));
const VideoScripts = lazy(() => import("@/pages/dashboard/VideoScripts").then((m) => ({ default: m.VideoScripts })));
const Analytics = lazy(() => import("@/pages/dashboard/Analytics").then((m) => ({ default: m.Analytics })));
const SavedPrompts = lazy(() => import("@/pages/dashboard/SavedPrompts").then((m) => ({ default: m.SavedPrompts })));
const Referral = lazy(() => import("@/pages/dashboard/Referral").then((m) => ({ default: m.Referral })));
const Trash = lazy(() => import("@/pages/dashboard/Trash").then((m) => ({ default: m.Trash })));
const ProjectDetail = lazy(() => import("@/pages/dashboard/ProjectDetail").then((m) => ({ default: m.ProjectDetail })));
const MercadoLivre = lazy(() => import("@/pages/dashboard/MercadoLivre").then((m) => ({ default: m.MercadoLivre })));
const Shopee = lazy(() => import("@/pages/dashboard/Shopee").then((m) => ({ default: m.Shopee })));
const TikTok = lazy(() => import("@/pages/dashboard/TikTok").then((m) => ({ default: m.TikTok })));
const Hotmart = lazy(() => import("@/pages/dashboard/Hotmart").then((m) => ({ default: m.Hotmart })));
const Kiwify = lazy(() => import("@/pages/dashboard/Kiwify").then((m) => ({ default: m.Kiwify })));
const Facebook = lazy(() => import("@/pages/dashboard/Facebook").then((m) => ({ default: m.Facebook })));
const Instagram = lazy(() => import("@/pages/dashboard/Instagram").then((m) => ({ default: m.Instagram })));
// Lazy load admin pages
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview").then((m) => ({ default: m.AdminOverview })));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers").then((m) => ({ default: m.AdminUsers })));
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics").then((m) => ({ default: m.AdminAnalytics })));
const AdminActivity = lazy(() => import("@/pages/admin/AdminActivity").then((m) => ({ default: m.AdminActivity })));
const AdminWaitlist = lazy(() => import("@/pages/admin/AdminWaitlist").then((m) => ({ default: m.AdminWaitlist })));
const AdminFeedback = lazy(() => import("@/pages/admin/AdminFeedback").then((m) => ({ default: m.AdminFeedback })));
const AdminInstagram = lazy(() => import("@/pages/admin/AdminInstagram").then((m) => ({ default: m.AdminInstagram })));
const AdminFacebook  = lazy(() => import("@/pages/admin/AdminFacebook").then((m) => ({ default: m.AdminFacebook })));
const AdminShopee = lazy(() => import("@/pages/admin/AdminShopee").then((m) => ({ default: m.AdminShopee })));
const AdminMercadoLivre = lazy(() => import("@/pages/admin/AdminMercadoLivre").then((m) => ({ default: m.AdminMercadoLivre })));
const AdminHotmart = lazy(() => import("@/pages/admin/AdminHotmart").then((m) => ({ default: m.AdminHotmart })));
const AdminKiwify = lazy(() => import("@/pages/admin/AdminKiwify").then((m) => ({ default: m.AdminKiwify })));
const AdminIntegrations = lazy(() => import("@/pages/admin/AdminIntegrations").then((m) => ({ default: m.AdminIntegrations })));
const AdminTrash = lazy(() => import("@/pages/admin/AdminTrash").then((m) => ({ default: m.AdminTrash })));
const AdminTikTok = lazy(() => import("@/pages/admin/AdminTikTok").then((m) => ({ default: m.AdminTikTok })));
const AdminApiConfig = lazy(() => import("@/pages/admin/AdminApiConfig").then((m) => ({ default: m.AdminApiConfig })));
const AdminHealth = lazy(() => import("@/pages/admin/AdminHealth").then((m) => ({ default: m.AdminHealth })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="relative w-9 h-9">
        <svg
          className="animate-spin-slow w-9 h-9"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="18" cy="18" r="15" stroke="rgba(201,168,76,0.12)" strokeWidth="2.5" />
          <path
            d="M18 3 A15 15 0 0 1 33 18"
            stroke="#C9A84C"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
        </div>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string)?.replace(/\.+$/, ""),
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

function SignInCallbackPage() {
  return (
    <Show when="signed-out">
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/dashboard`}
          appearance={clerkAppearance}
        />
      </div>
    </Show>
  );
}

function SignUpCallbackPage() {
  return (
    <Show when="signed-out">
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          fallbackRedirectUrl={`${basePath}/onboarding`}
          appearance={clerkAppearance}
        />
      </div>
    </Show>
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

function ProtectedOnboarding() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-up" />
      </Show>
    </>
  );
}

function ProtectedDashboard() {
  return (
    <>
      <Show when="signed-in">
        <BetaGate>
          <SidebarLayout>
            <PlanGate>
              <Suspense fallback={<PageLoader />}>
                <Switch>
                  <Route path="/dashboard" component={DashboardHome} />
                  <Route path="/dashboard/find-products" component={FindProducts} />
                  <Route path="/dashboard/validate-products" component={ValidateProducts} />
                  <Route path="/dashboard/create-campaign" component={CreateCampaign} />
                  <Route path="/dashboard/create-content" component={CreateContent} />
                  <Route path="/dashboard/creative-generator" component={CreativeGenerator} />
                  <Route path="/dashboard/video-scripts" component={VideoScripts} />
                  <Route path="/dashboard/projects/:id" component={ProjectDetail} />
                  <Route path="/dashboard/projects" component={Projects} />
                  <Route path="/dashboard/history" component={History} />
                  <Route path="/dashboard/credits" component={Credits} />
                  <Route path="/dashboard/billing" component={Billing} />
                  <Route path="/dashboard/settings" component={Settings} />
                  <Route path="/dashboard/analytics" component={Analytics} />
                  <Route path="/dashboard/prompts" component={SavedPrompts} />
                  <Route path="/dashboard/referral" component={Referral} />
                  <Route path="/dashboard/trash" component={Trash} />
                  <Route path="/dashboard/mercado-livre" component={MercadoLivre} />
                  <Route path="/dashboard/shopee" component={Shopee} />
                  <Route path="/dashboard/tiktok" component={TikTok} />
                  <Route path="/dashboard/hotmart" component={Hotmart} />
                  <Route path="/dashboard/kiwify" component={Kiwify} />
                  <Route path="/dashboard/facebook" component={Facebook} />
                  <Route path="/dashboard/instagram" component={Instagram} />
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </PlanGate>
          </SidebarLayout>
        </BetaGate>
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
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/admin" component={AdminOverview} />
                <Route path="/admin/users" component={AdminUsers} />
                <Route path="/admin/analytics" component={AdminAnalytics} />
                <Route path="/admin/activity" component={AdminActivity} />
                <Route path="/admin/waitlist" component={AdminWaitlist} />
                <Route path="/admin/feedback" component={AdminFeedback} />
                <Route path="/admin/integrations" component={AdminIntegrations} />
                <Route path="/admin/instagram" component={AdminInstagram} />
                <Route path="/admin/facebook"  component={AdminFacebook}  />
                <Route path="/admin/shopee" component={AdminShopee} />
                <Route path="/admin/mercado-livre" component={AdminMercadoLivre} />
                <Route path="/admin/hotmart" component={AdminHotmart} />
                <Route path="/admin/kiwify" component={AdminKiwify} />
                <Route path="/admin/trash" component={AdminTrash} />
                <Route path="/admin/tiktok" component={AdminTikTok} />
                <Route path="/admin/api-config" component={AdminApiConfig} />
                <Route path="/admin/health" component={AdminHealth} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
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
      signInFallbackRedirectUrl={`${window.location.origin}${basePath}/dashboard`}
      signUpFallbackRedirectUrl={`${window.location.origin}${basePath}/dashboard`}
      localization={ptBR}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryInvalidator />
          <ErrorBoundary>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/sign-in/*?" component={SignInCallbackPage} />
              <Route path="/sign-up/*?" component={SignUpCallbackPage} />
              <Route path="/onboarding/*?" component={ProtectedOnboarding} />
              <Route path="/dashboard/*?" component={ProtectedDashboard} />
              <Route path="/admin/*?" component={ProtectedAdmin} />
              <Route path="/terms" component={TermsPage} />
              <Route path="/privacy" component={PrivacyPage} />
              <Route path="/about" component={AboutPage} />
              <Route path="/help" component={HelpPage} />
              <Route component={NotFound} />
            </Switch>
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  const splashNeeded = (() => {
    try {
      if (sessionStorage.getItem("iattom_splash_seen")) return false;
      sessionStorage.setItem("iattom_splash_seen", "1");
      return true;
    } catch {
      return true;
    }
  })();

  const [isLoading, setIsLoading] = useState(splashNeeded);
  // Content stays hidden until the splash EXIT ANIMATION fully completes
  // This prevents any bleed-through during the 0.6s fade-out
  const [showContent, setShowContent] = useState(!splashNeeded);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <WouterRouter base={basePath}>
      <AnimatePresence
        mode="wait"
        onExitComplete={() => setShowContent(true)}
      >
        {isLoading && <LoadingScreen key="loading" />}
      </AnimatePresence>
      <div
        style={
          !showContent
            ? { visibility: "hidden", position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }
            : undefined
        }
        aria-hidden={!showContent}
      >
        <ClerkProviderWithRoutes />
      </div>
    </WouterRouter>
  );
}

export default App;
