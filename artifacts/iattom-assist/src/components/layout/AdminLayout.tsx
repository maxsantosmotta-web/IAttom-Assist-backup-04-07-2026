import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Users,
  TrendingUp,
  Activity,
  Clock,
  MessageSquare,
  Instagram,
  Facebook,
  ShoppingBag,
  ShoppingCart,
  Flame,
  Zap,
  Wifi,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
  Trash2,
  Music2,
  MonitorCheck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useUser, useClerk } from "@clerk/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoMark } from "@/components/ui/Logo";

const navItems = [
  { href: "/admin", label: "Visão Geral", icon: BarChart3 },
  { href: "/admin/users", label: "Usuários", icon: Users },
  { href: "/admin/analytics", label: "Análises", icon: TrendingUp },
  { href: "/admin/activity", label: "Atividade", icon: Activity },
  { href: "/admin/waitlist", label: "Lista de Espera", icon: Clock },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/integrations", label: "Integrações", icon: Wifi },
  { href: "/admin/instagram", label: "Instagram", icon: Instagram },
  { href: "/admin/facebook",  label: "Facebook",  icon: Facebook  },
  { href: "/admin/shopee", label: "Shopee", icon: ShoppingBag },
  { href: "/admin/tiktok", label: "TikTok", icon: Music2 },
  { href: "/admin/mercado-livre", label: "Mercado Livre", icon: ShoppingCart },
  { href: "/admin/hotmart", label: "Hotmart", icon: Flame },
  { href: "/admin/kiwify", label: "Kiwify", icon: Zap },
  { href: "/admin/health", label: "Saúde da Plataforma", icon: MonitorCheck },
  { href: "/admin/trash", label: "Lixeira", icon: Trash2 },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const currentPage = navItems.find((item) => item.href === location)?.label || "Admin";
  const closeSidebar = () => setIsMobileOpen(false);

  const displayName = user?.fullName || user?.firstName || user?.username || "Admin";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = () => {
    signOut({ redirectUrl: `${window.location.origin}${basePath}/` });
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a] border-r border-white/[0.06] transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static flex flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-5 border-b border-white/[0.06] shrink-0 gap-3">
          <LogoMark size={30} />
          <div className="flex items-center gap-1.5 ml-auto">
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-primary/30 font-bold leading-4 tracking-wider">
              ADMIN
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-muted-foreground ml-1"
            onClick={closeSidebar}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Back link */}
        <div className="px-3 py-3 border-b border-white/[0.04] shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-150"
            onClick={closeSidebar}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Voltar ao Dashboard
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Painel de Controle
          </p>
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
                onClick={closeSidebar}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                )}
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* User */}
        <div className="p-3 border-t border-white/[0.06] shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors w-full text-left">
                <Avatar className="w-8 h-8 border border-white/10 shrink-0">
                  {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {isLoaded ? initials : ""}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                  <span className="text-xs font-semibold truncate text-zinc-200">
                    {isLoaded ? displayName : "Loading..."}
                  </span>
                  <span className="text-[10px] text-primary font-medium">Administrador</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 bg-[#111111] border-white/10">
              <DropdownMenuSeparator className="bg-white/10" />
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
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-5 md:px-6 border-b border-white/[0.06] bg-[#080808] shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-zinc-400"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h1 className="text-sm font-semibold text-zinc-200 tracking-wide">{currentPage}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 hidden sm:block">{email}</span>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-2">Admin</Badge>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#0a0a0a] p-5 md:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
