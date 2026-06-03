import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, RefreshCw, Loader2, Users, Activity,
  Clock, BarChart2, User, LogOut, AlertTriangle, Search, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserMlConnectionItem {
  id: number;
  clerkUserId: string;
  platformUserId?: string | null;
  platformUsername?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userEmail?: string | null;
  userName?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const fmtTokenExpiry = (d: string | null | undefined) => {
  if (!d) return null;
  const dt   = new Date(d);
  const diff = dt.getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const days = Math.floor(diff / 86_400_000);
  const h    = Math.floor(diff / 3_600_000);
  const m    = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 1) return `${days}d restantes`;
  if (h > 0)   return `${h}h ${m}min restantes`;
  return `${m}min restantes`;
};

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminMercadoLivre() {
  const { toast } = useToast();

  const [userConnections, setUserConnections] = useState<UserMlConnectionItem[]>([]);
  const [loadingUserConns, setLoadingUserConns]   = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{
    type: "admin" | "user"; clerkUserId?: string; label: string;
  } | null>(null);
  const [disconnecting, setDisconnecting]         = useState(false);
  const [disconnectingUser, setDisconnectingUser] = useState<string | null>(null);
  const [search, setSearch]                       = useState("");
  const [lastUpdated, setLastUpdated]             = useState<Date | null>(null);
  const [refreshing, setRefreshing]               = useState(false);

  const loadUserConnections = useCallback(async () => {
    setLoadingUserConns(true);
    try {
      const data = await apiFetch<UserMlConnectionItem[]>("/api/ml/user-connections");
      setUserConnections(data);
      setLastUpdated(new Date());
    } catch { setUserConnections([]); }
    finally { setLoadingUserConns(false); }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await loadUserConnections();
    setRefreshing(false);
  }, [loadUserConnections]);

  useEffect(() => { void handleRefreshAll(); }, [handleRefreshAll]);

  const handleDisconnectConfirmed = async () => {
    if (!confirmDisconnect) return;
    if (confirmDisconnect.type === "admin") {
      setDisconnecting(true);
      setConfirmDisconnect(null);
      try {
        await apiFetch("/api/ml/disconnect", { method: "POST" });
        toast({ title: "Conta desconectada", description: "Tokens removidos com sucesso." });
        void loadUserConnections();
      } catch (e) {
        toast({ title: "Erro ao desconectar", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
      } finally { setDisconnecting(false); }
    } else {
      const uid   = confirmDisconnect.clerkUserId!;
      const label = confirmDisconnect.label;
      setDisconnectingUser(uid);
      setConfirmDisconnect(null);
      try {
        await apiFetch(`/api/ml/user-connections/${uid}/disconnect`, { method: "POST" });
        toast({ title: "Usuário desconectado", description: `Conexão de ${label} removida.` });
        void loadUserConnections();
      } catch (e) {
        toast({ title: "Erro ao desconectar usuário", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
      } finally { setDisconnectingUser(null); }
    }
  };

  const expired      = userConnections.filter(c => c.expiresAt && new Date(c.expiresAt) < new Date()).length;
  const expiringSoon = userConnections.filter(c => {
    if (!c.expiresAt) return false;
    const diff = new Date(c.expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 3_600_000;
  }).length;

  const filteredConnections = search.trim()
    ? userConnections.filter(c =>
        c.userName?.toLowerCase().includes(search.toLowerCase()) ||
        c.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
        c.platformUsername?.toLowerCase().includes(search.toLowerCase())
      )
    : userConnections;

  const kpis = [
    { label: "Usuários Conectados", value: String(userConnections.length),           icon: Users,    color: "text-amber-400"   },
    { label: "Conexões Ativas",     value: String(userConnections.length - expired), icon: Activity, color: "text-emerald-400" },
    { label: "Tokens Expirando",    value: String(expiringSoon + expired),            icon: Clock,    color: "text-red-400"     },
    { label: "Última Atualização",  value: lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—", icon: BarChart2, color: "text-zinc-400" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Mercado Livre</h1>
              <p className="text-xs text-zinc-500">Monitoramento de conexões dos usuários com o Mercado Livre.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline"
              onClick={() => void handleRefreshAll()}
              disabled={refreshing || loadingUserConns}
              className="border-white/10 text-zinc-400 hover:text-white h-8 gap-1.5 text-xs">
              {(refreshing || loadingUserConns) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Atualizar
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ─── KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-white/3 border-white/8">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-tight">{label}</p>
                <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Usuários Conectados ──────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-primary/70" />
              Usuários Conectados
              {!loadingUserConns && userConnections.length > 0 && (
                <span className="text-[11px] font-normal text-zinc-500">
                  ({userConnections.length} {userConnections.length === 1 ? "ativo" : "ativos"})
                </span>
              )}
            </CardTitle>
            <div className="relative">
              <Search className="w-3 h-3 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, email ou @conta..."
                className="w-full sm:w-64 bg-white/5 border border-white/8 rounded-lg pl-7 pr-7 py-1.5 text-[11px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUserConns ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm px-5 py-6">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />Carregando conexões...
            </div>
          ) : filteredConnections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 px-5">
              <div className="w-10 h-10 rounded-full bg-white/3 border border-white/8 flex items-center justify-center mb-1">
                <User className="w-4 h-4 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500">
                {search ? "Nenhuma conexão encontrada para esta busca." : "Nenhum usuário conectado ao Mercado Livre."}
              </p>
              <p className="text-[11px] text-zinc-700 max-w-xs">
                {search ? "Tente buscar por outro nome ou email." : "As conexões aparecerão aqui após o usuário autenticar sua conta."}
              </p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-white/5">
              {filteredConnections.map(conn => {
                const displayName  = conn.userName || conn.userEmail || conn.clerkUserId;
                const displayEmail = conn.userName && conn.userEmail ? conn.userEmail : null;
                const isExpired    = conn.expiresAt ? new Date(conn.expiresAt) < new Date() : false;
                const isSoon       = conn.expiresAt
                  ? !isExpired && new Date(conn.expiresAt).getTime() - Date.now() < 7 * 24 * 3_600_000
                  : false;
                const tokenLeft = fmtTokenExpiry(conn.expiresAt);
                const isDisc    = disconnectingUser === conn.clerkUserId;
                return (
                  <div key={conn.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-primary/60" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-white truncate max-w-[200px]">{displayName}</p>
                        {displayEmail && <span className="text-[10px] text-zinc-500 truncate">{displayEmail}</span>}
                      </div>
                      {conn.platformUsername && (
                        <p className="text-[10px] text-amber-400/80 font-mono">
                          Conta ML: @{conn.platformUsername}
                          {conn.platformUserId && <span className="text-zinc-600 ml-1">· ID {conn.platformUserId}</span>}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        {isExpired ? (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0">Token expirado</Badge>
                        ) : isSoon ? (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0">Expirando em breve</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">Ativo</Badge>
                        )}
                        {tokenLeft && !isExpired && <span className="text-[10px] text-zinc-500">{tokenLeft}</span>}
                        <span className="text-[10px] text-zinc-600">Conectado em {fmtDate(conn.createdAt)}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost"
                      onClick={() => setConfirmDisconnect({
                        type: "user",
                        clerkUserId: conn.clerkUserId,
                        label: conn.platformUsername ?? conn.userEmail ?? conn.clerkUserId,
                      })}
                      disabled={isDisc}
                      className="h-7 px-2.5 text-red-400/60 hover:text-red-300 hover:bg-red-500/8 border border-red-500/15 gap-1.5 text-xs whitespace-nowrap shrink-0 mt-0.5">
                      {isDisc ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                      Desconectar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Modal: Confirmar Desconexão ──────────────────────────── */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">Desconectar Mercado Livre</h3>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{confirmDisconnect.label}</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400">Tem certeza que deseja desconectar esta conexão?</p>
            <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80 leading-relaxed">Essa ação pode interromper a sincronização desta conta.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDisconnect(null)} disabled={disconnecting || !!disconnectingUser}
                className="px-4 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={() => void handleDisconnectConfirmed()} disabled={disconnecting || !!disconnectingUser}
                className="px-4 py-2 text-sm rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 hover:text-red-300 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                {(disconnecting || !!disconnectingUser) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar desconexão
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
