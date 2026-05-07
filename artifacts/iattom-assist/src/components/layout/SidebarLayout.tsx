import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Search, CheckCircle, Megaphone, FileText,
  Sparkles, Video, FolderOpen, Clock, Settings, Menu, X,
  LogOut, ChevronDown, ShieldCheck, Zap, CreditCard,
  Command, BarChart2, BookMarked, Gift,
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useUser, useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useSyncUser, useGetMe, getGetMeQueryKey,
  useGetCreditsBalance, getGetCreditsBalanceQueryKey,
} from "@workspace/api-client-react";
import { getCreditColor, getCreditBarColor } from "@/lib/credits";
import { Logo } from "@/components/ui/Logo";
import { FeedbackModal } from "@/components/FeedbackModal";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationsPanel } from "@/components/NotificationsPanel";

const navItems = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/dashboard/find-products", label: "Buscar Produtos", icon: Search },
  { href: "/dashboard/validate-products", label: "Validar Produtos", icon: CheckCircle },
  { href: "/dashboard/create-campaign", label: "Criar Campanha", icon: Megaphone },
  { href: "/dashboard/create-content", label: "Criar Conteúdo", icon: FileText },
  { href: "/dashboard/creative-generator", label: "Gerador Criativo", icon: Sparkles },
  { href: "/dashboard/video-scripts", label: "Scripts de Vídeo", icon: Video },
  { href: "/dashboard/projects", label: "Projetos", icon: FolderOpen },
  { href: "/dashboard/history", label: "Atividades", icon: Clock },
  { href: "/dashboard/analytics", label: "Análises", icon: BarChart2 },
  { href: "/dashboard/prompts", label: "Prompts Salvos", icon: BookMarked },
  { href: "/dashboard/referral", label: "Indicações", icon: Gift },
  { href: "/dashboard/credits", label: "Créditos", icon: Zap },
  { href: "/dashboard/billing", label: "Faturamento", icon: CreditCard },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const syncUser = useSyncUser({
    mutation: {
      onSuccess: () => {
        // Invalidate both me and credits so the sidebar reflects real balance immediately after claim/sync.
        void qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
      },
    },
  });
  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, enabled: !!isSignedIn },
  });
  const { data: creditsData } = useGetCreditsBalance({
    query: {
      queryKey: getGetCreditsBalanceQueryKey(),
      retry: false,
      enabled: !!isSignedIn,
      staleTime: 60_000,
    },
  });

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      const name = user.fullName ?? user.firstName ?? undefined;
      if (email) syncUser.mutate({ data: { email, name } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  useEffect(() => { setIsMobileOpen(false); }, [location]);

  const openPalette = useCallback(() => setCmdOpen(true), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const currentPage = navItems.find((item) => item.href === location)?.label || "Dashboard";
  const displayName = user?.fullName || user?.firstName || user?.username || "User";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSignOut = () => {
    signOut({ redirectUrl: `${window.location.origin}${basePath}/` });
  };

  const isAdmin = me?.role === "admin";
  const creditBalance = creditsData?.balance ?? 0;
  const creditPct = creditsData?.percentage ?? 0;
  const creditBarColor = getCreditBarColor(creditPct);
  const creditTextColor = getCreditColor(creditPct);
  const isLowCredit = creditsData?.lowCredit ?? false;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard">
            <Logo size={30} showWordmark />
          </Link>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-zinc-500 hover:text-white hover:bg-white/[0.05]"
          onClick={() => setIsMobileOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Command Palette trigger */}
      <div className="px-3 py-3 border-b border-white/[0.06] shrink-0">
        <button
          onClick={openPalette}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.10] transition-all duration-150 group"
        >
          <Search className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          <span className="flex-1 text-left text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">Search or jump to...</span>
          <div className="flex items-center gap-0.5 text-zinc-700">
            <Command className="w-3 h-3" />
            <span className="text-[10px] font-mono">K</span>
          </div>
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 sidebar-scroll">
        <p className="px-3 pb-2 text-[9px] font-black tracking-widest text-zinc-700 uppercase">
          Espaço de Trabalho
        </p>
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium group overflow-hidden transition-colors duration-150 ${
                isActive
                  ? "text-primary"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-xl bg-primary/[0.10]"
                  transition={{ type: "spring", stiffness: 420, damping: 38 }}
                />
              )}
              <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-primary origin-center"
                initial={false}
                animate={{ height: isActive ? 20 : 0, opacity: isActive ? 1 : 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              />
              <Icon className={`w-4 h-4 shrink-0 relative z-10 transition-colors duration-150 ${isActive ? "text-primary" : ""}`} />
              <span className="flex-1 text-[13px] relative z-10">{item.label}</span>
              {item.href === "/dashboard/credits" && isLowCredit && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 animate-pulse relative z-10" />
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <div className="pt-3 mt-2 border-t border-white/[0.06]">
            <p className="px-3 pb-2 text-[9px] font-black tracking-widest text-zinc-700 uppercase">
              Admin
            </p>
            <Link
              href="/admin"
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 text-[13px] font-medium overflow-hidden ${
                location.startsWith("/admin")
                  ? "text-primary"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              {location.startsWith("/admin") && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-xl bg-primary/[0.10]"
                  transition={{ type: "spring", stiffness: 420, damping: 38 }}
                />
              )}
              <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-primary origin-center"
                initial={false}
                animate={{ height: location.startsWith("/admin") ? 20 : 0, opacity: location.startsWith("/admin") ? 1 : 0 }}
                transition={{ duration: 0.18 }}
              />
              <ShieldCheck className="w-4 h-4 shrink-0 relative z-10" />
              <span className="flex-1 relative z-10">Painel Admin</span>
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-primary/30 font-black leading-4 relative z-10">
                ADM
              </Badge>
            </Link>
          </div>
        )}
      </div>

      {/* Credits Widget */}
      {creditsData && (
        <div className="px-4 py-3.5 border-t border-white/[0.06] shrink-0">
          <Link href="/dashboard/credits" className="block group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-primary fill-primary" />
                <span className="text-[11px] text-zinc-500 font-semibold tracking-wide">Créditos</span>
              </div>
              <span className={`text-[11px] font-bold tabular-nums ${creditTextColor}`}>
                {creditBalance.toLocaleString()}
                <span className="text-zinc-700 font-normal"> / {creditsData.planLimit.toLocaleString()}</span>
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${creditBarColor}`}
                style={{ width: `${Math.min(creditPct, 100)}%` }}
              />
            </div>
            {isLowCredit && (
              <p className="text-[10px] text-red-400 mt-1.5 font-medium">Créditos baixos — atualize seu plano</p>
            )}
          </Link>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-white/[0.06] shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors w-full text-left group">
              <Avatar className="w-8 h-8 border border-white/10 shrink-0">
                {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                  {isLoaded ? initials : ""}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                <span className="text-[13px] font-semibold truncate text-zinc-200">
                  {isLoaded ? displayName : "Loading..."}
                </span>
                <span className="text-[10px] text-zinc-600 truncate">{email}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0 group-hover:text-zinc-400 transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 bg-[#111111] border-white/[0.10]">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/analytics" className="flex items-center gap-2 cursor-pointer">
                <BarChart2 className="w-4 h-4" />
                Análises
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/credits" className="flex items-center gap-2 cursor-pointer">
                <Zap className="w-4 h-4" />
                Créditos
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/billing" className="flex items-center gap-2 cursor-pointer">
                <CreditCard className="w-4 h-4" />
                Faturamento
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link
                  href="/admin"
                  className="flex items-center gap-2 cursor-pointer text-primary focus:text-primary focus:bg-primary/10"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Painel Admin
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-white/[0.08]" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#080808] text-foreground overflow-hidden">

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a] border-r border-white/[0.06] transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static flex flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-white/[0.06] glass shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden w-8 h-8 text-zinc-500 hover:text-white hover:bg-white/[0.05]"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="w-4.5 h-4.5" />
            </Button>
            <h1 className="text-[13px] font-semibold text-zinc-400 tracking-wide">{currentPage}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Cmd+K shortcut hint (desktop) */}
            <button
              onClick={openPalette}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.09] transition-all duration-150 group"
            >
              <Command className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              <span className="text-[10px] font-mono text-zinc-600 group-hover:text-zinc-400 transition-colors">K</span>
            </button>

            {/* Notifications */}
            <NotificationsPanel />

            {isLowCredit && (
              <Link href="/dashboard/billing">
                <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] px-2.5 py-0.5 cursor-pointer hover:bg-red-500/15 transition-colors font-semibold">
                  Créditos Baixos
                </Badge>
              </Link>
            )}
            {creditsData && (
              <Link href="/dashboard/credits">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] transition-colors cursor-pointer">
                  <Zap className="w-3 h-3 text-primary fill-primary" />
                  <span className={`text-[11px] font-bold tabular-nums ${creditTextColor}`}>
                    {creditBalance.toLocaleString()}
                  </span>
                </div>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#0a0a0a] relative p-5 md:p-6 lg:p-8">
          <div className="absolute top-0 inset-x-0 h-56 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(201,168,76,0.055) 0%, transparent 70%)" }} />
          <div className="max-w-5xl mx-auto relative">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>

      <FeedbackModal />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
