import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Flame, RefreshCw, Loader2, Activity, Clock, BarChart2,
  Settings, WifiOff, CheckCircle2, ExternalLink, Package,
  Zap, ShoppingBag, XCircle, Globe, Webhook, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface HotmartProduct {
  id: number;
  productId: string;
  name?: string | null;
  format?: string | null;
  status?: string | null;
  price?: string | null;
  currency?: string | null;
  syncedAt?: string | null;
}

interface HotmartEvent {
  id: number;
  eventType?: string | null;
  productId?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  value?: string | null;
  currency?: string | null;
  receivedAt?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminHotmart() {
  const [, navigate] = useLocation();

  const [platformConfig, setPlatformConfig] = useState<HotmartPlatformConfig | null>(null);
  const [products, setProducts]             = useState<HotmartProduct[]>([]);
  const [events, setEvents]                 = useState<HotmartEvent[]>([]);
  const [lastUpdated, setLastUpdated]       = useState<Date | null>(null);
  const [refreshing, setRefreshing]         = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Loaders ───────────────────────────────────────────────────────────────────
  const loadPlatformStatus = useCallback(async () => {
    try {
      const data = await apiFetch<HotmartPlatformConfig>("/api/hotmart/config");
      setPlatformConfig(data);
    } catch {
      setPlatformConfig(null);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const data = await apiFetch<HotmartProduct[]>("/api/hotmart/products");
      setProducts(data);
    } catch {
      setProducts([]);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const data = await apiFetch<HotmartEvent[]>("/api/hotmart/events");
      setEvents(data);
    } catch {
      setEvents([]);
    }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    setTestResult(null);
    await Promise.all([loadPlatformStatus(), loadProducts(), loadEvents()]);
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [loadPlatformStatus, loadProducts, loadEvents]);

  useEffect(() => { void handleRefreshAll(); }, [handleRefreshAll]);

  // ── Actions ───────────────────────────────────────────────────────────────────
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const data = await apiFetch<{ ok: boolean; message?: string }>("/api/hotmart/test", { method: "POST" });
      setTestResult({ ok: true, message: data.message ?? "Comunicação com a API Hotmart estabelecida com sucesso." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao testar conexão.";
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    try {
      const data = await apiFetch<{ ok: boolean; synced: number }>("/api/hotmart/sync-products", { method: "POST" });
      await loadProducts();
      setTestResult({ ok: true, message: `Sincronização técnica concluída: ${data.synced} produto(s) detectado(s) pela integração.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na sincronização.";
      setTestResult({ ok: false, message: msg });
    } finally {
      setSyncingProducts(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const isPlatformConfigured = platformConfig?.configured ?? false;
  const isPlatformActive     = platformConfig?.isActive ?? false;
  const hasWebhook           = !!(platformConfig?.webhookToken);
  const environmentLabel     = platformConfig?.environment === "production"
    ? "Produção" : platformConfig?.environment === "sandbox" ? "Sandbox" : "Não configurado";

  const kpis = [
    {
      label: "Eventos Recebidos",
      value: String(events.length),
      icon: Activity,
      color: "text-emerald-400",
    },
    {
      label: "Saúde da API",
      value: isPlatformActive ? "Online" : isPlatformConfigured ? "Inativo" : "Pendente",
      icon: Zap,
      color: isPlatformActive ? "text-emerald-400" : "text-amber-400",
    },
    {
      label: "Ambiente",
      value: platformConfig ? environmentLabel : "—",
      icon: BarChart2,
      color: "text-amber-400",
    },
    {
      label: "Última Verificação",
      value: lastUpdated
        ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "Nunca",
      icon: Clock,
      color: "text-zinc-400",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Hotmart — Central da Plataforma</h1>
              <p className="text-xs text-zinc-500">Monitoramento da integração, webhooks, eventos e saúde da API.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isPlatformConfigured && isPlatformActive ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />Integração Ativa
              </Badge>
            ) : isPlatformConfigured ? (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                <WifiOff className="w-2.5 h-2.5 mr-1" />Credenciais Inativas
              </Badge>
            ) : (
              <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-[10px]">
                <WifiOff className="w-2.5 h-2.5 mr-1" />Não Configurada
              </Badge>
            )}
            <Button size="sm" variant="outline"
              onClick={() => navigate("/admin/integrations")}
              className="border-white/10 text-zinc-400 hover:text-white h-8 gap-1.5 text-xs">
              <Settings className="w-3.5 h-3.5" />
              Configurar Hotmart
              <ExternalLink className="w-3 h-3 opacity-50" />
            </Button>
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

      {/* ─── Nota operacional da plataforma ──────────────────────── */}
      <div className="rounded-lg bg-zinc-900/60 border border-white/8 px-4 py-3 flex items-start gap-3">
        <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          A Hotmart é operada como <span className="text-zinc-300 font-medium">central da plataforma IAttom</span>.
          Usuários não conectam contas pessoais nesta fase. A central serve para campanhas, automações,
          monitoramento de eventos e integração com o ecossistema de vendas da plataforma.
        </p>
      </div>

      {/* ─── Aviso de configuração pendente ──────────────────────── */}
      {!isPlatformConfigured && (
        <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-4 py-3 text-xs text-amber-400/80 leading-relaxed">
          As credenciais da integração Hotmart ainda não foram configuradas.
          Configure em <span className="font-semibold">Integrações</span> para ativar o recebimento de eventos e a comunicação com a API.
        </div>
      )}

      {/* ─── KPIs de operação ────────────────────────────────────── */}
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

      {/* ─── Status Operacional ───────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-zinc-500" />
              Status Operacional
            </CardTitle>
            <Button size="sm" variant="outline"
              onClick={() => void handleTestConnection()}
              disabled={testingConnection || !isPlatformConfigured}
              className="border-white/10 text-zinc-400 hover:text-white h-7 gap-1.5 text-xs">
              {testingConnection
                ? <><Loader2 className="w-3 h-3 animate-spin" />Testando...</>
                : <><Zap className="w-3 h-3" />Testar Conexão</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Ambiente</p>
              <p className="text-xs font-medium text-white">{environmentLabel}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">API</p>
              {isPlatformActive ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5">Credenciais ativas</Badge>
              ) : isPlatformConfigured ? (
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px] px-1.5">Credenciais inativas</Badge>
              ) : (
                <Badge className="bg-zinc-500/15 text-zinc-500 border-zinc-500/30 text-[9px] px-1.5">Pendente</Badge>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Webhook</p>
              {hasWebhook ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5">
                  <Webhook className="w-2.5 h-2.5 mr-1" />Configurado
                </Badge>
              ) : (
                <Badge className="bg-zinc-500/15 text-zinc-500 border-zinc-500/30 text-[9px] px-1.5">Pendente</Badge>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Última atualização</p>
              <p className="text-xs font-medium text-white">
                {platformConfig?.updatedAt
                  ? new Date(platformConfig.updatedAt).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", year: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })
                  : "—"}
              </p>
            </div>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed ${
              testResult.ok
                ? "bg-emerald-500/8 border border-emerald-500/20 text-emerald-400"
                : "bg-red-500/8 border border-red-500/20 text-red-400"
            }`}>
              {testResult.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Eventos / Webhooks Recebidos ─────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-zinc-500" />
            Eventos Recebidos via Webhook
            {events.length > 0 && (
              <span className="text-[11px] font-normal text-zinc-500">({events.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 px-5">
              <div className="w-10 h-10 rounded-full bg-white/3 border border-white/8 flex items-center justify-center mb-1">
                <Activity className="w-4 h-4 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500">Nenhum evento recebido ainda.</p>
              <p className="text-[11px] text-zinc-700 max-w-xs">
                Configure o webhook Hotmart para que compras, cancelamentos e outros eventos da plataforma apareçam aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto divide-y divide-white/5">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Flame className="w-3.5 h-3.5 text-red-400/60" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[9px] px-1.5 py-0 font-mono">
                        {event.eventType ?? "UNKNOWN"}
                      </Badge>
                      {event.value && event.value !== "" && (
                        <span className="text-[10px] font-semibold text-emerald-400">
                          {event.currency ?? "BRL"} {event.value}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-zinc-400 truncate">
                        {event.buyerName ?? event.buyerEmail ?? "Comprador desconhecido"}
                      </span>
                      {event.productId && (
                        <span className="text-[10px] text-zinc-600 font-mono">#{event.productId}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-600 shrink-0 mt-0.5">
                    {event.receivedAt
                      ? new Date(event.receivedAt).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Dados técnicos da integração (secundário) ────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-zinc-500" />
                Dados Técnicos da Integração
                {products.length > 0 && (
                  <span className="text-[11px] font-normal text-zinc-500">({products.length})</span>
                )}
              </CardTitle>
              <p className="text-[10px] text-zinc-600">
                Produtos detectados pela integração quando disponíveis — não é um catálogo editável.
              </p>
            </div>
            <Button size="sm" variant="ghost"
              onClick={() => void handleSyncProducts()}
              disabled={syncingProducts || !isPlatformConfigured}
              className="text-zinc-600 hover:text-zinc-300 h-7 gap-1.5 text-xs shrink-0">
              {syncingProducts
                ? <><Loader2 className="w-3 h-3 animate-spin" />Sincronizando...</>
                : <><RefreshCw className="w-3 h-3" />Sincronizar via API</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-5 text-zinc-700 text-xs">
              <Package className="w-4 h-4 shrink-0" />
              Nenhum produto detectado pela integração. Execute a sincronização via API para verificar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-[10px] text-zinc-600 uppercase tracking-wider px-5 py-2 font-medium">Nome</th>
                    <th className="text-left text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2 font-medium">ID</th>
                    <th className="text-left text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2 font-medium hidden sm:table-cell">Status</th>
                    <th className="text-right text-[10px] text-zinc-600 uppercase tracking-wider px-5 py-2 font-medium hidden md:table-cell">Sincronizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3 text-zinc-300 truncate max-w-[160px]">
                        {product.name ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-zinc-600 font-mono">{product.productId}</td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        {product.status === "ACTIVE" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5">Ativo</Badge>
                        ) : (
                          <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-[9px] px-1.5">{product.status ?? "—"}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-zinc-600 hidden md:table-cell">
                        {product.syncedAt
                          ? new Date(product.syncedAt).toLocaleString("pt-BR", {
                              day: "2-digit", month: "2-digit", year: "2-digit",
                              hour: "2-digit", minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
