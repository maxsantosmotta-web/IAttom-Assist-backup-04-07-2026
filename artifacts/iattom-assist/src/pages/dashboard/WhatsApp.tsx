import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle, Loader2, X, Info, Webhook, ClipboardList,
  RefreshCw, BarChart2, Zap, CheckCircle2, AlertCircle,
  Link2, Send, Bot, Bell, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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

function InformativeModal({
  title,
  description,
  onClose,
  action,
}: {
  title: string;
  description: string;
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Info className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <div className="flex gap-2">
          {action && (
            <Button onClick={() => { action.onClick(); onClose(); }}
              className="flex-1 bg-primary text-black hover:bg-primary/90 font-semibold">
              {action.label}
            </Button>
          )}
          <Button onClick={onClose}
            variant={action ? "outline" : "default"}
            className={action
              ? "border-white/10 text-muted-foreground hover:text-white"
              : "w-full bg-primary text-black hover:bg-primary/90 font-semibold"}>
            {action ? "Fechar" : "Entendido"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

interface WhatsAppEvent {
  id: number;
  eventType: string | null;
  fromNumber: string | null;
  receivedAt: string | null;
}

const FUTURE_AUTOMATIONS = [
  { icon: Send, label: "Boas-vindas automáticas", desc: "Mensagem de boas-vindas ao novo contato" },
  { icon: Bell, label: "Alertas de pedido", desc: "Notificações automáticas de status de compra" },
  { icon: Bot, label: "Chatbot de atendimento", desc: "Respostas automáticas com IA para dúvidas frequentes" },
  { icon: TrendingUp, label: "Campanha em massa", desc: "Disparo segmentado para lista de contatos" },
  { icon: RefreshCw, label: "Follow-up automático", desc: "Sequência de acompanhamento pós-venda" },
  { icon: Zap, label: "Integração com fluxo de vendas", desc: "Automação conectada ao CRM e Hotmart/Kiwify" },
];

export function WhatsApp() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [events, setEvents] = useState<WhatsAppEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [modal, setModal] = useState<{
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);

  const webhookEndpoint = `${window.location.origin}${BASE}/api/whatsapp/webhook`;

  const showInfo = (
    title: string,
    description: string,
    action?: { label: string; onClick: () => void },
  ) => setModal({ title, description, action });

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const data = await apiFetch<WhatsAppEvent[]>("/api/whatsapp/events");
      setEvents(data);
    } catch {
      // non-critical
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const handleConnect = async () => {
    setConnecting(true);
    await new Promise((r) => setTimeout(r, 800));
    setConnecting(false);
    showInfo(
      "Conectar WhatsApp Cloud API",
      "Para ativar o WhatsApp, você precisa de uma conta Meta Business verificada. Acesse developers.facebook.com → WhatsApp → Primeiros Passos. Obtenha o Business Account ID, Phone Number ID e o Access Token permanente. O administrador da plataforma configura as credenciais no painel ADM. Esta função está preparada para próxima etapa.",
    );
  };

  const handleCreateAutomation = () => {
    showInfo(
      "Criar Automação WhatsApp",
      "As automações WhatsApp permitem enviar mensagens automáticas baseadas em gatilhos (nova compra, abandono de carrinho, etc.). Esta funcionalidade está em desenvolvimento e será ativada em breve. Você poderá criar fluxos completos de automação com IA.",
    );
  };

  const handleCreateCampaign = () => {
    sessionStorage.setItem(
      "iattom_campaign_prefill",
      JSON.stringify({ channel: "whatsapp" }),
    );
    navigate("/dashboard/create-campaign");
    toast({ description: "Abrindo criação de campanha WhatsApp." });
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    toast({ description: "URL do webhook copiada." });
  };

  const handleCheckWebhook = () => {
    showInfo(
      "Status do Webhook",
      "O webhook WhatsApp recebe notificações em tempo real de mensagens, status de entrega e outros eventos. Configure a URL abaixo no painel Meta Developers → WhatsApp → Configuration → Webhook. O token de verificação é definido pelo administrador.",
    );
  };

  return (
    <div className="space-y-6">
      {modal && (
        <InformativeModal
          title={modal.title}
          description={modal.description}
          action={modal.action}
          onClose={() => setModal(null)}
        />
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">WhatsApp</h1>
              <p className="text-xs text-muted-foreground">Cloud API, automações e campanhas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline"
              onClick={handleCreateAutomation}
              className="border-white/10 text-muted-foreground hover:text-white">
              <Bot className="w-3.5 h-3.5 mr-2" />
              Criar Automação
            </Button>
            <Button size="sm"
              onClick={handleCreateCampaign}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
              <ClipboardList className="w-3.5 h-3.5 mr-2" />
              Criar Campanha WhatsApp
            </Button>
          </div>
        </div>

        {/* Status Card */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">WhatsApp não conectado</span>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Configure a WhatsApp Cloud API para enviar mensagens, automações e campanhas.
              </p>
              <Button
                size="sm"
                onClick={() => void handleConnect()}
                disabled={connecting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold ml-auto"
              >
                {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Link2 className="w-3.5 h-3.5 mr-2" />}
                Conectar WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { icon: MessageCircle, label: "Mensagens (30d)", value: "0", color: "text-emerald-400" },
            { icon: BarChart2, label: "Eventos", value: String(events.length), color: "text-blue-400" },
            { icon: Bot, label: "Automações", value: "0", color: "text-primary" },
            { icon: CheckCircle2, label: "Webhook", value: "Aguardando", color: "text-yellow-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="bg-[#111111] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <p className="text-xl font-bold text-white">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Webhook Section */}
        <Card className="bg-[#111111] border-white/[0.06] mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Webhook className="w-4 h-4 text-muted-foreground" />
                Endpoint do Webhook
              </CardTitle>
              <Button size="sm" variant="ghost"
                onClick={handleCheckWebhook}
                className="text-muted-foreground hover:text-white h-7 px-2 text-xs">
                Como configurar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2.5 text-xs text-zinc-300 font-mono break-all">
                {webhookEndpoint}
              </code>
              <Button size="sm" variant="outline"
                onClick={handleCopyWebhook}
                className="border-white/10 text-muted-foreground hover:text-white shrink-0">
                Copiar
              </Button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-950/20 border border-yellow-500/20">
              <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
              <p className="text-xs text-yellow-300/80 leading-relaxed">
                Configure esta URL no Meta Developers → WhatsApp → Configuration → Webhook URL. O token de verificação é definido pelo administrador.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Future Automations */}
        <Card className="bg-[#111111] border-white/[0.06] mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-muted-foreground" />
                Automações
                <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]">Em breve</Badge>
              </CardTitle>
              <Button size="sm"
                onClick={handleCreateAutomation}
                className="bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold text-xs h-7">
                <Bot className="w-3 h-3 mr-1.5" />
                Nova Automação
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {FUTURE_AUTOMATIONS.map(({ icon: Icon, label, desc }) => (
                <button
                  key={label}
                  onClick={handleCreateAutomation}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <Badge className="ml-auto shrink-0 bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[9px]">Em breve</Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Events / Logs */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                Eventos Recentes
                {events.length > 0 && (
                  <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">{events.length}</Badge>
                )}
              </CardTitle>
              <Button size="sm" variant="ghost"
                onClick={() => void loadEvents()}
                disabled={loadingEvents}
                className="text-muted-foreground hover:text-white h-7 px-2">
                {loadingEvents ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageCircle className="w-8 h-8 text-white/10 mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">Nenhum evento registrado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Configure o webhook WhatsApp para receber notificações de mensagens.
                </p>
                <Button size="sm"
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                  className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs">
                  Conectar para ativar eventos
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 10).map((ev) => (
                  <div key={ev.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-white/5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{ev.eventType ?? "—"}</p>
                      {ev.fromNumber && (
                        <p className="text-[10px] text-muted-foreground font-mono">{ev.fromNumber}</p>
                      )}
                    </div>
                    {ev.receivedAt && (
                      <span className="text-xs text-muted-foreground/60 shrink-0">
                        {new Date(ev.receivedAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
