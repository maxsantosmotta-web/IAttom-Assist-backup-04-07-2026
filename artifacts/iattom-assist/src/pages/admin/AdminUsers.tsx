import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, Users, Edit2, Zap, Plus, Minus, RefreshCw, Eye, Activity, CreditCard, FolderOpen, Download, UserX, UserCheck, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminUsers,
  useUpdateAdminUser,
  useAdminAdjustCredits,
  getListAdminUsersQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/react";
import { translateAction, translateModule } from "@/lib/eventTranslations";

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

const planColors: Record<string, string> = {
  free: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  pro: "text-primary bg-primary/10 border-primary/20",
  business: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  agency: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

const planLabels: Record<string, string> = {
  free: "Gratuito",
  pro: "Pro",
  business: "Empresarial",
  agency: "Agência",
};

const roleColors: Record<string, string> = {
  user: "text-muted-foreground bg-white/5 border-white/10",
  admin: "text-red-400 bg-red-400/10 border-red-400/20",
};

type AdminUser = {
  id: number;
  clerkId: string;
  email: string;
  name?: string | null;
  role: "user" | "admin";
  plan: "free" | "pro" | "business" | "agency";
  credits: number;
  projectCount: number;
  actionCount: number;
  createdAt: string;
  banned: boolean;
};

type EditState = {
  role: "user" | "admin";
  plan: "free" | "pro" | "business" | "agency";
  credits: number;
};

type CreditAdjust = {
  userId: number;
  userEmail: string;
  amount: string;
  description: string;
};

type UserProfile = AdminUser & {
  stripeSubscriptionStatus: string | null;
  currentPeriodEnd:   string | null;
  cancelAtPeriodEnd:  boolean;
  recentCredits: Array<{
    id: number; amount: number; type: string; feature: string | null;
    description: string | null; balanceBefore: number; balanceAfter: number; createdAt: string;
  }>;
  recentActivity: Array<{
    id: number; action: string; module: string; projectName: string | null; createdAt: string;
  }>;
};

const roleLabels: Record<string, string> = { user: "Usuário", admin: "Admin" };

const statusPT: Record<string, string> = {
  active:             "Ativa",
  trialing:           "Em Teste",
  canceled:           "Cancelada",
  past_due:           "Pagamento Pendente",
  incomplete:         "Incompleta",
  incomplete_expired: "Expirada",
  unpaid:             "Não Pago",
  paused:             "Pausada",
};

const planPT: Record<string, string> = {
  free: "Gratuito", pro: "Pro", business: "Empresarial", agency: "Agência",
};

const creditTypePT: Record<string, string> = {
  initial:    "Inicial",
  credit:     "Crédito",
  debit:      "Débito",
  adjustment: "Ajuste",
  refund:     "Reembolso",
};

export function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editState, setEditState] = useState<EditState>({ role: "user", plan: "free", credits: 0 });
  const [creditAdjust, setCreditAdjust] = useState<CreditAdjust | null>(null);
  const [bannedIds, setBannedIds] = useState<Set<number>>(new Set());
  const [banTarget, setBanTarget] = useState<{ id: number; email: string; isBanning: boolean } | null>(null);
  const [banLoading, setBanLoading] = useState(false);

  const { getToken } = useAuth();
  const updateUser = useUpdateAdminUser();
  const adjustCredits = useAdminAdjustCredits();

  async function downloadCsv(path: string, filename: string) {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { toast({ title: "Erro ao exportar", variant: "destructive" }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Erro ao exportar", variant: "destructive" }); }
  }

  const params = {
    ...(search ? { search } : {}),
    ...(planFilter !== "all" ? { plan: planFilter as "free" | "pro" | "business" | "agency" } : {}),
    ...(roleFilter !== "all" ? { role: roleFilter as "user" | "admin" } : {}),
    limit: 50,
  };

  const { data, isLoading, isFetching, refetch } = useListAdminUsers(params, {
    query: { queryKey: getListAdminUsersQueryKey(params) },
  });

  // Inicializa bannedIds a partir do campo banned retornado pelo backend (Clerk)
  useEffect(() => {
    if (!data?.users) return;
    setBannedIds(new Set(
      (data.users as AdminUser[]).filter((u) => u.banned).map((u) => u.id)
    ));
  }, [data?.users]);

  const [profileUser, setProfileUser] = useState<AdminUser | null>(null);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const openProfile = (user: AdminUser) => {
    setProfileUser(user);
    setProfileData(null);
    setProfileLoading(true);
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE}/api/admin/users/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setProfileData(await res.json() as UserProfile);
      } finally { setProfileLoading(false); }
    })();
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditState({ role: user.role, plan: user.plan, credits: user.credits });
  };

  const openCreditAdjust = (user: AdminUser) => {
    setCreditAdjust({ userId: user.id, userEmail: user.email, amount: "", description: "" });
  };

  const handleSave = () => {
    if (!editingUser) return;
    updateUser.mutate(
      { id: editingUser.id, data: editState },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
          setEditingUser(null);
        },
      },
    );
  };

  const handleBanAction = async () => {
    if (!banTarget) return;
    setBanLoading(true);
    try {
      const token = await getToken();
      const endpoint = banTarget.isBanning ? "ban" : "unban";
      const res = await fetch(`${BASE}/api/admin/users/${banTarget.id}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setBannedIds((prev) => {
        const next = new Set(prev);
        if (banTarget.isBanning) next.add(banTarget.id);
        else next.delete(banTarget.id);
        return next;
      });
      toast({
        description: banTarget.isBanning
          ? `Usuário ${banTarget.email} bloqueado.`
          : `Usuário ${banTarget.email} desbloqueado.`,
      });
      setBanTarget(null);
    } catch {
      toast({ title: "Falha na operação", variant: "destructive" });
    } finally {
      setBanLoading(false);
    }
  };

  const handleCreditAdjust = () => {
    if (!creditAdjust) return;
    const amount = parseInt(creditAdjust.amount, 10);
    if (isNaN(amount) || amount === 0) return;
    if (!creditAdjust.description.trim()) return;

    adjustCredits.mutate(
      {
        id: creditAdjust.userId,
        data: { amount, description: creditAdjust.description },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
          setCreditAdjust(null);
          toast({ description: `Créditos ${amount > 0 ? "adicionados" : "removidos"} com sucesso.` });
        },
        onError: () => {
          toast({ description: "Falha ao ajustar créditos.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Gerenciamento</p>
            <h2 className="text-2xl font-bold text-white mb-1">Usuários</h2>
            <p className="text-muted-foreground text-sm">Gerencie todos os usuários cadastrados, planos, funções e créditos.</p>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <div className="flex justify-end mt-2">
          <Button
            size="sm" variant="outline"
            onClick={() => void downloadCsv("/api/admin/export/users", `usuarios_${new Date().toISOString().slice(0,10)}.csv`)}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="relative w-full sm:flex-1 sm:min-w-48 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Pesquisar por nome ou e-mail"
            className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="flex-1 min-w-[130px] sm:flex-none sm:w-36 bg-[#111111] border-white/5">
            <SelectValue placeholder="Todos os Planos" />
          </SelectTrigger>
          <SelectContent className="bg-[#111111] border-white/10">
            <SelectItem value="all">Todos os Planos</SelectItem>
            <SelectItem value="free">Start</SelectItem>
            <SelectItem value="pro">Completo</SelectItem>
            <SelectItem value="business">Premium</SelectItem>
            <SelectItem value="agency">Pro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="flex-1 min-w-[120px] sm:flex-none sm:w-32 bg-[#111111] border-white/5">
            <SelectValue placeholder="Todas as Funções" />
          </SelectTrigger>
          <SelectContent className="bg-[#111111] border-white/10">
            <SelectItem value="all">Todas as Funções</SelectItem>
            <SelectItem value="user">Usuário</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground w-full sm:w-auto sm:ml-auto">
          <Users className="w-4 h-4 shrink-0" />
          <span>{isLoading ? "..." : data?.total ?? 0} usuários</span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="bg-[#111111] border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3.5 text-xs text-muted-foreground font-medium whitespace-nowrap">Usuário</th>
                  <th className="text-left px-4 py-3.5 text-xs text-muted-foreground font-medium whitespace-nowrap">Função</th>
                  <th className="text-left px-4 py-3.5 text-xs text-muted-foreground font-medium whitespace-nowrap">Plano</th>
                  <th className="text-right px-4 py-3.5 text-xs text-muted-foreground font-medium whitespace-nowrap">Créditos</th>
                  <th className="text-right px-4 py-3.5 text-xs text-muted-foreground font-medium whitespace-nowrap">Projetos</th>
                  <th className="text-right px-4 py-3.5 text-xs text-muted-foreground font-medium whitespace-nowrap">Ações</th>
                  <th className="text-left px-4 py-3.5 text-xs text-muted-foreground font-medium whitespace-nowrap">Cadastro</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="px-5 py-3"><Skeleton className="h-8 w-48 bg-white/5" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 bg-white/5" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 bg-white/5" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-10 bg-white/5 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-8 bg-white/5 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-8 bg-white/5 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 bg-white/5" /></td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  ))
                ) : !data?.users?.length ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-muted-foreground text-sm text-center align-middle">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  data.users.map((user: AdminUser) => {
                    const initials = (user.name ?? user.email)
                      .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                    return (
                      <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8 border border-primary/20">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-white text-sm">{user.name ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs ${roleColors[user.role]}`}>
                            {roleLabels[user.role] ?? user.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs ${planColors[user.plan] ?? planColors.free}`}>
                            {planLabels[user.plan] ?? user.plan}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-white font-mono text-sm">{user.credits}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-sm">{user.projectCount}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-sm">{user.actionCount}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                            {bannedIds.has(user.id) && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-red-400 bg-red-500/10 border-red-500/20">
                                Bloqueado
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openProfile(user)}
                              title="Ver perfil"
                              className="text-muted-foreground hover:text-primary transition-colors p-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openCreditAdjust(user)}
                              title="Ajustar créditos"
                              className="text-muted-foreground hover:text-primary transition-colors p-1"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEdit(user)}
                              title="Editar usuário"
                              className="text-muted-foreground hover:text-primary transition-colors p-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {bannedIds.has(user.id) ? (
                              <button
                                onClick={() => setBanTarget({ id: user.id, email: user.email, isBanning: false })}
                                title="Desbloquear usuário"
                                className="text-emerald-500 hover:text-emerald-400 transition-colors p-1"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setBanTarget({ id: user.id, email: user.email, isBanning: true })}
                                title="Bloquear usuário"
                                className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Usuário</DialogTitle>
            {editingUser && (
              <p className="text-xs text-muted-foreground">{editingUser.email}</p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Função</Label>
              <Select
                value={editState.role}
                onValueChange={(v) => setEditState((s) => ({ ...s, role: v as "user" | "admin" }))}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-white/10">
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plano</Label>
              <Select
                value={editState.plan}
                onValueChange={(v) => setEditState((s) => ({ ...s, plan: v as "free" | "pro" | "business" | "agency" }))}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-white/10">
                  <SelectItem value="free">Gratuito</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="business">Empresarial</SelectItem>
                  <SelectItem value="agency">Agência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Créditos (valor direto)</Label>
              <Input
                type="number"
                value={editState.credits}
                onChange={(e) => setEditState((s) => ({ ...s, credits: parseInt(e.target.value) || 0 }))}
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                min={0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingUser(null)} className="text-muted-foreground">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateUser.isPending}
              className="bg-primary text-black hover:bg-primary/90 font-semibold"
            >
              {updateUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditAdjust} onOpenChange={(open) => !open && setCreditAdjust(null)}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Ajustar Créditos
            </DialogTitle>
            {creditAdjust && (
              <p className="text-xs text-muted-foreground">{creditAdjust.userEmail}</p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor (positivo = adicionar, negativo = remover)</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreditAdjust((s) => s ? { ...s, amount: s.amount.startsWith("-") ? s.amount.slice(1) : s.amount } : s)}
                  className="px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <Input
                  type="number"
                  placeholder="ex: 100 ou -50"
                  value={creditAdjust?.amount ?? ""}
                  onChange={(e) => setCreditAdjust((s) => s ? { ...s, amount: e.target.value } : s)}
                  className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50 flex-1"
                />
                <button
                  onClick={() => setCreditAdjust((s) => {
                    if (!s) return s;
                    const val = s.amount.replace("-", "");
                    return { ...s, amount: val ? `-${val}` : "" };
                  })}
                  className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Motivo / Descrição</Label>
              <Input
                placeholder="ex: Recarga manual pelo admin"
                value={creditAdjust?.description ?? ""}
                onChange={(e) => setCreditAdjust((s) => s ? { ...s, description: e.target.value } : s)}
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreditAdjust(null)} className="text-muted-foreground">
              Cancelar
            </Button>
            <Button
              onClick={handleCreditAdjust}
              disabled={
                adjustCredits.isPending ||
                !creditAdjust?.amount ||
                isNaN(parseInt(creditAdjust.amount, 10)) ||
                parseInt(creditAdjust.amount, 10) === 0 ||
                !creditAdjust.description.trim()
              }
              className="bg-primary text-black hover:bg-primary/90 font-semibold"
            >
              {adjustCredits.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar Ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── DIALOG: Confirmar Ban/Unban ───────────────────────────── */}
      <Dialog open={!!banTarget} onOpenChange={(open) => { if (!open) setBanTarget(null); }}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {banTarget?.isBanning
                ? <><UserX className="w-4 h-4 text-red-400" /> Bloquear Usuário</>
                : <><UserCheck className="w-4 h-4 text-emerald-400" /> Desbloquear Usuário</>}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/8 mb-3">
              <ShieldOff className={`w-4 h-4 shrink-0 ${banTarget?.isBanning ? "text-red-400" : "text-emerald-400"}`} />
              <p className="text-sm text-zinc-300 break-all">{banTarget?.email}</p>
            </div>
            <p className="text-xs text-zinc-500">
              {banTarget?.isBanning
                ? "O usuário perderá acesso imediatamente. O bloqueio pode ser revertido a qualquer momento."
                : "O usuário recuperará acesso imediatamente."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanTarget(null)} className="text-muted-foreground">
              Cancelar
            </Button>
            <Button
              onClick={() => void handleBanAction()}
              disabled={banLoading}
              className={banTarget?.isBanning
                ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold"
                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 font-semibold"}
            >
              {banLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : banTarget?.isBanning ? "Bloquear" : "Desbloquear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Perfil Expandido ──────────────────────────────── */}
      <Dialog open={!!profileUser} onOpenChange={(open) => { if (!open) { setProfileUser(null); setProfileData(null); } }}>
        <DialogContent className="bg-[#0d0d0d] border-white/10 text-white max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-primary">
                  {((profileUser?.name ?? profileUser?.email ?? "U")
                    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2))}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{profileUser?.name ?? "—"}</h2>
                <p className="text-sm text-zinc-400 truncate">{profileUser?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className={`text-xs ${roleColors[profileUser?.role ?? "user"]}`}>
                    {roleLabels[profileUser?.role ?? "user"] ?? profileUser?.role}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${planColors[profileUser?.plan ?? "free"]}`}>
                    {planPT[profileUser?.plan ?? "free"] ?? profileUser?.plan}
                  </Badge>
                  {profileData?.stripeSubscriptionStatus && (
                    <span className={`text-xs font-medium flex items-center gap-1 ${
                      profileData.stripeSubscriptionStatus === "active"   ? "text-emerald-400" :
                      profileData.stripeSubscriptionStatus === "trialing" ? "text-blue-400"    :
                      "text-zinc-400"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        profileData.stripeSubscriptionStatus === "active"   ? "bg-emerald-400" :
                        profileData.stripeSubscriptionStatus === "trialing" ? "bg-blue-400"    :
                        "bg-zinc-500"
                      }`} />
                      {statusPT[profileData.stripeSubscriptionStatus] ?? profileData.stripeSubscriptionStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {profileLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-16 w-full bg-white/5 rounded-xl" />
              <Skeleton className="h-32 w-full bg-white/5 rounded-xl" />
              <Skeleton className="h-32 w-full bg-white/5 rounded-xl" />
            </div>
          ) : profileData ? (
            <div className="p-6 space-y-5">
              {/* KPI tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Zap,        label: "Créditos",        value: profileData.credits.toLocaleString("pt-BR"),      color: "text-primary" },
                  { icon: FolderOpen, label: "Projetos",        value: profileData.projectCount.toLocaleString("pt-BR"), color: "text-blue-400" },
                  { icon: Activity,   label: "Ações",           value: profileData.actionCount.toLocaleString("pt-BR"),  color: "text-emerald-400" },
                  { icon: CreditCard, label: "Cadastro",        value: new Date(profileData.createdAt).toLocaleDateString("pt-BR"), color: "text-zinc-400" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="bg-[#111111] border border-white/5 rounded-xl p-3">
                    <Icon className={`w-4 h-4 ${color} mb-2`} />
                    <p className="text-base font-bold text-white">{value}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {profileData.currentPeriodEnd && (
                <div className="text-xs text-zinc-500 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                  Próxima renovação: <span className="text-zinc-300 font-medium">{new Date(profileData.currentPeriodEnd).toLocaleDateString("pt-BR")}</span>
                  {profileData.cancelAtPeriodEnd && <span className="ml-2 text-rose-400 font-medium">— cancelamento no vencimento</span>}
                </div>
              )}

              {/* Histórico de créditos */}
              <div>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mb-2">Últimas Transações de Créditos</p>
                {profileData.recentCredits.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">Nenhuma transação registrada.</p>
                ) : (
                  <div className="rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="text-left text-zinc-500 px-3 py-2 font-medium">Tipo</th>
                          <th className="text-left text-zinc-500 px-3 py-2 font-medium">Módulo</th>
                          <th className="text-right text-zinc-500 px-3 py-2 font-medium">Valor</th>
                          <th className="text-right text-zinc-500 px-3 py-2 font-medium">Saldo</th>
                          <th className="text-left text-zinc-500 px-3 py-2 font-medium">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profileData.recentCredits.map((tx) => (
                          <tr key={tx.id} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2">
                              <span className={`${tx.amount >= 0 ? "text-emerald-400" : "text-rose-400"} font-medium`}>
                                {creditTypePT[tx.type] ?? tx.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-zinc-400 truncate max-w-[100px]">
                              {tx.feature ?? tx.description ?? "—"}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono font-semibold ${tx.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {tx.amount >= 0 ? "+" : ""}{tx.amount}
                            </td>
                            <td className="px-3 py-2 text-right text-zinc-400 font-mono">{tx.balanceAfter}</td>
                            <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                              {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Histórico de atividade */}
              <div>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mb-2">Últimas Atividades</p>
                {profileData.recentActivity.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">Nenhuma atividade registrada.</p>
                ) : (
                  <div className="rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="text-left text-zinc-500 px-3 py-2 font-medium">Ação</th>
                          <th className="text-left text-zinc-500 px-3 py-2 font-medium">Módulo</th>
                          <th className="text-left text-zinc-500 px-3 py-2 font-medium">Projeto</th>
                          <th className="text-left text-zinc-500 px-3 py-2 font-medium">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profileData.recentActivity.map((act) => (
                          <tr key={act.id} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2 text-zinc-300 truncate max-w-[150px]">{translateAction(act.action)}</td>
                            <td className="px-3 py-2 text-zinc-400">{translateModule(act.module)}</td>
                            <td className="px-3 py-2 text-zinc-500 truncate max-w-[100px]">{act.projectName ?? "—"}</td>
                            <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                              {new Date(act.createdAt).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 flex items-center justify-center h-28">
              <p className="text-xs text-zinc-600">Não foi possível carregar o perfil.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
