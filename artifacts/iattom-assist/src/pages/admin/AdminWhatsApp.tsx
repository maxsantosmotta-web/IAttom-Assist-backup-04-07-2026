import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Phone,
  Save,
  Send,
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WhatsAppConfigData {
  configured: boolean;
  businessAccountId?: string;
  phoneNumberId?: string;
  accessToken?: string;
  verifyToken?: string;
  webhookUrl?: string;
  isActive?: boolean;
  updatedAt?: string;
}

interface WhatsAppEventItem {
  id: number;
  eventType: string | null;
  fromNumber: string | null;
  receivedAt: string | null;
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

export function AdminWhatsApp() {
  const [config, setConfig] = useState<WhatsAppConfigData | null>(null);
  const [events, setEvents] = useState<WhatsAppEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  const [eventsLoading, setEventsLoading] = useState(false);

  const [form, setForm] = useState({
    businessAccountId: "",
    phoneNumberId: "",
    accessToken: "",
    verifyToken: "",
    webhookUrl: "",
  });

  const [showToken, setShowToken] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testMessage, setTestMessage] = useState("Olá! Esta é uma mensagem de teste do IAttom Assist.");
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  const { toast } = useToast();
  const webhookEndpoint = `${window.location.origin}${BASE}/api/whatsapp/webhook`;

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<WhatsAppConfigData>("/api/whatsapp/config");
      setConfig(data);
      if (data.configured) {
        setForm({
          businessAccountId: data.businessAccountId ?? "",
          phoneNumberId: data.phoneNumberId ?? "",
          accessToken: "",
          verifyToken: data.verifyToken ?? "",
          webhookUrl: data.webhookUrl ?? "",
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
      const data = await apiFetch<WhatsAppEventItem[]>("/api/whatsapp/events");
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
    void loadEvents();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      await apiFetch("/api/whatsapp/config", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSaveStatus("ok");
      toast({ description: "Credenciais WhatsApp salvas com sucesso." });
      await loadConfig();
    } catch {
      setSaveStatus("error");
      toast({ variant: "destructive", description: "Erro ao salvar credenciais. Verifique os dados e tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testTo || !testMessage) return;
    setTestStatus("sending");
    try {
      await apiFetch("/api/whatsapp/send-test", {
        method: "POST",
        body: JSON.stringify({ to: testTo, message: testMessage }),
      });
      setTestStatus("ok");
      toast({ description: "Mensagem de teste enviada com sucesso." });
    } catch {
      setTestStatus("error");
      toast({ variant: "destructive", description: "Falha ao enviar mensagem de teste. Verifique as credenciais e o número." });
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast({ description: "URL copiada." });
  };

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-colors";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Phone className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">WhatsApp Cloud API</h1>
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
        <p className="text-sm text-zinc-500 ml-7 leading-relaxed">
          Configure a integração com a WhatsApp Business Cloud API via Meta Developers.
        </p>
      </motion.div>

      {/* ─── CONFIG FORM ─────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary/70" />
            Credenciais
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
                  <label className="text-xs font-medium text-zinc-400">
                    WhatsApp Business Account ID
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Ex.: 123456789012345"
                    value={form.businessAccountId}
                    onChange={(e) => setForm((f) => ({ ...f, businessAccountId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">ID do número</label>
                  <input
                    className={inputClass}
                    placeholder="Ex.: 987654321098765"
                    value={form.phoneNumberId}
                    onChange={(e) => setForm((f) => ({ ...f, phoneNumberId: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Token de acesso</label>
                <div className="relative">
                  <input
                    className={inputClass + " pr-10"}
                    type={showToken ? "text" : "password"}
                    placeholder={
                      config?.configured
                        ? "Digite o novo token para substituir"
                        : "EAAxxxxx..."
                    }
                    value={form.accessToken}
                    onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {config?.configured && (
                  <p className="text-[10px] text-zinc-600">
                    Token atual: {config.accessToken} — deixe em branco para manter.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Token de verificação</label>
                  <input
                    className={inputClass}
                    placeholder="Ex.: meu_token_secreto_123"
                    value={form.verifyToken}
                    onChange={(e) => setForm((f) => ({ ...f, verifyToken: e.target.value }))}
                  />
                  <p className="text-[10px] text-zinc-600">
                    Token que você define e insere também no Meta Developers.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    URL do webhook (referência)
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Preenchido automaticamente abaixo"
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
                      Configuração salva com sucesso.
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
                  onClick={() => void handleSave()}
                  disabled={saving || !form.businessAccountId || !form.phoneNumberId || !form.verifyToken}
                  className="h-11 bg-primary text-black hover:bg-primary/90 inline-flex items-center justify-center gap-2 px-5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Salvando..." : "Salvar configuração"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── WEBHOOK INFO ─────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary/70" />
            Endpoint do Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2">
            <code className="w-full bg-black/30 border border-white/8 rounded-xl px-4 py-3 text-xs text-zinc-300 font-mono break-all overflow-hidden block leading-relaxed">
              {webhookEndpoint}
            </code>
            <button
              className="self-end inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors font-medium"
              onClick={() => copyToClipboard(webhookEndpoint)}
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar URL
            </button>
          </div>
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-primary">Como configurar no Meta Developers</p>
            <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Acesse developers.facebook.com e selecione seu App.</li>
              <li>Vá em WhatsApp → Configuração → Webhooks.</li>
              <li>Cole a URL acima no campo "URL de Retorno de Chamada".</li>
              <li>Cole o Verify Token definido acima no campo "Token de Verificação".</li>
              <li>Clique em "Verificar e Salvar" — a rota GET responderá com o challenge.</li>
              <li>Inscreva os campos: <code className="text-primary/80">messages</code>, <code className="text-primary/80">message_deliveries</code>.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* ─── TEST SEND ─────────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-primary/70" />
            Enviar Mensagem de Teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!config?.isActive && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/15 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Configure e salve as credenciais antes de enviar.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Número destino</label>
              <input
                className={inputClass}
                placeholder="Ex.: 5511999998888"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <p className="text-[10px] text-zinc-600">Formato E.164 sem + (código do país + DDD + número).</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Mensagem</label>
              <input
                className={inputClass}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              {testStatus === "ok" && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mensagem enviada com sucesso.
                </span>
              )}
              {testStatus === "error" && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Falha no envio. Verifique as credenciais e o número.
                </span>
              )}
            </div>
            <Button
              onClick={() => void handleTestSend()}
              disabled={testStatus === "sending" || !config?.isActive || !testTo}
              className="h-11 bg-primary text-black hover:bg-primary/90 inline-flex items-center justify-center gap-2 px-5"
            >
              {testStatus === "sending" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {testStatus === "sending" ? "Enviando..." : "Enviar teste"}
            </Button>
          </div>
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
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">
                    {ev.eventType ?? "—"}
                  </Badge>
                  <span className="text-xs text-zinc-400 font-mono">{ev.fromNumber ?? "—"}</span>
                  <span className="text-[10px] text-zinc-600 ml-auto">
                    {ev.receivedAt
                      ? new Date(ev.receivedAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
