import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Flame, RefreshCw, Loader2, Clock,
  Settings, ExternalLink, LogOut, X,
  Users, UserCheck, Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status });
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HotmartPlatformConfig {
  configured: boolean;
  isActive: boolean;
  environment?: string;
  webhookToken?: string;
  updatedAt?: string;
}

interface UserHotmartConnection {
  id: number;
  clerkUserId: string;
  platformUserId?: string | null;
  platformUsername?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminHotmart() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [platformConfig, setPlatformConfig]   = useState<HotmartPlatformConfig | null>(null);
  const [userConnections, setUserConnections] = useState<UserHotmartConnection[]>([]);
  const [lastUpdated, setLastUpdated]         = useState<Date | null>(null);
  const [refreshing, setRefreshing]           = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ clerkUserId: string; label: string } | null>(null);
  const [disconnectingUser, setDisconnectingUser] = useState<string | null>(null);

  // ── Loaders ───────────────────────────────────────────────────────────────────
  const loadPlatformStatus = useCallback(async () => {
    try {
      const data = await apiFetch<HotmartPlatformConfig>("/api/hotmart/config");
      setPlatformConfig(data);
    } catch {
      setPlatformConfig(null);
    }
  }, []);

  const loadUserConnections = useCallback(async () => {
    try {
      const data = await apiFetch<UserHotmartConnection[]>("/api/hotmart/user-connections");
      setUserConnections(data);
    } catch {
      setUserConnections([]);
    }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPlatformStatus(), loadUserConnections()]);
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [loadPlatformStatus, loadUserConnections]);

  const handleDisconnectUser = useCallback(async (clerkUserId: string, label: string) => {
    setDisconnectingUser(clerkUserId);
    setConfirmDisconnect(null);
    try {
      const res = await apiFetch<{ ok: boolean }>(`/api/hotmart/user-connections/${clerkUserId}/disconnect`, { method: "POST" });
      if (!res.ok) throw new Error("Falha ao desconectar.");
      toast({ title: "Usuário desconectado", description: `Conexão de ${label} removida.` });
      void loadUserConnections();
    } catch (e) {
      toast({ title: "Erro ao desconectar", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setDisconnectingUser(null);
    }
  }, [loadUserConnections, toast]);

  useEffect(() => { void handleRefreshAll(); }, [handleRefreshAll]);

  // ── Derived — only active connections ─────────────────────────────────────────
  const activeConnections = userConnections.filter(c => c.isActive);
  const totalActive       = activeConnections.length;
  const expiringCount     = activeConnections.filter(c => {
    if (!c.expiresAt) return false;
    const exp = new Date(c.expiresAt);
    const now = new Date();
    return exp > now && exp < new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }).length;

  const isPlatformConfigured = platformConfig?.configured ?? false;
  const isPlatformActive     = platformConfig?.isActive ?? false;

  return (
    <div className="p-6 space-y-5 max-w-4xl">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Hotmart</h1>
              <p className="text-xs text-zinc-500">Usuários conectados e status da integração.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Monitoramento ativo</Badge>
            <Button size="sm" variant="outline"
              onClick={() => void handleRefreshAll()}
              disabled={refreshing}
              className="border-white/10 text-zinc-400 hover:text-white h-8 gap-1.5 text-xs">
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Atualizar
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ─── Aviso de configuração pendente ──────────────────────── */}
      {!isPlatformConfigured && (
        <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-4 py-3 text-xs text-amber-400/80 leading-relaxed">
          Credenciais não configuradas. Acesse <span className="font-semibold">Integrações</span> para ativar a comunicação com a API Hotmart.
        </div>
      )}

      {/* ─── KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <Card className="bg-white/3 border-white/8">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Usuários Conectados</p>
              <Users className="w-3.5 h-3.5 text-primary shrink-0" />
            </div>
            <p className="text-2xl font-bold text-white">{totalActive}</p>
            <p className="text-[10px] text-zinc-600 mt-1">contas conectadas</p>
          </CardContent>
        </Card>

        <Card className="bg-white/3 border-white/8">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Conexões Ativas</p>
              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <p className="text-2xl font-bold text-white">{totalActive}</p>
            <p className="text-[10px] text-zinc-600 mt-1">ativas no momento</p>
          </CardContent>
        </Card>

        <Card className="bg-white/3 border-white/8">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Tokens Expirando</p>
              <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </div>
            <p className="text-2xl font-bold text-white">{expiringCount}</p>
            <p className="text-[10px] text-zinc-600 mt-1">tokens em 24h</p>
          </CardContent>
        </Card>

        <Card className="bg-white/3 border-white/8">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Última Atualização</p>
              <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            </div>
            <p className="text-sm font-semibold text-white">
              {lastUpdated
                ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </p>
            <p className="text-[10px] text-zinc-600 mt-1">última atualização</p>
          </CardContent>
        </Card>

      </div>

      {/* ─── Lista de contas conectadas (ativas apenas) ───────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-500" />
            Usuários Conectados
            {totalActive > 0 && (
              <span className="text-[11px] font-normal text-zinc-500">({totalActive})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeConnections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-1.5 px-5">
              <div className="w-9 h-9 rounded-full bg-white/3 border border-white/8 flex items-center justify-center mb-1">
                <Users className="w-4 h-4 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500">Nenhuma conta conectada.</p>
              <p className="text-[11px] text-zinc-700">Os usuários que conectarem suas contas Hotmart aparecerão aqui.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-[10px] text-zinc-600 uppercase tracking-wider px-5 py-2 font-medium">Usuário</th>
                    <th className="text-left text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2 font-medium hidden sm:table-cell">Conta Hotmart</th>
                    <th className="text-left text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2 font-medium">Status</th>
                    <th className="text-left text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2 font-medium hidden md:table-cell">Conectado em</th>
                    <th className="text-right text-[10px] text-zinc-600 uppercase tracking-wider px-5 py-2 font-medium hidden lg:table-cell">Expira em</th>
                    <th className="text-right text-[10px] text-zinc-600 uppercase tracking-wider px-5 py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeConnections.map((conn) => {
                    const isExpiring = conn.expiresAt
                      ? new Date(conn.expiresAt) < new Date(Date.now() + 24 * 60 * 60 * 1000) && new Date(conn.expiresAt) > new Date()
                      : false;
                    return (
                      <tr key={conn.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-5 py-3 text-zinc-300 font-mono text-[10px] truncate max-w-[130px]">
                          {conn.clerkUserId.replace("user_", "").slice(0, 16)}…
                        </td>
                        <td className="px-3 py-3 text-zinc-400 hidden sm:table-cell truncate max-w-[140px]">
                          {conn.platformUsername ?? conn.platformUserId ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          {isExpiring ? (
                            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px] px-1.5">Expirando</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5">Ativo</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 text-zinc-600 hidden md:table-cell">
                          {conn.createdAt
                            ? new Date(conn.createdAt).toLocaleString("pt-BR", {
                                day: "2-digit", month: "2-digit", year: "2-digit",
                                hour: "2-digit", minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-right text-zinc-600 hidden lg:table-cell">
                          {conn.expiresAt
                            ? new Date(conn.expiresAt).toLocaleString("pt-BR", {
                                day: "2-digit", month: "2-digit", year: "2-digit",
                                hour: "2-digit", minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDisconnect({
                              clerkUserId: conn.clerkUserId,
                              label: conn.platformUsername ?? conn.clerkUserId.replace("user_", "").slice(0, 12),
                            })}
                            disabled={disconnectingUser === conn.clerkUserId}
                            className="h-7 px-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 gap-1 text-[11px]">
                            {disconnectingUser === conn.clerkUserId
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <LogOut className="w-3 h-3" />}
                            Desconectar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Confirm Dialog ──────────────────────────────────────── */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Desconectar usuário</p>
              <button onClick={() => setConfirmDisconnect(null)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Desconectar <span className="text-white font-medium">{confirmDisconnect.label}</span>?
              O usuário precisará reconectar sua conta Hotmart.
            </p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setConfirmDisconnect(null)}
                className="border-white/10 text-zinc-400">Cancelar</Button>
              <Button size="sm"
                onClick={() => void handleDisconnectUser(confirmDisconnect.clerkUserId, confirmDisconnect.label)}
                className="bg-red-600 hover:bg-red-500 text-white gap-1.5">
                {disconnectingUser === confirmDisconnect.clerkUserId
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <LogOut className="w-3.5 h-3.5" />}
                Desconectar
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
