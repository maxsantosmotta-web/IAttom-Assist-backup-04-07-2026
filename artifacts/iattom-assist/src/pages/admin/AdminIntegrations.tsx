import { motion } from "framer-motion";
import {
  Phone,
  Instagram,
  ShoppingBag,
  ShoppingCart,
  Flame,
  Zap,
  RefreshCw,
  Loader2,
  Clock,
  TrendingUp,
  Wifi,
  WifiOff,
  ShoppingBag as PurchaseIcon,
  CreditCard,
  RotateCcw,
  BadgeX,
  AlertCircle,
  MessageSquare,
  UserCheck,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IntegrationStatusCard,
  type IntegrationStatusItem,
} from "@/components/integrations/IntegrationStatusCard";
import {
  useIntegrationStatus,
  type IntegrationId,
  type IntegrationEvent,
} from "@/hooks/useIntegrationStatus";

// ─── Integration registry ─────────────────────────────────────────────────────

interface IntegrationMeta {
  id: IntegrationId;
  icon: LucideIcon;
  iconColor: string;
  href: string;
  description: string;
}

const INTEGRATIONS: IntegrationMeta[] = [
  { id: "whatsapp", icon: Phone, iconColor: "text-emerald-400", href: "/admin/whatsapp", description: "WhatsApp Cloud API — mensagens e automações" },
  { id: "meta", icon: Instagram, iconColor: "text-pink-400", href: "/admin/meta", description: "Instagram Business + Facebook Pages" },
  { id: "shopee", icon: ShoppingBag, iconColor: "text-orange-400", href: "/admin/shopee", description: "Shopee Open Platform — produtos e pedidos" },
  { id: "ml", icon: ShoppingCart, iconColor: "text-yellow-400", href: "/admin/mercado-livre", description: "Mercado Livre API — anúncios e pedidos" },
  { id: "hotmart", icon: Flame, iconColor: "text-red-400", href: "/admin/hotmart", description: "Hotmart — produtos digitais e assinaturas" },
  { id: "kiwify", icon: Zap, iconColor: "text-violet-400", href: "/admin/kiwify", description: "Kiwify — produtos digitais e checkout" },
];

// ─── Event display helpers ────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<IntegrationId, string> = {
  whatsapp: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  meta: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  shopee: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  ml: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  hotmart: "bg-red-500/15 text-red-400 border-red-500/30",
  kiwify: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

const PURCHASE_EVENT_COLORS: Record<string, string> = {
  PURCHASE_APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "order.approved": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PURCHASE_BILLET_PRINTED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "order.waiting_payment": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PURCHASE_REFUNDED: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "order.refunded": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  PURCHASE_CHARGEBACK: "bg-red-500/15 text-red-400 border-red-500/30",
  "order.chargeback": "bg-red-500/15 text-red-400 border-red-500/30",
  PURCHASE_ABANDONED: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  "order.abandoned": "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  SUBSCRIPTION_ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "subscription.active": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  SUBSCRIPTION_CANCELED: "bg-red-500/15 text-red-400 border-red-500/30",
  "subscription.canceled": "bg-red-500/15 text-red-400 border-red-500/30",
};

const EVENT_LABELS: Record<string, string> = {
  PURCHASE_APPROVED: "Compra Aprovada",
  "order.approved": "Compra Aprovada",
  PURCHASE_BILLET_PRINTED: "Boleto/Pix",
  "order.waiting_payment": "Aguardando",
  PURCHASE_REFUNDED: "Reembolso",
  "order.refunded": "Reembolso",
  PURCHASE_CHARGEBACK: "Chargeback",
  "order.chargeback": "Chargeback",
  PURCHASE_CANCELED: "Cancelado",
  "order.canceled": "Cancelado",
  PURCHASE_ABANDONED: "Abandono",
  "order.abandoned": "Abandono",
  SUBSCRIPTION_ACTIVE: "Assinatura",
  "subscription.active": "Assinatura",
  SUBSCRIPTION_CANCELED: "Assin. Cancelada",
  "subscription.canceled": "Assin. Cancelada",
  message: "Mensagem",
  messages: "Mensagem",
  comments: "Comentário",
  notification: "Notificação",
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  PURCHASE_APPROVED: <PurchaseIcon className="w-2.5 h-2.5" />,
  "order.approved": <PurchaseIcon className="w-2.5 h-2.5" />,
  PURCHASE_BILLET_PRINTED: <CreditCard className="w-2.5 h-2.5" />,
  "order.waiting_payment": <CreditCard className="w-2.5 h-2.5" />,
  PURCHASE_REFUNDED: <RotateCcw className="w-2.5 h-2.5" />,
  "order.refunded": <RotateCcw className="w-2.5 h-2.5" />,
  PURCHASE_CHARGEBACK: <BadgeX className="w-2.5 h-2.5" />,
  "order.chargeback": <BadgeX className="w-2.5 h-2.5" />,
  PURCHASE_ABANDONED: <AlertCircle className="w-2.5 h-2.5" />,
  "order.abandoned": <AlertCircle className="w-2.5 h-2.5" />,
  SUBSCRIPTION_ACTIVE: <UserCheck className="w-2.5 h-2.5" />,
  "subscription.active": <UserCheck className="w-2.5 h-2.5" />,
  message: <MessageSquare className="w-2.5 h-2.5" />,
  notification: <Globe className="w-2.5 h-2.5" />,
};

function eventLabel(type: string) {
  return EVENT_LABELS[type] ?? type;
}
function eventColor(type: string) {
  return PURCHASE_EVENT_COLORS[type] ?? "bg-zinc-700/40 text-zinc-400 border-zinc-600/30";
}
function eventIcon(type: string) {
  return EVENT_ICONS[type] ?? null;
}

// ─── Event row ────────────────────────────────────────────────────────────────

function GlobalEventRow({ ev }: { ev: IntegrationEvent }) {
  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "—";

  return (
    <div className="flex items-center gap-2.5 bg-white/2 border border-white/5 rounded-lg px-3 py-2 hover:bg-white/3 transition-colors">
      <Badge className={`text-[9px] shrink-0 font-medium ${PLATFORM_COLORS[ev.platform]}`}>
        {ev.platformLabel}
      </Badge>
      <Badge className={`flex items-center gap-1 text-[9px] shrink-0 ${eventColor(ev.eventType)}`}>
        {eventIcon(ev.eventType)}
        {eventLabel(ev.eventType)}
      </Badge>
      <span className="text-xs text-zinc-400 truncate flex-1 min-w-0">
        {ev.primaryText || ev.secondaryText || "—"}
      </span>
      {ev.value && (
        <span className="text-xs text-zinc-500 shrink-0">
          R$ {ev.value}
        </span>
      )}
      <span className="text-[10px] text-zinc-700 shrink-0 tabular-nums">
        {formatDate(ev.receivedAt)}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminIntegrations() {
  const { statuses, events, loading, eventsLoading, refetch, refetchEvents, connectedCount, configuredCount } =
    useIntegrationStatus();

  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s])) as Record<
    IntegrationId,
    IntegrationStatusItem | undefined
  >;

  const getStatus = (id: IntegrationId): IntegrationStatusItem =>
    statusMap[id] ?? { id, label: INTEGRATIONS.find((i) => i.id === id)?.id ?? id, configured: false, isActive: false };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Wifi className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-white">Integrações</h1>
            {!loading && (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                  {connectedCount} ativas
                </Badge>
                <Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-600/30 text-[10px]">
                  {6 - configuredCount} pendentes
                </Badge>
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { refetch(); refetchEvents(); }}
            className="h-7 px-2.5 text-zinc-500 hover:text-white gap-1.5 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar
          </Button>
        </div>
        <p className="text-sm text-zinc-500 ml-8">
          Visão consolidada de todas as integrações e feed global de eventos.
        </p>
      </motion.div>

      {/* ─── STATUS SUMMARY ─────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Ativas", value: connectedCount, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Configuradas", value: configuredCount, color: "text-primary", bg: "bg-primary/10" },
            { label: "Com erro", value: statuses.filter((s) => s.tokenExpired).length, color: "text-red-400", bg: "bg-red-500/10" },
            { label: "Eventos (total)", value: events.length, color: "text-zinc-300", bg: "bg-white/5" },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} border border-white/8 rounded-xl px-4 py-3 text-center`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── STATUS GRID ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Status das integrações
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando status...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INTEGRATIONS.map((integration) => (
              <IntegrationStatusCard
                key={integration.id}
                status={getStatus(integration.id)}
                icon={integration.icon}
                iconColor={integration.iconColor}
                href={integration.href}
                description={integration.description}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── HEALTH LEGEND ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-600">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Conectado e ativo
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          Configurado mas inativo
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          Token expirado — requer reautenticação
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-zinc-600" />
          Não configurado
        </div>
      </div>

      {/* ─── GLOBAL EVENT FEED ──────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary/70" />
              Feed Global de Eventos
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">
                {events.length}
              </Badge>
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={refetchEvents}
              disabled={eventsLoading}
              className="h-7 px-2 text-zinc-500 hover:text-white gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${eventsLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
          <p className="text-[11px] text-zinc-600">
            Últimos 50 eventos de todas as integrações, unificados e ordenados por data.
          </p>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando eventos...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum evento recebido ainda.</p>
              <p className="text-xs text-zinc-700 mt-1">
                Configure os webhooks em cada integração para ver os eventos aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {events.map((ev, idx) => (
                <GlobalEventRow key={`${ev.platform}-${ev.eventType}-${idx}`} ev={ev} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── WEBHOOK CHECKLIST ──────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-primary/70" />
            Checklist de Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {INTEGRATIONS.map((integration) => {
              const s = getStatus(integration.id);
              const Icon = integration.icon;
              return (
                <div
                  key={integration.id}
                  className="flex items-center gap-3 bg-white/2 border border-white/5 rounded-lg px-3 py-2.5"
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${integration.iconColor}`} />
                  <span className="text-xs text-zinc-300 flex-1">{integration.description}</span>
                  <Badge
                    className={`text-[9px] shrink-0 ${
                      s.isActive && !s.tokenExpired
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : s.configured
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-zinc-700/40 text-zinc-600 border-zinc-700"
                    }`}
                  >
                    {s.isActive && !s.tokenExpired ? "Webhook ativo" : s.configured ? "Configurado" : "Pendente"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
