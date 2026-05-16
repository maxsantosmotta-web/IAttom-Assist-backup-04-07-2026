import { useState } from "react";
import { motion } from "framer-motion";
import {
  Music2, AlertCircle, Users, Activity, Zap,
  BarChart2, RefreshCw, Info, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

function InformativeModal({ title, description, onClose }: {
  title: string; description: string; onClose: () => void;
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
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <Button onClick={onClose} className="w-full bg-primary text-black hover:bg-primary/90 font-semibold">
          Entendido
        </Button>
      </motion.div>
    </div>
  );
}

export function AdminTikTok() {
  const { toast } = useToast();
  const [modal, setModal] = useState<{ title: string; description: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
    toast({ description: "Função preparada para próxima etapa — nenhuma conta TikTok conectada ainda." });
  };

  const handleSetup = () => {
    setModal({
      title: "Configurar Integração TikTok",
      description:
        "Para ativar a integração TikTok, acesse o TikTok Developer Portal (developers.tiktok.com), crie um app, obtenha o Client Key e Client Secret e configure o redirect URI. Em seguida, adicione as credenciais nas variáveis de ambiente da plataforma (TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET). Após configuração, usuários poderão conectar suas contas.",
    });
  };

  const kpis = [
    { icon: Users,    label: "Contas Conectadas",  value: "0",        color: "text-violet-400" },
    { icon: Activity, label: "Eventos (30d)",       value: "0",        color: "text-blue-400"   },
    { icon: Zap,      label: "Status Global",       value: "Inativo",  color: "text-yellow-400" },
    { icon: BarChart2,label: "Campanhas Ativas",    value: "0",        color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      {modal && (
        <InformativeModal title={modal.title} description={modal.description} onClose={() => setModal(null)} />
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TikTok</h1>
              <p className="text-xs text-muted-foreground">Monitoramento global da integração TikTok</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-white/10 text-muted-foreground hover:text-white"
            >
              {refreshing ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={handleSetup}
              className="bg-primary text-black hover:bg-primary/90 font-semibold"
            >
              Configurar Integração
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-950/20 border border-yellow-500/20 mb-5">
          <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-400">Integração não configurada</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure as credenciais TikTok Developer para ativar a integração. Clique em "Configurar Integração" para instruções.
            </p>
          </div>
          <Badge className="ml-auto bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs shrink-0">Inativo</Badge>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {kpis.map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="bg-[#111111] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Connected Accounts */}
        <Card className="bg-[#111111] border-white/[0.06] mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Contas Conectadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Music2 className="w-10 h-10 text-white/10 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Nenhuma conta conectada</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                Após configurar a integração, os usuários que conectarem suas contas TikTok aparecerão aqui.
              </p>
              <Button
                size="sm"
                onClick={handleSetup}
                variant="outline"
                className="mt-4 border-white/10 text-muted-foreground hover:text-white"
              >
                Ver instruções de configuração
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Events */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Eventos Recentes
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-muted-foreground hover:text-white h-7 px-2"
              >
                {refreshing
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground/60 text-center py-6">
              Nenhum evento registrado. Os webhooks e eventos TikTok aparecerão aqui após a configuração.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
