import { useState } from "react";
import { motion } from "framer-motion";
import { MonitorCheck, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Database, Sparkles, CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

interface ServiceCheck {
  service: string;
  status: "ok" | "error";
  latencyMs?: number;
  detail?: string;
}

interface HealthData {
  overall: "ok" | "degraded";
  checkedAt: string;
  checks: ServiceCheck[];
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "Banco de Dados": Database,
  "OpenAI": Sparkles,
  "Stripe": CreditCard,
};

export function AdminHealth() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);

  async function runCheck() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/admin/health`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok && res.status !== 207) throw new Error("Erro na requisição");
      const json = (await res.json()) as HealthData;
      setData(json);
    } catch {
      toast({ title: "Erro ao verificar saúde da plataforma", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const overallOk = data?.overall === "ok";

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Monitoramento</p>
            <h2 className="text-2xl font-bold text-white mb-1">Saúde da Plataforma</h2>
            <p className="text-muted-foreground text-sm">Verificação em tempo real dos serviços críticos da plataforma.</p>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => void runCheck()} disabled={loading}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {data ? "Verificar Novamente" : "Verificar Agora"}
          </Button>
        </div>
      </motion.div>

      {/* Overall Status */}
      {data && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className={`flex items-center gap-4 p-4 rounded-xl border ${
            overallOk
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-red-500/5 border-red-500/20"
          }`}>
            {overallOk
              ? <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              : <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${overallOk ? "text-emerald-400" : "text-red-400"}`}>
                {overallOk ? "Todos os serviços operacionais" : "Um ou mais serviços com problema"}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Verificado em {new Date(data.checkedAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <Badge className={overallOk
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
              : "bg-red-500/10 text-red-400 border-red-500/20 text-xs"
            }>
              {overallOk ? "Operacional" : "Degradado"}
            </Badge>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MonitorCheck className="w-10 h-10 text-zinc-700 mb-4" />
            <p className="text-sm text-zinc-500 mb-1">Nenhuma verificação realizada ainda</p>
            <p className="text-xs text-zinc-600">Clique em "Verificar Agora" para testar os serviços</p>
          </div>
        </motion.div>
      )}

      {/* Service Cards */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {data.checks.map((check, i) => {
            const Icon = SERVICE_ICONS[check.service] ?? MonitorCheck;
            const isOk = check.status === "ok";
            return (
              <motion.div
                key={check.service}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.12 + i * 0.06 }}
              >
                <Card className="bg-white/[0.02] border-white/[0.06] hover:border-white/10 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                        isOk
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : "bg-red-500/10 border-red-500/20"
                      }`}>
                        <Icon className={`w-4 h-4 ${isOk ? "text-emerald-400" : "text-red-400"}`} />
                      </div>
                      {check.service}
                      <div className="ml-auto">
                        {isOk
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          : <XCircle className="w-4 h-4 text-red-400" />
                        }
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <Badge className={`text-[10px] ${
                      isOk
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {isOk ? "Operacional" : "Falha"}
                    </Badge>
                    {check.latencyMs !== undefined && (
                      <p className="text-[11px] text-zinc-500">
                        Latência: <span className="text-zinc-300 font-medium">{check.latencyMs} ms</span>
                      </p>
                    )}
                    {check.detail && (
                      <p className={`text-[11px] ${isOk ? "text-zinc-500" : "text-red-400/80"}`}>
                        {check.detail}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
