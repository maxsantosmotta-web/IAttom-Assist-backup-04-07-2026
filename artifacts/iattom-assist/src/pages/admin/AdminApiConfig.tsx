import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Settings2, Save, Trash2, CheckCircle2,
  Loader2, Eye, EyeOff, ShoppingBag, ShoppingCart, Flame,
  Zap, Instagram, Video, Copy, ExternalLink, Info,
  Shield, RefreshCw, TrendingUp, Clock, Wifi, AlertTriangle,
} from "lucide-react";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIntegrationStatus, type IntegrationId, type IntegrationEvent } from "@/hooks/useIntegrationStatus";

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

/* ─── Types ─────────────────────────────────────────────────── */
type IntegrationKey = "shopee" | "ml" | "hotmart" | "kiwify" | "instagram" | "facebook" | "tiktok";

function toApiKey(tab: IntegrationKey): string {
  if (tab === "instagram" || tab === "facebook") return "meta";
  return tab;
}

interface AllConfigs {
  shopee:   { configured: boolean; isActive: boolean; partnerId: string; partnerKey: string; redirectUrl: string; environment: string; updatedAt: string | null };
  ml:       { configured: boolean; isActive: boolean; appId: string; clientSecret: string; redirectUri: string; siteId: string; updatedAt: string | null };
  hotmart:  { configured: boolean; isActive: boolean; clientId: string; clientSecret: string; basicToken: string; webhookToken: string; environment: string; updatedAt: string | null };
  kiwify:   { configured: boolean; isActive: boolean; storeId: string; clientId: string; clientSecret: string; webhookSecret: string; updatedAt: string | null };
  meta:     { configured: boolean; isActive: boolean; appId: string; appSecret: string; verifyToken: string; userAccessToken: string; webhookUrl: string; updatedAt: string | null };
  tiktok:   { configured: boolean; isActive: boolean; clientKey: string; clientSecret: string; redirectUri: string; environment: string; updatedAt: string | null };
}

/* ─── SecretInput ────────────────────────────────────────────── */
function SecretInput({ label, name, value, onChange, placeholder, hint }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "••••••••"}
          className="bg-[#0a0a0a] border-white/10 text-white pr-8 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/50 mt-1">{hint}</p>}
    </div>
  );
}

function PlainInput({ label, name, value, onChange, placeholder, hint, readOnly }: {
  label: string; name: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; hint?: string; readOnly?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <Input
        name={name}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`bg-[#0a0a0a] border-white/10 text-white ${readOnly ? "opacity-60 cursor-default font-mono text-xs" : ""}`}
      />
      {hint && <p className="text-[10px] text-muted-foreground/50 mt-1">{hint}</p>}
    </div>
  );
}

function CallbackBox({ url, label }: { url: string; label: string }) {
  const { toast } = useToast();
  return (
    <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
      <p className="text-[10px] text-primary uppercase tracking-widest font-medium mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="text-xs text-primary/80 font-mono flex-1 break-all leading-relaxed">{url}</code>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary shrink-0"
          onClick={() => { void navigator.clipboard.writeText(url); toast({ description: "URL copiada." }); }}>
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function EnvSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="flex gap-2">
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-all ${
              value === opt.value
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-white/3 text-muted-foreground border-white/10 hover:border-white/20"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── FormActions ────────────────────────────────────────────── */
function FormActions({ onSave, onTest, onClear, saving, testing, externalLink }: {
  onSave: () => void; onTest: () => void; onClear: () => void;
  saving: boolean; testing: boolean;
  externalLink?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
      <Button onClick={onSave} disabled={saving || testing}
        className="bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5 h-8 text-xs">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Salvar credenciais
      </Button>
      <Button onClick={onTest} disabled={saving || testing} variant="outline"
        className="border-white/10 text-muted-foreground hover:text-white gap-1.5 h-8 text-xs">
        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        Testar configuração
      </Button>
      <Button onClick={onClear} disabled={saving || testing} variant="ghost"
        className="text-red-400/70 hover:text-red-400 gap-1.5 h-8 text-xs">
        <Trash2 className="w-3.5 h-3.5" /> Limpar
      </Button>
      {externalLink && (
        <Button type="button" variant="ghost"
          onClick={() => window.open(externalLink.href, "_blank", "noopener,noreferrer")}
          className="text-muted-foreground hover:text-white gap-1.5 h-8 text-xs ml-auto">
          <ExternalLink className="w-3.5 h-3.5" />
          {externalLink.label}
        </Button>
      )}
    </div>
  );
}

/* ─── Tab meta ───────────────────────────────────────────────── */
const TABS: Array<{ id: IntegrationKey; label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { id: "shopee",    label: "Shopee",        icon: ShoppingBag,   color: "text-orange-400" },
  { id: "ml",        label: "Mercado Livre", icon: ShoppingCart,  color: "text-amber-400"  },
  { id: "hotmart",   label: "Hotmart",       icon: Flame,         color: "text-red-400"    },
  { id: "kiwify",    label: "Kiwify",        icon: Zap,           color: "text-violet-400" },
  { id: "instagram", label: "Instagram",     icon: Instagram,     color: "text-pink-400"   },
  { id: "facebook",  label: "Facebook",      icon: FacebookIcon,  color: "text-blue-400"   },
  { id: "tiktok",    label: "TikTok",        icon: Video,         color: "text-cyan-400"   },
];

/* ─── Checklist ──────────────────────────────────────────────── */
const CHECKLIST_ITEMS: Array<{ id: IntegrationId; icon: React.ComponentType<{ className?: string }>; iconColor: string; label: string }> = [
  { id: "meta",    icon: Instagram,    iconColor: "text-pink-400",   label: "Instagram Business — mensagens e insights"     },
  { id: "meta",    icon: FacebookIcon, iconColor: "text-blue-400",   label: "Facebook Pages — publicações e eventos"        },
  { id: "shopee",  icon: ShoppingBag,  iconColor: "text-orange-400", label: "Shopee Open Platform — produtos e pedidos"     },
  { id: "ml",      icon: ShoppingCart, iconColor: "text-amber-400",  label: "Mercado Livre API — anúncios e pedidos"        },
  { id: "hotmart", icon: Flame,        iconColor: "text-red-400",    label: "Hotmart — produtos digitais e assinaturas"     },
  { id: "kiwify",  icon: Zap,          iconColor: "text-violet-400", label: "Kiwify — produtos digitais e checkout"         },
];

/* TikTok is per-user OAuth (not a platform webhook) — handled separately in render */

/* ─── Event feed helpers ─────────────────────────────────────── */
const PLATFORM_COLORS: Record<string, string> = {
  meta:      "bg-pink-500/15 text-pink-400 border-pink-500/30",
  instagram: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  facebook:  "bg-blue-500/15 text-blue-400 border-blue-500/30",
  shopee:    "bg-orange-500/15 text-orange-400 border-orange-500/30",
  ml:        "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  hotmart:   "bg-red-500/15 text-red-400 border-red-500/30",
  kiwify:    "bg-violet-500/15 text-violet-400 border-violet-500/30",
  tiktok:    "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const EVENT_LABELS: Record<string, string> = {
  PURCHASE_APPROVED:       "Compra Aprovada",
  "order.approved":        "Compra Aprovada",
  PURCHASE_BILLET_PRINTED: "Boleto/Pix",
  "order.waiting_payment": "Aguardando",
  PURCHASE_REFUNDED:       "Reembolso",
  "order.refunded":        "Reembolso",
  PURCHASE_CHARGEBACK:     "Chargeback",
  "order.chargeback":      "Chargeback",
  PURCHASE_CANCELED:       "Cancelado",
  "order.canceled":        "Cancelado",
  PURCHASE_ABANDONED:      "Abandono",
  "order.abandoned":       "Abandono",
  SUBSCRIPTION_ACTIVE:     "Assinatura",
  "subscription.active":   "Assinatura",
  SUBSCRIPTION_CANCELED:   "Assin. cancelada",
  "subscription.canceled": "Assin. cancelada",
  message:                 "Mensagem",
  messages:                "Mensagem",
  notification:            "Notificação",
};

const EVENT_COLORS: Record<string, string> = {
  PURCHASE_APPROVED:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "order.approved":     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PURCHASE_BILLET_PRINTED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PURCHASE_REFUNDED:    "bg-orange-500/15 text-orange-400 border-orange-500/30",
  PURCHASE_CHARGEBACK:  "bg-red-500/15 text-red-400 border-red-500/30",
  PURCHASE_ABANDONED:   "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  SUBSCRIPTION_ACTIVE:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function GlobalEventRow({ ev }: { ev: IntegrationEvent }) {
  const date = ev.receivedAt
    ? new Date(ev.receivedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";
  return (
    <div className="flex flex-col gap-1 bg-white/2 border border-white/5 rounded-lg px-3 py-2 hover:bg-white/3 transition-colors">
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <Badge className={`text-[9px] font-medium ${PLATFORM_COLORS[ev.platform] ?? "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"}`}>
          {ev.platformLabel}
        </Badge>
        <Badge className={`text-[9px] ${EVENT_COLORS[ev.eventType] ?? "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"}`}>
          {EVENT_LABELS[ev.eventType] ?? ev.eventType}
        </Badge>
        <span className="text-xs text-zinc-400 truncate min-w-0 flex-1">
          {ev.primaryText || ev.secondaryText || "—"}
        </span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        {ev.value && <span className="text-xs text-zinc-500">R$ {ev.value}</span>}
        <span className="text-[10px] text-zinc-700 tabular-nums ml-auto">{date}</span>
      </div>
    </div>
  );
}

/* ─── AdminApiConfig ─────────────────────────────────────────── */
export function AdminApiConfig() {
  const { toast } = useToast();

  const origin = window.location.origin;

  const { statuses, events: intEvents, eventsLoading, refetchEvents } = useIntegrationStatus();

  const [activeTab, setActiveTab] = useState<IntegrationKey>("shopee");
  const [configs, setConfigs] = useState<AllConfigs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [shopeeForm,   setShopeeForm]   = useState({ partnerId: "", partnerKey: "", redirectUrl: `${origin}${BASE}/api/shopee/oauth/callback`, environment: "production" });
  const [mlForm,       setMlForm]       = useState({ appId: "", clientSecret: "", redirectUri: `${origin}${BASE}/api/ml/oauth-callback`, siteId: "MLB" });
  const [hotmartForm,  setHotmartForm]  = useState({ clientId: "", clientSecret: "", basicToken: "", webhookToken: "", environment: "sandbox" });
  const [kiwifyForm,   setKiwifyForm]   = useState({ storeId: "", clientId: "", clientSecret: "", webhookSecret: "" });
  const [metaForm,     setMetaForm]     = useState({ appId: "", appSecret: "", verifyToken: "", userAccessToken: "", webhookUrl: `${origin}${BASE}/api/meta/webhook` });
  const [tiktokForm,   setTiktokForm]   = useState({ clientKey: "", clientSecret: "", redirectUri: `${origin}${BASE}/api/tiktok/oauth/callback`, environment: "sandbox" });

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AllConfigs>("/api/admin/integrations/config");
      setConfigs(data);
      setShopeeForm(f   => ({ ...f, partnerId: data.shopee.partnerId,   partnerKey: data.shopee.partnerKey,   redirectUrl: data.shopee.redirectUrl || f.redirectUrl }));
      setMlForm(f       => ({ ...f, appId: data.ml.appId,               clientSecret: data.ml.clientSecret,   redirectUri: data.ml.redirectUri || f.redirectUri, siteId: data.ml.siteId || "MLB" }));
      setHotmartForm(f  => ({ ...f, clientId: data.hotmart.clientId,    clientSecret: data.hotmart.clientSecret, basicToken: data.hotmart.basicToken, webhookToken: data.hotmart.webhookToken, environment: data.hotmart.environment || "sandbox" }));
      setKiwifyForm(f   => ({ ...f, storeId: data.kiwify.storeId,       clientId: data.kiwify.clientId,       clientSecret: data.kiwify.clientSecret, webhookSecret: data.kiwify.webhookSecret }));
      setMetaForm(f     => ({ ...f, appId: data.meta.appId,             appSecret: data.meta.appSecret,       verifyToken: data.meta.verifyToken, userAccessToken: data.meta.userAccessToken, webhookUrl: data.meta.webhookUrl || f.webhookUrl }));
      setTiktokForm(f   => ({ ...f, clientKey: data.tiktok.clientKey,   clientSecret: data.tiktok.clientSecret, redirectUri: data.tiktok.redirectUri || f.redirectUri, environment: data.tiktok.environment || "sandbox" }));
    } catch {
      toast({ variant: "destructive", description: "Falha ao carregar configurações." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadConfigs(); }, [loadConfigs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integration") as IntegrationKey | null;
    if (integration && TABS.some(t => t.id === integration)) {
      setActiveTab(integration);
    }
  }, []);

  const save = async (integration: IntegrationKey, body: Record<string, string>) => {
    setSaving(true);
    const apiKey = toApiKey(integration);
    try {
      await apiFetch(`/api/admin/integrations/config/${apiKey}`, { method: "POST", body: JSON.stringify(body) });
      toast({ description: `Credenciais ${TABS.find(t => t.id === integration)?.label} salvas com sucesso.` });
      void loadConfigs();
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  const test = async (integration: IntegrationKey) => {
    setTesting(true);
    const apiKey = toApiKey(integration);
    try {
      const data = await apiFetch<{ ok: boolean; message: string }>(`/api/admin/integrations/config/${apiKey}/test`, { method: "POST" });
      toast({ description: data.message, variant: data.ok ? "default" : "destructive" });
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha no teste." });
    } finally {
      setTesting(false);
    }
  };

  const clear = async (integration: IntegrationKey) => {
    setSaving(true);
    const apiKey = toApiKey(integration);
    try {
      await apiFetch(`/api/admin/integrations/config/${apiKey}`, { method: "DELETE" });
      toast({ description: `Credenciais ${TABS.find(t => t.id === integration)?.label} removidas.` });
      void loadConfigs();
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha ao limpar." });
    } finally {
      setSaving(false);
    }
  };

  const tabDot = (id: IntegrationKey): string => {
    const apiKey = toApiKey(id) as keyof AllConfigs;
    const cfg = configs?.[apiKey];
    if (!cfg?.configured) return "bg-zinc-600";
    if (apiKey === "tiktok") {
      return cfg.isActive ? "bg-emerald-400" : "bg-amber-400";
    }
    const stId = (id === "instagram" || id === "facebook") ? "meta" : id;
    const st = statuses.find(s => s.id === (stId as IntegrationId));
    if (st?.tokenExpired) return "bg-red-400";
    if (st?.isActive) return "bg-emerald-400";
    return "bg-amber-400";
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Wifi className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-white">Integrações</h1>
              <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-[10px]">ADMIN</Badge>
            </div>
            <p className="text-sm text-muted-foreground ml-7">
              Configuração de APIs e monitoramento de eventos
            </p>
          </div>
          <Button size="sm" variant="ghost"
            onClick={() => { void loadConfigs(); refetchEvents(); }}
            disabled={loading}
            className="h-7 px-2.5 text-muted-foreground hover:text-white gap-1.5 text-xs shrink-0">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Recarregar
          </Button>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-white/3 border border-white/6 mb-4">
          <Shield className="w-3.5 h-3.5 text-primary/60 shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
            Credenciais salvas no banco de dados com mascaramento. Secrets nunca são expostos no painel do usuário.
            Ao editar, deixe um campo inalterado para preservar o valor atual.
          </p>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#111111] border border-white/[0.06] rounded-xl mb-2">
          {TABS.map(({ id, label, icon: Icon, color }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === id ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Icon className={`w-3 h-3 ${color}`} />
              {label}
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tabDot(id)}`} />
            </button>
          ))}
        </div>

        {/* Status legend */}
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-600 mb-4 px-0.5">
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Conectado e ativo</div>
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" />Configurado / inativo</div>
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-400" />Token expirado</div>
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />Não configurado</div>
        </div>

        {/* ── Tab content ──────────────────────────────────────── */}
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Carregando configurações...</span>
            </div>
          ) : (
            <>
              {/* ── SHOPEE ──────────────────────────────────────── */}
              {activeTab === "shopee" && (
                <Card className="bg-[#111111] border-white/[0.06]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-orange-400" />
                      Shopee Open Platform
                      {configs?.shopee.configured && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">Configurado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CallbackBox url={shopeeForm.redirectUrl || `${origin}${BASE}/api/shopee/oauth/callback`} label="Callback URL — cadastre em Shopee Open Platform" />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <PlainInput label="Partner ID" name="partnerId" value={shopeeForm.partnerId}
                        onChange={v => setShopeeForm(f => ({ ...f, partnerId: v }))} placeholder="Ex: 20012345" />
                      <SecretInput label="Partner Key" name="partnerKey" value={shopeeForm.partnerKey}
                        onChange={v => setShopeeForm(f => ({ ...f, partnerKey: v }))} placeholder="Chave secreta do parceiro" />
                    </div>
                    <PlainInput label="Redirect URI / Callback URL" name="redirectUrl" value={shopeeForm.redirectUrl}
                      onChange={v => setShopeeForm(f => ({ ...f, redirectUrl: v }))}
                      hint="Deve ser cadastrada exatamente como está no Shopee Open Platform" />
                    <EnvSelect label="Ambiente" value={shopeeForm.environment} onChange={v => setShopeeForm(f => ({ ...f, environment: v }))}
                      options={[{ value: "sandbox", label: "Sandbox" }, { value: "production", label: "Produção" }]} />
                    <FormActions
                      onSave={() => void save("shopee", shopeeForm)}
                      onTest={() => void test("shopee")}
                      onClear={() => void clear("shopee")}
                      saving={saving} testing={testing}
                      externalLink={{ href: "https://open.shopee.com", label: "Abrir Shopee Open Platform" }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* ── MERCADO LIVRE ────────────────────────────────── */}
              {activeTab === "ml" && (
                <Card className="bg-[#111111] border-white/[0.06]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-amber-400" />
                      Mercado Livre API
                      {configs?.ml.configured && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">Configurado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CallbackBox url={mlForm.redirectUri || `${origin}${BASE}/api/ml/oauth-callback`} label="Redirect URI / Callback — cadastre no Mercado Livre Developers" />
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                      <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-emerald-300/80">Mercado Livre já aparece conectado. Altere credenciais apenas se necessário — isso não reinicia tokens existentes.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <PlainInput label="Client ID (App ID)" name="appId" value={mlForm.appId}
                        onChange={v => setMlForm(f => ({ ...f, appId: v }))} placeholder="Ex: 1234567890" />
                      <SecretInput label="Client Secret" name="clientSecret" value={mlForm.clientSecret}
                        onChange={v => setMlForm(f => ({ ...f, clientSecret: v }))} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <PlainInput label="Redirect URI / Callback URL" name="redirectUri" value={mlForm.redirectUri}
                        onChange={v => setMlForm(f => ({ ...f, redirectUri: v }))} />
                      <PlainInput label="Site ID" name="siteId" value={mlForm.siteId}
                        onChange={v => setMlForm(f => ({ ...f, siteId: v }))} placeholder="MLB" hint="MLB para Brasil" />
                    </div>
                    <FormActions
                      onSave={() => void save("ml", mlForm)}
                      onTest={() => void test("ml")}
                      onClear={() => void clear("ml")}
                      saving={saving} testing={testing}
                      externalLink={{ href: "https://developers.mercadolivre.com.br", label: "Abrir Mercado Livre Developers" }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* ── HOTMART ──────────────────────────────────────── */}
              {activeTab === "hotmart" && (
                <Card className="bg-[#111111] border-white/[0.06]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-red-400" />
                      Hotmart
                      {configs?.hotmart.configured && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">Configurado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CallbackBox url={`${origin}${BASE}/api/hotmart/webhook`} label="Webhook URL — cadastre no Hotmart Club" />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <PlainInput label="Client ID" name="clientId" value={hotmartForm.clientId}
                        onChange={v => setHotmartForm(f => ({ ...f, clientId: v }))} placeholder="Ex: a1b2c3d4-e5f6-..." />
                      <SecretInput label="Client Secret" name="clientSecret" value={hotmartForm.clientSecret}
                        onChange={v => setHotmartForm(f => ({ ...f, clientSecret: v }))} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <SecretInput label="Basic Token" name="basicToken" value={hotmartForm.basicToken}
                        onChange={v => setHotmartForm(f => ({ ...f, basicToken: v }))}
                        hint="Base64 de client_id:client_secret" />
                      <SecretInput label="Webhook Secret (Hottok)" name="webhookToken" value={hotmartForm.webhookToken}
                        onChange={v => setHotmartForm(f => ({ ...f, webhookToken: v }))} />
                    </div>
                    <EnvSelect label="Ambiente" value={hotmartForm.environment} onChange={v => setHotmartForm(f => ({ ...f, environment: v }))}
                      options={[{ value: "sandbox", label: "Sandbox" }, { value: "production", label: "Produção" }]} />
                    <FormActions
                      onSave={() => void save("hotmart", hotmartForm)}
                      onTest={() => void test("hotmart")}
                      onClear={() => void clear("hotmart")}
                      saving={saving} testing={testing}
                      externalLink={{ href: "https://developers.hotmart.com", label: "Abrir Hotmart Developers" }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* ── KIWIFY ───────────────────────────────────────── */}
              {activeTab === "kiwify" && (
                <Card className="bg-[#111111] border-white/[0.06]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-400" />
                      Kiwify
                      {configs?.kiwify.configured && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">Configurado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CallbackBox url={`${origin}${BASE}/api/kiwify/webhook`} label="Webhook URL — cadastre no painel Kiwify" />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <PlainInput label="Store ID" name="storeId" value={kiwifyForm.storeId}
                        onChange={v => setKiwifyForm(f => ({ ...f, storeId: v }))} placeholder="Ex: store_abc123" />
                      <PlainInput label="Client ID / API Key" name="clientId" value={kiwifyForm.clientId}
                        onChange={v => setKiwifyForm(f => ({ ...f, clientId: v }))} placeholder="Ex: kw_..." />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <SecretInput label="Client Secret / Token" name="clientSecret" value={kiwifyForm.clientSecret}
                        onChange={v => setKiwifyForm(f => ({ ...f, clientSecret: v }))} />
                      <SecretInput label="Webhook Secret" name="webhookSecret" value={kiwifyForm.webhookSecret}
                        onChange={v => setKiwifyForm(f => ({ ...f, webhookSecret: v }))} />
                    </div>
                    <FormActions
                      onSave={() => void save("kiwify", kiwifyForm)}
                      onTest={() => void test("kiwify")}
                      onClear={() => void clear("kiwify")}
                      saving={saving} testing={testing}
                      externalLink={{ href: "https://dashboard.kiwify.com.br", label: "Abrir Kiwify" }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* ── INSTAGRAM ────────────────────────────────────── */}
              {activeTab === "instagram" && (
                <Card className="bg-[#111111] border-white/[0.06]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-pink-400" />
                      Instagram
                      {configs?.meta.configured && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">Configurado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CallbackBox url={`${origin}${BASE}/api/meta/oauth/callback`} label="Callback OAuth — cadastre no Meta Developers" />
                    <CallbackBox url={metaForm.webhookUrl} label="Webhook URL — configure no Meta Developers" />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <PlainInput label="Meta App ID" name="appId" value={metaForm.appId}
                        onChange={v => setMetaForm(f => ({ ...f, appId: v }))} placeholder="Ex: 1234567890123456" />
                      <SecretInput label="App Secret" name="appSecret" value={metaForm.appSecret}
                        onChange={v => setMetaForm(f => ({ ...f, appSecret: v }))} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <SecretInput label="Verify Token (webhook)" name="verifyToken" value={metaForm.verifyToken}
                        onChange={v => setMetaForm(f => ({ ...f, verifyToken: v }))}
                        hint="Token criado por você para validação do webhook" />
                      <SecretInput label="User Access Token" name="userAccessToken" value={metaForm.userAccessToken}
                        onChange={v => setMetaForm(f => ({ ...f, userAccessToken: v }))}
                        hint="Token de longa duração da conta Instagram conectada" />
                    </div>
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-pink-500/5 border border-pink-500/15">
                      <Info className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-pink-300/80">Credenciais do App Meta para Instagram Business — mensagens diretas, comentários e insights. As mesmas credenciais são usadas pelo módulo Facebook.</p>
                    </div>
                    <FormActions
                      onSave={() => void save("instagram", metaForm)}
                      onTest={() => void test("instagram")}
                      onClear={() => void clear("instagram")}
                      saving={saving} testing={testing}
                      externalLink={{ href: "https://developers.facebook.com", label: "Abrir Meta Developers" }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* ── FACEBOOK ─────────────────────────────────────── */}
              {activeTab === "facebook" && (
                <Card className="bg-[#111111] border-white/[0.06]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <FacebookIcon className="w-4 h-4 text-blue-400" />
                      Facebook
                      {configs?.meta.configured && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">Configurado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CallbackBox url={`${origin}${BASE}/api/meta/oauth/callback`} label="Callback OAuth — cadastre no Meta Developers" />
                    <CallbackBox url={metaForm.webhookUrl} label="Webhook URL — configure no Meta Developers" />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <PlainInput label="Meta App ID" name="appId" value={metaForm.appId}
                        onChange={v => setMetaForm(f => ({ ...f, appId: v }))} placeholder="Ex: 1234567890123456" />
                      <SecretInput label="App Secret" name="appSecret" value={metaForm.appSecret}
                        onChange={v => setMetaForm(f => ({ ...f, appSecret: v }))} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <SecretInput label="Verify Token (webhook)" name="verifyToken" value={metaForm.verifyToken}
                        onChange={v => setMetaForm(f => ({ ...f, verifyToken: v }))}
                        hint="Token criado por você para validação do webhook" />
                      <SecretInput label="User Access Token" name="userAccessToken" value={metaForm.userAccessToken}
                        onChange={v => setMetaForm(f => ({ ...f, userAccessToken: v }))}
                        hint="Token de longa duração da Page Facebook conectada" />
                    </div>
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-blue-300/80">Credenciais do App Meta para Facebook Pages — publicações, comentários e eventos. As mesmas credenciais são usadas pelo módulo Instagram.</p>
                    </div>
                    <FormActions
                      onSave={() => void save("facebook", metaForm)}
                      onTest={() => void test("facebook")}
                      onClear={() => void clear("facebook")}
                      saving={saving} testing={testing}
                      externalLink={{ href: "https://developers.facebook.com", label: "Abrir Meta Developers" }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* ── TIKTOK ───────────────────────────────────────── */}
              {activeTab === "tiktok" && (
                <Card className="bg-[#111111] border-white/[0.06]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-cyan-400" />
                      TikTok for Developers
                      {configs?.tiktok.configured && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">Configurado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300/80 leading-relaxed">
                        O <strong className="text-amber-300">Redirect URI</strong> abaixo deve ser{" "}
                        <strong className="text-amber-300">idêntico</strong> ao cadastrado no TikTok for Developers.
                        Se você acessou este painel em ambiente de desenvolvimento (.replit.dev), ajuste o campo para o domínio de produção (.replit.app) antes de salvar.
                      </p>
                    </div>
                    <CallbackBox url={tiktokForm.redirectUri || `${origin}${BASE}/api/tiktok/oauth/callback`} label="Callback URL — cadastre no TikTok for Developers" />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <PlainInput label="Client Key" name="clientKey" value={tiktokForm.clientKey}
                        onChange={v => setTiktokForm(f => ({ ...f, clientKey: v }))} placeholder="Ex: awexxxxxxxxxxx" />
                      <SecretInput label="Client Secret" name="clientSecret" value={tiktokForm.clientSecret}
                        onChange={v => setTiktokForm(f => ({ ...f, clientSecret: v }))} />
                    </div>
                    <PlainInput label="Redirect URI / Callback URL" name="redirectUri" value={tiktokForm.redirectUri}
                      onChange={v => setTiktokForm(f => ({ ...f, redirectUri: v }))} />
                    <EnvSelect label="Ambiente" value={tiktokForm.environment} onChange={v => setTiktokForm(f => ({ ...f, environment: v }))}
                      options={[{ value: "sandbox", label: "Sandbox" }, { value: "production", label: "Produção" }]} />
                    <FormActions
                      onSave={() => void save("tiktok", tiktokForm)}
                      onTest={() => void test("tiktok")}
                      onClear={() => void clear("tiktok")}
                      saving={saving} testing={testing}
                      externalLink={{ href: "https://developers.tiktok.com", label: "Abrir TikTok Developers" }}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* ── Feed Global de Eventos ───────────────────────────── */}
        <Card className="bg-white/3 border-white/8">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary/70" />
                Feed Global de Eventos
                <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">
                  {intEvents.length}
                </Badge>
              </CardTitle>
              <Button size="sm" variant="ghost"
                onClick={refetchEvents}
                disabled={eventsLoading}
                className="h-7 px-2 text-zinc-500 hover:text-white gap-1.5 text-xs">
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
            ) : intEvents.length === 0 ? (
              <div className="text-center py-12 text-zinc-600">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nenhum evento recebido ainda.</p>
                <p className="text-xs text-zinc-700 mt-1">
                  Configure os webhooks em cada integração para ver os eventos aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {intEvents.map((ev, idx) => (
                  <GlobalEventRow key={`${ev.platform}-${ev.eventType}-${idx}`} ev={ev} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Checklist de Webhooks ────────────────────────────── */}
        <Card className="bg-white/3 border-white/8">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary/70" />
              Checklist de Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map((item) => {
                const s = statuses.find(st => st.id === item.id);
                const Icon = item.icon;
                const isActive  = s?.isActive && !s?.tokenExpired;
                const isExpired = s?.tokenExpired;
                const isConfigured = s?.configured;
                return (
                  <div key={item.id}
                    className="flex items-center gap-3 bg-white/2 border border-white/5 rounded-lg px-3 py-2.5">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${item.iconColor}`} />
                    <span className="text-xs text-zinc-300 flex-1">{item.label}</span>
                    <Badge className={`text-[9px] shrink-0 ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : isExpired
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : isConfigured
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-zinc-700/40 text-zinc-600 border-zinc-700"
                    }`}>
                      {isActive ? "Webhook ativo" : isExpired ? "Erro" : isConfigured ? "Configurado" : "Pendente"}
                    </Badge>
                  </div>
                );
              })}
              {/* TikTok — per-user OAuth, status derived from admin config */}
              {(() => {
                const tt = configs?.tiktok;
                const ttActive = tt?.isActive ?? false;
                const ttConfigured = tt?.configured ?? false;
                return (
                  <div className="flex items-center gap-3 bg-white/2 border border-white/5 rounded-lg px-3 py-2.5">
                    <Video className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span className="text-xs text-zinc-300 flex-1">TikTok — conteúdo, shop e anúncios</span>
                    <Badge className={`text-[9px] shrink-0 ${
                      ttActive
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : ttConfigured
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-zinc-700/40 text-zinc-600 border-zinc-700"
                    }`}>
                      {ttActive ? "Conectado ativo" : ttConfigured ? "Configurado" : "Pendente"}
                    </Badge>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

      </motion.div>
    </div>
  );
}
