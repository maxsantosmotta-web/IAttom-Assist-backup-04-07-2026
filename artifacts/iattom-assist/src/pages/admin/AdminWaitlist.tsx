import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Search, Mail,
  Users, UserCheck, UserX, ChevronDown, MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WaitlistEntry {
  id: number;
  email: string;
  name: string | null;
  message: string | null;
  status: "pending" | "approved" | "denied";
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

function StatusBadge({ status }: { status: WaitlistEntry["status"] }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
        <CheckCircle2 className="w-2.5 h-2.5" /> Aprovado
      </span>
    );
  if (status === "denied")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">
        <XCircle className="w-2.5 h-2.5" /> Negado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
      <Clock className="w-2.5 h-2.5" /> Pendente
    </span>
  );
}

export function AdminWaitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | WaitlistEntry["status"]>("all");
  const [actioning, setActioning] = useState<number | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/waitlist", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.waitlist);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const review = async (id: number, status: "approved" | "denied") => {
    setActioning(id);
    try {
      await fetch(`/api/admin/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status, reviewedAt: new Date().toISOString() } : e)),
      );
    } finally {
      setActioning(null);
    }
  };

  const grantAccess = async () => {
    if (!grantEmail.trim()) return;
    setGranting(true);
    try {
      const res = await fetch("/api/admin/waitlist/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: grantEmail.trim() }),
      });
      if (res.ok) {
        setGrantEmail("");
        fetchEntries();
      }
    } finally {
      setGranting(false);
    }
  };

  const filtered = entries.filter((e) => {
    const matchesSearch =
      !search ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.name && e.name.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === "all" || e.status === filter;
    return matchesSearch && matchesFilter;
  });

  const counts = {
    all: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    approved: entries.filter((e) => e.status === "approved").length,
    denied: entries.filter((e) => e.status === "denied").length,
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Beta</p>
            <h2 className="text-2xl font-bold text-white mb-1">Lista de Espera</h2>
            <p className="text-muted-foreground text-sm">
              Aprovar ou negar acesso para participantes beta.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEntries}
            disabled={isLoading}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: "all", label: "Total", icon: Users, color: "text-zinc-400", bg: "bg-white/5 border-white/[0.06]" },
          { key: "pending", label: "Pendente", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/10" },
          { key: "approved", label: "Aprovado", icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/10" },
          { key: "denied", label: "Negado", icon: UserX, color: "text-red-400", bg: "bg-red-500/5 border-red-500/10" },
        ] as const).map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.key}
              onClick={() => setFilter(stat.key)}
              className={`p-4 rounded-xl border text-left transition-all ${stat.bg} ${filter === stat.key ? "ring-1 ring-primary/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${stat.color}`} />
                {filter === stat.key && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </div>
              <p className="text-xl font-bold text-white tabular-nums">{counts[stat.key]}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">{stat.label}</p>
            </button>
          );
        })}
      </div>

      {/* Grant direct access */}
      <Card className="bg-[#111111] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-zinc-400">Liberar Acesso Beta Direto</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-zinc-600 mb-3">
            Aprovar um usuário diretamente pelo endereço de e-mail (independentemente de ter entrado na lista de espera).
          </p>
          <div className="flex gap-2">
            <Input
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-[#0a0a0a] border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-700 h-9"
              onKeyDown={(e) => e.key === "Enter" && grantAccess()}
            />
            <Button
              onClick={grantAccess}
              disabled={!grantEmail.trim() || granting}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-black font-semibold shrink-0"
            >
              {granting ? "Liberando..." : "Liberar Acesso"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por e-mail ou nome..."
          className="pl-9 bg-[#111111] border-white/[0.06] text-sm text-zinc-200 placeholder:text-zinc-700"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/[0.03] border border-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">
          <Mail className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum registro encontrado na lista de espera</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[#111111] border border-white/[0.05] hover:border-white/[0.09] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-primary">
                  {(entry.name || entry.email)[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-zinc-200 truncate">
                    {entry.name || entry.email}
                  </p>
                  <StatusBadge status={entry.status} />
                </div>
                <p className="text-xs text-zinc-600 truncate">{entry.email}</p>
                {entry.message && (
                  <p className="text-xs text-zinc-500 truncate mt-0.5 italic">"{entry.message}"</p>
                )}
              </div>
              <p className="text-[10px] text-zinc-700 shrink-0 hidden sm:block">
                {new Date(entry.createdAt).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {entry.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => review(entry.id, "approved")}
                      disabled={actioning === entry.id}
                      className="h-7 px-2.5 text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 font-semibold"
                      variant="outline"
                    >
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => review(entry.id, "denied")}
                      disabled={actioning === entry.id}
                      className="h-7 px-2.5 text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 font-semibold"
                      variant="outline"
                    >
                      Negar
                    </Button>
                  </>
                )}
                {entry.status !== "pending" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-600 hover:text-zinc-300">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#111111] border-white/[0.10]">
                      {entry.status === "approved" && (
                        <DropdownMenuItem
                          onClick={() => review(entry.id, "denied")}
                          className="text-red-400 focus:text-red-400 focus:bg-red-400/10 text-xs cursor-pointer"
                        >
                          Revogar acesso
                        </DropdownMenuItem>
                      )}
                      {entry.status === "denied" && (
                        <DropdownMenuItem
                          onClick={() => review(entry.id, "approved")}
                          className="text-emerald-400 focus:text-emerald-400 focus:bg-emerald-400/10 text-xs cursor-pointer"
                        >
                          Aprovar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
