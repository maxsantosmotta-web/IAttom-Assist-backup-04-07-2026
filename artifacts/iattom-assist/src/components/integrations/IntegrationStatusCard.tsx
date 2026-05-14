import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, XCircle, Settings, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface IntegrationStatusItem {
  id: string;
  label: string;
  configured: boolean;
  isActive: boolean;
  tokenExpired?: boolean;
  environment?: string | null;
  extraInfo?: string | null;
  lastUpdated?: string | null;
}

interface IntegrationStatusCardProps {
  status: IntegrationStatusItem;
  icon: LucideIcon;
  iconColor: string;
  href: string;
  description?: string;
}

export function IntegrationStatusCard({
  status,
  icon: Icon,
  iconColor,
  href,
  description,
}: IntegrationStatusCardProps) {
  const state = !status.configured
    ? "idle"
    : status.tokenExpired
      ? "error"
      : status.isActive
        ? "connected"
        : "warning";

  const stateConfig = {
    connected: {
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      label: "Conectado",
      icon: CheckCircle2,
      dot: "bg-emerald-400",
    },
    warning: {
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      label: "Inativo",
      icon: AlertTriangle,
      dot: "bg-amber-400",
    },
    error: {
      badge: "bg-red-500/15 text-red-400 border-red-500/30",
      label: "Token expirado",
      icon: XCircle,
      dot: "bg-red-400",
    },
    idle: {
      badge: "bg-zinc-700/40 text-zinc-500 border-zinc-600/30",
      label: "Não configurado",
      icon: XCircle,
      dot: "bg-zinc-600",
    },
  } as const;

  const cfg = stateConfig[state];
  const StateIcon = cfg.icon;

  const formatDate = (d: string | null | undefined) =>
    d
      ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : null;

  return (
    <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex flex-col gap-3 hover:bg-white/4 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">{status.label}</p>
            {description && <p className="text-[10px] text-zinc-600 mt-0.5">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${state === "connected" ? "animate-pulse" : ""}`} />
          <Badge className={`text-[10px] ${cfg.badge} flex items-center gap-1`}>
            <StateIcon className="w-2.5 h-2.5" />
            {cfg.label}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-1 min-h-[32px]">
        {status.extraInfo && (
          <p className="text-[11px] text-zinc-500 font-mono truncate">{status.extraInfo}</p>
        )}
        {status.environment && (
          <Badge className={`text-[9px] w-fit ${status.environment === "production" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
            {status.environment === "production" ? "Produção" : "Sandbox"}
          </Badge>
        )}
        {status.lastUpdated && (
          <p className="text-[10px] text-zinc-700">
            Atualizado {formatDate(status.lastUpdated)}
          </p>
        )}
        {!status.configured && (
          <p className="text-[11px] text-zinc-600">Configure as credenciais para ativar.</p>
        )}
      </div>

      <Link href={href}>
        <Button
          size="sm"
          variant="ghost"
          className="w-full h-7 border border-white/8 text-zinc-500 hover:text-white hover:bg-white/5 text-xs gap-1.5 mt-auto"
        >
          <Settings className="w-3 h-3" />
          {status.configured ? "Gerenciar" : "Configurar"}
        </Button>
      </Link>
    </div>
  );
}
