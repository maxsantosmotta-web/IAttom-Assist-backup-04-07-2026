import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, CreditCard, Edit2, Eye, FolderOpen, Loader2, RefreshCw, Search, ShieldOff, UserCheck, UserX, Users, Zap } from "lucide-react";
import { useListAdminUsers, useUpdateAdminUser, getListAdminUsersQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { translateAction, translateModule } from "@/lib/eventTranslations";

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

const planLabels: Record<string, string> = {
  free: "FREE",
  pro: "START",
  business: "PREMIUM",
  agency: "PRO",
};

const planColors: Record<string, string> = {
  free: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  pro: "text-primary bg-primary/10 border-primary/20",
  business: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  agency: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

const roleLabels: Record<string, string> = { user: "Usuário", admin: "Admin" };
const roleColors: Record<string, string> = {
  user: "text-muted-foreground bg-white/5 border-white/10",
  admin: "text-red-400 bg-red-400/10 border-red-400/20",
};

const statusPT: Record<string, string> = {
  active: "Ativa",
  trialing: "Em teste",
  canceled: "Cancelada",
  past_due: "Pagamento pendente",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  unpaid: "Não paga",
  paused: "Pausada",
};

const creditTypePT: Record<string, string> = {
  initial: "Inicial",
  credit: "Crédito",
  debit: "Débito",
  adjustment: "Ajuste",
  refund: "Reembolso",
};

type Plan = "free" | "pro" | "business" | "agency";
type Role = "user" | "admin";

type AdminUser = {
  id: number;
  clerkId: string;
  email: string;
  name?: string | null;
  role: Role;
  plan: Plan;
  credits: number;
  extraCredits?: number;
  creativeCredits?: number;
  extraCreativeCredits?: number;
  projectCount: number;
  actionCount: number;
  createdAt: string;
  banned: boolean;
};

type UserProfile = AdminUser & {
  stripeSubscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  recentCredits: Array<{
    id: number;
    amount: number;
    type: string;
    feature: string | null;
    balanceType?: string | null;
    description: string | null;
    balanceAfter: number;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: number;
    action: string;
    module: string;
    projectName: string | null;
    createdAt: string;
  }>;
};

type EditState = { role: Role; plan: Plan };
type BalanceState = { userId: number; email: string; generalCredits: string; images: string; description: string };

function readableTransaction(tx: UserProfile["recentCredits"][number]): string {
  if (tx.balanceType === "creative") {
    if (tx.description?.toLowerCase().includes("compra")) return "Compra de imagens";
    if (tx.feature?.startsWith("creativeImage")) return "Geração de imagens";
    return tx.description ?? "Imagens";
  }
  if (tx.feature === "prompt_creation") return "Criação de prompt";
  if (tx.feature === "campaign") return "Criação de campanha";
  return tx.description ?? tx.feature ?? "—";
}

export function AdminUsers() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateUser = useUpdateAdminUser();

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editState, setEditState] = useState<EditState>({ role: "user", plan: "free" });
  const [balanceState, setBalanceState] = useState<BalanceState | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [profileUser, setProfileUser] = useState<AdminUser | null>(null);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [bannedIds, setBannedIds] = useState<Set<number>>(new Set());
  const [banTarget, setBanTarget] = useState<{ id: number; email: string; isBanning: boolean } | null>(null);
  const [banLoading, setBanLoading] = useState(false);

  const params = {
    ...(search ? { search } : {}),
    ...(planFilter !== "all" ? { plan: planFilter as Plan } : {}),
    ...(roleFilter !== "all" ? { role: roleFilter as Role } : {}),
    limit: 50,
  };

  const { data, isLoading, isFetching, refetch } = useListAdminUsers(params, {
    query: { queryKey: getListAdminUsersQueryKey(params) },
  });

  useEffect(() => {
    if (!data?.users) return;
    setBannedIds(new Set((data.users as AdminUser[]).filter((u) => u.banned).map((u) => u.id)));
  }, [data?.users]);

  async function fetchProfile(user: AdminUser): Promise<UserProfile | null> {
    const token = await getToken();
    const res = await fetch(`${BASE}/api/admin/users/${user.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return res.json() as Promise<UserProfile>;
  }

  async function openProfile(user: AdminUser) {
    setProfileUser(user);
    setProfileData(null);
    setProfileLoading(true);
    try {
      setProfileData(await fetchProfile(user));
    } finally {
      setProfileLoading(false);
    }
  }

  async function openBalances(user: AdminUser) {
    setBalanceState({ userId: user.id, email: user.email, generalCredits: String(user.credits), images: "0", description: "Ajuste administrativo" });
    try {
      const profile = await fetchProfile(user);
      if (!profile) return;
      const totalGeneral = profile.credits + (profile.extraCredits ?? 0);
      const totalCreative = (profile.creativeCredits ?? 0) + (profile.extraCreativeCredits ?? 0);
      setBalanceState((current) => current?.userId === user.id ? {
        ...current,
        generalCredits: String(totalGeneral),
        images: String(Math.floor(totalCreative / 10)),
      } : current);
    } catch {
      toast({ title: "Não foi possível carregar os saldos", variant: "destructive" });
    }
  }

  async function saveBalances() {
    if (!balanceState) return;
    const generalCredits = Number.parseInt(balanceState.generalCredits, 10);
    const images = Number.parseInt(balanceState.images, 10);
    if (!Number.isInteger(generalCredits) || generalCredits < 0 || !Number.isInteger(images) || images < 0 || !balanceState.description.trim()) return;
    setBalanceLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/admin/users/${balanceState.userId}/balances`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ generalCredits, images, description: balanceState.description.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      await queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
      setBalanceState(null);
      toast({ description: `Saldo definido: ${generalCredits} créditos e ${images} imagens.` });
    } catch {
      toast({ title: "Falha ao definir os saldos", variant: "destructive" });
    } finally {
      setBalanceLoading(false);
    }
  }

  function saveUser() {
    if (!editingUser) return;
    updateUser.mutate({ id: editingUser.id, data: editState }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        setEditingUser(null);
      },
      onError: () => toast({ title: "Falha ao atualizar usuário", variant: "destructive" }),
    });
  }

  async function handleBan() {
    if (!banTarget) return;
    setBanLoading(true);
    try {
      const token = await getToken();
      const endpoint = banTarget.isBanning ? "ban" : "unban";
      const res = await fetch(`${BASE}/api/admin/users/${banTarget.id}/${endpoint}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      setBannedIds((previous) => {
        const next = new Set(previous);
        if (banTarget.isBanning) next.add(banTarget.id); else next.delete(banTarget.id);
        return next;
      });
      toast({ description: banTarget.isBanning ? "Usuário bloqueado." : "Usuário desbloqueado." });
      setBanTarget(null);
    } catch {
      toast({ title: "Falha na operação", variant: "destructive" });
    } finally {
      setBanLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Gerenciamento</p>
            <h2 className="text-2xl font-bold text-white mb-1">Usuários</h2>
            <p className="text-muted-foreground text-sm">Gerencie usuários, planos e saldos.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome ou e-mail" className="pl-10 bg-[#111111] border-white/5" />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-40 bg-[#111111] border-white/5"><SelectValue placeholder="Todos os planos" /></SelectTrigger>
          <SelectContent className="bg-[#111111] border-white/10">
            <SelectItem value="all">Todos os planos</SelectItem>
            <SelectItem value="free">FREE</SelectItem>
            <SelectItem value="pro">START</SelectItem>
            <SelectItem value="business">PREMIUM</SelectItem>
            <SelectItem value="agency">PRO</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36 bg-[#111111] border-white/5"><SelectValue placeholder="Todas as funções" /></SelectTrigger>
          <SelectContent className="bg-[#111111] border-white/10">
            <SelectItem value="all">Todas as funções</SelectItem>
            <SelectItem value="user">Usuário</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="w-4 h-4" /> {data?.total ?? 0} usuários</div>
      </div>

      <Card className="bg-[#111111] border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5">
              <th className="text-left px-5 py-3.5 text-xs text-muted-foreground">Usuário</th>
              <th className="text-left px-4 py-3.5 text-xs text-muted-foreground">Função</th>
              <th className="text-left px-4 py-3.5 text-xs text-muted-foreground">Plano</th>
              <th className="text-right px-4 py-3.5 text-xs text-muted-foreground">Créditos</th>
              <th className="text-right px-4 py-3.5 text-xs text-muted-foreground">Projetos</th>
              <th className="text-right px-4 py-3.5 text-xs text-muted-foreground">Ações</th>
              <th className="px-4 py-3.5" />
            </tr></thead>
            <tbody>
              {isLoading ? Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={7} className="p-4"><Skeleton className="h-9 w-full bg-white/5" /></td></tr>) :
                (data?.users as AdminUser[] | undefined)?.map((user) => {
                  const initials = (user.name ?? user.email).split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
                  const totalCredits = user.credits + (user.extraCredits ?? 0);
                  return <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback></Avatar><div><p className="text-white">{user.name ?? "—"}</p><p className="text-xs text-muted-foreground">{user.email}</p></div></div></td>
                    <td className="px-4 py-3"><Badge variant="outline" className={roleColors[user.role]}>{roleLabels[user.role]}</Badge></td>
                    <td className="px-4 py-3"><Badge variant="outline" className={planColors[user.plan]}>{planLabels[user.plan]}</Badge></td>
                    <td className="px-4 py-3 text-right font-mono text-white">{totalCredits}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{user.projectCount}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{user.actionCount}</td>
                    <td className="px-4 py-3"><div className="flex gap-1">
                      <button title="Ver perfil" onClick={() => void openProfile(user)} className="p-1 text-muted-foreground hover:text-primary"><Eye className="w-4 h-4" /></button>
                      <button title="Definir saldos" onClick={() => void openBalances(user)} className="p-1 text-muted-foreground hover:text-primary"><Zap className="w-4 h-4" /></button>
                      <button title="Editar usuário" onClick={() => { setEditingUser(user); setEditState({ role: user.role, plan: user.plan }); }} className="p-1 text-muted-foreground hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                      <button title={bannedIds.has(user.id) ? "Desbloquear" : "Bloquear"} onClick={() => setBanTarget({ id: user.id, email: user.email, isBanning: !bannedIds.has(user.id) })} className="p-1 text-muted-foreground hover:text-red-400">{bannedIds.has(user.id) ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}</button>
                    </div></td>
                  </tr>;
                })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm">
          <DialogHeader><DialogTitle>Editar usuário</DialogTitle><p className="text-xs text-muted-foreground">{editingUser?.email}</p></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Função</Label><Select value={editState.role} onValueChange={(value) => setEditState((state) => ({ ...state, role: value as Role }))}><SelectTrigger className="bg-[#0a0a0a] border-white/10"><SelectValue /></SelectTrigger><SelectContent className="bg-[#111111] border-white/10"><SelectItem value="user">Usuário</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
            <div><Label>Plano</Label><Select value={editState.plan} onValueChange={(value) => setEditState((state) => ({ ...state, plan: value as Plan }))}><SelectTrigger className="bg-[#0a0a0a] border-white/10"><SelectValue /></SelectTrigger><SelectContent className="bg-[#111111] border-white/10"><SelectItem value="free">FREE</SelectItem><SelectItem value="pro">START</SelectItem><SelectItem value="business">PREMIUM</SelectItem><SelectItem value="agency">PRO</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setEditingUser(null)}>Cancelar</Button><Button onClick={saveUser} disabled={updateUser.isPending}>{updateUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!balanceState} onOpenChange={(open) => !open && setBalanceState(null)}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />Definir saldos</DialogTitle><p className="text-xs text-muted-foreground">{balanceState?.email}</p></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Créditos gerais disponíveis</Label><Input type="number" min={0} value={balanceState?.generalCredits ?? ""} onChange={(e) => setBalanceState((state) => state ? { ...state, generalCredits: e.target.value } : state)} className="bg-[#0a0a0a] border-white/10" /></div>
            <div><Label>Imagens disponíveis</Label><Input type="number" min={0} value={balanceState?.images ?? ""} onChange={(e) => setBalanceState((state) => state ? { ...state, images: e.target.value } : state)} className="bg-[#0a0a0a] border-white/10" /><p className="text-[10px] text-zinc-600 mt-1">O sistema mantém internamente 10 créditos por imagem.</p></div>
            <div><Label>Motivo</Label><Input value={balanceState?.description ?? ""} onChange={(e) => setBalanceState((state) => state ? { ...state, description: e.target.value } : state)} className="bg-[#0a0a0a] border-white/10" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setBalanceState(null)}>Cancelar</Button><Button onClick={() => void saveBalances()} disabled={balanceLoading}>{balanceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Definir saldos"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm"><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldOff className="w-4 h-4 text-red-400" />{banTarget?.isBanning ? "Bloquear usuário" : "Desbloquear usuário"}</DialogTitle></DialogHeader><p className="text-sm text-zinc-300">{banTarget?.email}</p><DialogFooter><Button variant="ghost" onClick={() => setBanTarget(null)}>Cancelar</Button><Button onClick={() => void handleBan()} disabled={banLoading}>{banLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : banTarget?.isBanning ? "Bloquear" : "Desbloquear"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={!!profileUser} onOpenChange={(open) => { if (!open) { setProfileUser(null); setProfileData(null); } }}>
        <DialogContent className="bg-[#0d0d0d] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{profileUser?.name ?? profileUser?.email}</DialogTitle><div className="flex gap-2"><Badge variant="outline" className={roleColors[profileUser?.role ?? "user"]}>{roleLabels[profileUser?.role ?? "user"]}</Badge><Badge variant="outline" className={planColors[profileUser?.plan ?? "free"]}>{planLabels[profileUser?.plan ?? "free"]}</Badge>{profileData?.stripeSubscriptionStatus && <Badge variant="outline">{statusPT[profileData.stripeSubscriptionStatus] ?? profileData.stripeSubscriptionStatus}</Badge>}</div></DialogHeader>
          {profileLoading ? <Skeleton className="h-40 w-full bg-white/5" /> : profileData ? <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[{ icon: Zap, label: "Créditos", value: profileData.credits + (profileData.extraCredits ?? 0) }, { icon: Zap, label: "Imagens", value: Math.floor(((profileData.creativeCredits ?? 0) + (profileData.extraCreativeCredits ?? 0)) / 10) }, { icon: FolderOpen, label: "Projetos", value: profileData.projectCount }, { icon: Activity, label: "Ações", value: profileData.actionCount }].map(({ icon: Icon, label, value }) => <div key={label} className="bg-[#111111] rounded-xl p-3 border border-white/5"><Icon className="w-4 h-4 text-primary mb-2" /><p className="font-bold">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>)}
            </div>
            <div><p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Últimas transações</p><div className="overflow-x-auto rounded-xl border border-white/5"><table className="w-full text-xs"><thead><tr className="border-b border-white/5"><th className="text-left p-2">Tipo</th><th className="text-left p-2">Módulo</th><th className="text-right p-2">Valor</th><th className="text-right p-2">Saldo</th></tr></thead><tbody>{profileData.recentCredits.map((tx) => { const creative = tx.balanceType === "creative"; return <tr key={tx.id} className="border-b border-white/5"><td className="p-2">{creditTypePT[tx.type] ?? tx.type}</td><td className="p-2">{readableTransaction(tx)}</td><td className="p-2 text-right">{tx.amount >= 0 ? "+" : ""}{creative ? tx.amount / 10 : tx.amount}{creative ? " img" : ""}</td><td className="p-2 text-right">{creative ? `${tx.balanceAfter / 10} img` : tx.balanceAfter}</td></tr>; })}</tbody></table></div></div>
            <div><p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Últimas atividades</p>{profileData.recentActivity.map((activity) => <div key={activity.id} className="text-xs py-2 border-b border-white/5"><span className="text-zinc-300">{translateAction(activity.action)}</span> · <span className="text-zinc-500">{translateModule(activity.module)}</span></div>)}</div>
          </div> : <p className="text-sm text-zinc-500">Não foi possível carregar o perfil.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
