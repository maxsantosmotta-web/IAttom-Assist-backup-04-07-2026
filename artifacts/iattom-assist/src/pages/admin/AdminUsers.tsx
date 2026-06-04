import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, Users, Edit2, Zap, Plus, Minus, RefreshCw } from "lucide-react";
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

const planColors: Record<string, string> = {
  free: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  pro: "text-primary bg-primary/10 border-primary/20",
  business: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  agency: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

const planLabels: Record<string, string> = {
  free: "Start",
  pro: "Completo",
  business: "Premium",
  agency: "Pro",
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

export function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editState, setEditState] = useState<EditState>({ role: "user", plan: "free", credits: 0 });
  const [creditAdjust, setCreditAdjust] = useState<CreditAdjust | null>(null);

  const updateUser = useUpdateAdminUser();
  const adjustCredits = useAdminAdjustCredits();

  const params = {
    ...(search ? { search } : {}),
    ...(planFilter !== "all" ? { plan: planFilter as "free" | "pro" | "business" | "agency" } : {}),
    ...(roleFilter !== "all" ? { role: roleFilter as "user" | "admin" } : {}),
    limit: 50,
  };

  const { data, isLoading, refetch } = useListAdminUsers(params, {
    query: { queryKey: getListAdminUsersQueryKey(params) },
  });

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
          toast({ description: `Credits ${amount > 0 ? "added" : "removed"} successfully.` });
        },
        onError: () => {
          toast({ description: "Failed to adjust credits.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Gerenciamento</p>
            <h2 className="text-2xl font-bold text-white mb-1">Usuários</h2>
            <p className="text-muted-foreground text-sm">Gerencie todos os usuários cadastrados, planos, funções e créditos.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isLoading} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
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
                          <Badge variant="outline" className={`text-xs capitalize ${roleColors[user.role]}`}>
                            {user.role}
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
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openCreditAdjust(user)}
                              title="Adjust credits"
                              className="text-muted-foreground hover:text-primary transition-colors p-1"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEdit(user)}
                              title="Edit user"
                              className="text-muted-foreground hover:text-primary transition-colors p-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
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
            <DialogTitle className="text-white">Edit User</DialogTitle>
            {editingUser && (
              <p className="text-xs text-muted-foreground">{editingUser.email}</p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select
                value={editState.role}
                onValueChange={(v) => setEditState((s) => ({ ...s, role: v as "user" | "admin" }))}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-white/10">
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plan</Label>
              <Select
                value={editState.plan}
                onValueChange={(v) => setEditState((s) => ({ ...s, plan: v as "free" | "pro" | "business" | "agency" }))}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-white/10">
                  <SelectItem value="free">Start</SelectItem>
                  <SelectItem value="pro">Completo</SelectItem>
                  <SelectItem value="business">Premium</SelectItem>
                  <SelectItem value="agency">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Credits (direct set)</Label>
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
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateUser.isPending}
              className="bg-primary text-black hover:bg-primary/90 font-semibold"
            >
              {updateUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditAdjust} onOpenChange={(open) => !open && setCreditAdjust(null)}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Adjust Credits
            </DialogTitle>
            {creditAdjust && (
              <p className="text-xs text-muted-foreground">{creditAdjust.userEmail}</p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Amount (positive = add, negative = remove)</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreditAdjust((s) => s ? { ...s, amount: s.amount.startsWith("-") ? s.amount.slice(1) : s.amount } : s)}
                  className="px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <Input
                  type="number"
                  placeholder="e.g. 100 or -50"
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
              <Label className="text-xs text-muted-foreground">Reason / Description</Label>
              <Input
                placeholder="e.g. Manual top-up by admin"
                value={creditAdjust?.description ?? ""}
                onChange={(e) => setCreditAdjust((s) => s ? { ...s, description: e.target.value } : s)}
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreditAdjust(null)} className="text-muted-foreground">
              Cancel
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
              {adjustCredits.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
