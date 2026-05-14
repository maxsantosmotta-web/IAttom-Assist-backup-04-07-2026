import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Instagram,
  Facebook,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Webhook,
  MessageSquare,
  Clock,
  Users,
  Globe,
  Link2,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntegrationFutureAutomations } from "@/components/integrations/IntegrationFutureAutomations";

interface MetaConfigData {
  configured: boolean;
  appId?: string;
  appSecret?: string;
  verifyToken?: string;
  userAccessToken?: string;
  webhookUrl?: string;
  isActive?: boolean;
  updatedAt?: string;
}

interface MetaPageItem {
  id: number;
  pageId: string;
  name: string;
  category?: string | null;
  instagramAccountId?: string | null;
  webhookSubscribed?: boolean | null;
  syncedAt?: string | null;
}

interface MetaIgAccount {
  id: number;
  igId: string;
  name?: string | null;
  username?: string | null;
  biography?: string | null;
  followersCount?: string | null;
  pageId?: string | null;
}

interface MetaEventItem {
  id: number;
  platform?: string | null;
  eventType?: string | null;
  objectId?: string | null;
  receivedAt?: string | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-colors";

export function AdminMeta() {
  const [config, setConfig] = useState<MetaConfigData | null>(null);
  const [pages, setPages] = useState<MetaPageItem[]>([]);
  const [igAccounts, setIgAccounts] = useState<MetaIgAccount[]>([]);
  const [events, setEvents] = useState<MetaEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  const [syncingPages, setSyncingPages] = useState(false);
  const [syncingIg, setSyncingIg] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [subscribingPageId, setSubscribingPageId] = useState<string | null>(null);

  const [form, setForm] = useState({
    appId: "",
    appSecret: "",
    verifyToken: "",
    userAccessToken: "",
    webhookUrl: "",
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const webhookEndpoint = `${window.location.origin}${BASE}/api/meta/webhook`;

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfg, pgs, igs] = await Promise.all([
        apiFetch<MetaConfigData>("/api/meta/config"),
        apiFetch<MetaPageItem[]>("/api/meta/pages"),
        apiFetch<MetaIgAccount[]>("/api/meta/instagram-accounts"),
      ]);
      setConfig(cfg);
      setPages(pgs);
      setIgAccounts(igs);
      if (cfg.configured) {
        setForm({
          appId: cfg.appId ?? "",
          appSecret: "",
          verifyToken: cfg.verifyToken ?? "",
          userAccessToken: "",
          webhookUrl: cfg.webhookUrl ?? "",
        });
      }
    } catch {
      setConfig({ configured: false });
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      const data = await apiFetch<MetaEventItem[]>("/api/meta/events");
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    void loadEvents();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      await apiFetch("/api/meta/config", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSaveStatus("ok");
      await loadAll();
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncPages = async () => {
    setSyncingPages(true);
    try {
      await apiFetch("/api/meta/sync-pages", { method: "POST" });
      await loadAll();
    } catch {
      // silent — server logs detail
    } finally {
      setSyncingPages(false);
    }
  };

  const handleSyncIg = async () => {
    setSyncingIg(true);
    try {
      await apiFetch("/api/meta/sync-instagram", { method: "POST" });
      await loadAll();
    } catch {
      // silent
    } finally {
      setSyncingIg(false);
    }
  };

  const handleSubscribePage = async (pageId: string) => {
    setSubscribingPageId(pageId);
    try {
      await apiFetch(`/api/meta/subscribe-page/${pageId}`, { method: "POST" });
      await loadAll();
    } catch {
      // silent
    } finally {
      setSubscribingPageId(null);
    }
  };

  const copyToClipboard = (text: string) => void navigator.clipboard.writeText(text);

  const formatDate = (d: string | null | undefined) =>
    d
      ? new Date(d).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const platformColor = (p: string | null | undefined) =>
    p === "instagram"
      ? "bg-pink-500/15 text-pink-400 border-pink-500/30"
      : p === "facebook"
        ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
        : "bg-zinc-700/40 text-zinc-400 border-zinc-600/30";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <Layers className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Meta — Instagram & Facebook</h1>
          {config?.isActive ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
              Ativo
            </Badge>
          ) : (
            <Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-600/30 text-[10px]">
              Não configurado
            </Badge>
          )}
        </div>
        <p className="text-sm text-zinc-500 ml-8">
          Gerencie a integração com a Meta Graph API — Instagram Business e Facebook Pages.
        </p>
      </motion.div>

      {/* ─── CONFIG FORM ─────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary/70" />
            Credenciais do Meta App
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando configuração...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">App ID</label>
                  <input
                    className={inputClass}
                    placeholder="ex: 123456789012345"
                    value={form.appId}
                    onChange={(e) => setForm((f) => ({ ...f, appId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">App Secret</label>
                  <div className="relative">
                    <input
                      className={inputClass + " pr-10"}
                      type={showSecret ? "text" : "password"}
                      placeholder={config?.configured ? "Novo secret para substituir" : "xxxxxxxx..."}
                      value={form.appSecret}
                      onChange={(e) => setForm((f) => ({ ...f, appSecret: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {config?.configured && (
                    <p className="text-[10px] text-zinc-600">
                      Secret atual: {config.appSecret} — deixe em branco para manter.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">User Access Token</label>
                <div className="relative">
                  <input
                    className={inputClass + " pr-10"}
                    type={showToken ? "text" : "password"}
                    placeholder={config?.configured ? "Novo token para substituir" : "EAAxxxxx..."}
                    value={form.userAccessToken}
                    onChange={(e) => setForm((f) => ({ ...f, userAccessToken: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600">
                  Token gerado via Meta Developers → Graph API Explorer ou System User.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Verify Token</label>
                  <input
                    className={inputClass}
                    placeholder="ex: meu_token_secreto_meta"
                    value={form.verifyToken}
                    onChange={(e) => setForm((f) => ({ ...f, verifyToken: e.target.value }))}
                  />
                  <p className="text-[10px] text-zinc-600">
                    Defina qualquer string — insira o mesmo no Meta Developers ao configurar o webhook.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    Webhook URL (referência)
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Exibido abaixo automaticamente"
                    value={form.webhookUrl}
                    onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  {saveStatus === "ok" && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Configuração salva.
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Erro ao salvar. Verifique os campos.
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={
                    saving ||
                    !form.appId ||
                    !form.verifyToken ||
                    (!form.appSecret && !config?.configured) ||
                    (!form.userAccessToken && !config?.configured)
                  }
                  className="bg-primary text-black hover:bg-primary/90 gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {saving ? "Salvando..." : "Salvar configuração"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── WEBHOOK ENDPOINT ─────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary/70" />
            Endpoint do Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono break-all">
              {webhookEndpoint}
            </code>
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 h-8 w-8 text-zinc-500 hover:text-white"
              onClick={() => copyToClipboard(webhookEndpoint)}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-primary">Como configurar no Meta Developers</p>
            <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Acesse developers.facebook.com → seu App → Webhooks.</li>
              <li>Clique em "Adicionar assinatura" → selecione <strong className="text-zinc-300">Page</strong> ou <strong className="text-zinc-300">Instagram</strong>.</li>
              <li>Cole a URL acima no campo "URL de Callback".</li>
              <li>Cole o Verify Token definido no campo "Token de Verificação".</li>
              <li>Clique em "Verificar e Salvar".</li>
              <li>Inscreva os campos: <code className="text-primary/80">messages</code>, <code className="text-primary/80">comments</code>, <code className="text-primary/80">feed</code>, <code className="text-primary/80">mention</code>.</li>
              <li>Após salvar as credenciais acima, clique em "Sincronizar Páginas" para importar suas páginas.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* ─── FACEBOOK PAGES ───────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Facebook className="w-4 h-4 text-blue-400" />
              Páginas do Facebook
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">
                {pages.length}
              </Badge>
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleSyncPages()}
              disabled={syncingPages || !config?.isActive}
              className="h-7 px-2.5 text-zinc-500 hover:text-white gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${syncingPages ? "animate-spin" : ""}`} />
              {syncingPages ? "Sincronizando..." : "Sincronizar Páginas"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhuma página sincronizada. Salve as credenciais e clique em "Sincronizar Páginas".
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{page.name}</p>
                    <p className="text-[10px] text-zinc-600 font-mono">{page.pageId}</p>
                    {page.category && (
                      <p className="text-[10px] text-zinc-500">{page.category}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {page.instagramAccountId && (
                      <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20 text-[10px]">
                        <Instagram className="w-2.5 h-2.5 mr-1" />
                        IG vinculado
                      </Badge>
                    )}
                    {page.webhookSubscribed ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                        <Webhook className="w-2.5 h-2.5 mr-1" />
                        Webhook ativo
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleSubscribePage(page.pageId)}
                        disabled={subscribingPageId === page.pageId}
                        className="h-6 px-2 text-[10px] text-zinc-500 hover:text-white gap-1"
                      >
                        {subscribingPageId === page.pageId ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <Link2 className="w-2.5 h-2.5" />
                        )}
                        Ativar webhook
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── INSTAGRAM ACCOUNTS ───────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Instagram className="w-4 h-4 text-pink-400" />
              Contas Instagram Business
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">
                {igAccounts.length}
              </Badge>
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleSyncIg()}
              disabled={syncingIg || pages.length === 0}
              className="h-7 px-2.5 text-zinc-500 hover:text-white gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${syncingIg ? "animate-spin" : ""}`} />
              {syncingIg ? "Sincronizando..." : "Sincronizar Instagram"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {igAccounts.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <Instagram className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhuma conta Instagram sincronizada. Sincronize as Páginas primeiro.
            </div>
          ) : (
            <div className="space-y-2">
              {igAccounts.map((acct) => (
                <div
                  key={acct.id}
                  className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      @{acct.username || acct.name || "—"}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono">{acct.igId}</p>
                    {acct.biography && (
                      <p className="text-[10px] text-zinc-500 truncate">{acct.biography}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <Users className="w-2.5 h-2.5" />
                      {Number(acct.followersCount ?? 0).toLocaleString("pt-BR")} seguidores
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── EVENTS LOG ───────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary/70" />
              Eventos Recebidos
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">
                {events.length}
              </Badge>
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void loadEvents()}
              disabled={eventsLoading}
              className="h-7 px-2 text-zinc-500 hover:text-white gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${eventsLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando eventos...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum evento recebido ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2"
                >
                  <Badge className={`text-[10px] shrink-0 ${platformColor(ev.platform)}`}>
                    {ev.platform ?? "—"}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">
                    {ev.eventType ?? "—"}
                  </Badge>
                  <span className="text-xs text-zinc-400 font-mono truncate flex-1">
                    {ev.objectId ?? "—"}
                  </span>
                  <span className="text-[10px] text-zinc-600 shrink-0">
                    {formatDate(ev.receivedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <IntegrationFutureAutomations
        items={[
          "Resposta automática a comentários",
          "Reply automático a DMs do Instagram",
          "Moderação de comentários com IA",
          "Agendamento de postagens",
          "Geração de respostas personalizadas",
          "Relatório de engajamento",
        ]}
      />
    </div>
  );
}
