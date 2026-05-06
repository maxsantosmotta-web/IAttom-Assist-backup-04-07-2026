import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare, RefreshCw, Search, Star,
  CheckCircle2, Clock, Archive, Bug, Lightbulb, Info, HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FeedbackEntry {
  id: number;
  clerkUserId: string;
  userEmail: string;
  userName: string | null;
  message: string;
  category: "bug" | "feature" | "general" | "other";
  rating: number | null;
  status: "new" | "reviewed" | "resolved";
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const CATEGORY_META: Record<FeedbackEntry["category"], { label: string; icon: React.ElementType; color: string; bg: string }> = {
  bug: { label: "Bug", icon: Bug, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  feature: { label: "Feature", icon: Lightbulb, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  general: { label: "General", icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  other: { label: "Other", icon: HelpCircle, color: "text-zinc-400", bg: "bg-white/5 border-white/10" },
};

const STATUS_META: Record<FeedbackEntry["status"], { label: string; icon: React.ElementType; color: string }> = {
  new: { label: "New", icon: Clock, color: "text-amber-400" },
  reviewed: { label: "Reviewed", icon: CheckCircle2, color: "text-blue-400" },
  resolved: { label: "Resolved", icon: Archive, color: "text-emerald-400" },
};

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3 h-3 ${s <= rating ? "text-primary fill-primary" : "text-zinc-700"}`} />
      ))}
    </div>
  );
}

export function AdminFeedback() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | FeedbackEntry["status"]>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | FeedbackEntry["category"]>("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/feedback", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.feedback);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const updateStatus = async (id: number, status: FeedbackEntry["status"]) => {
    setUpdatingId(id);
    try {
      await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = entries.filter((e) => {
    const matchesSearch =
      !search ||
      e.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      e.message.toLowerCase().includes(search.toLowerCase()) ||
      (e.userName && e.userName.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = filterStatus === "all" || e.status === filterStatus;
    const matchesCategory = filterCategory === "all" || e.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const counts = {
    new: entries.filter((e) => e.status === "new").length,
    reviewed: entries.filter((e) => e.status === "reviewed").length,
    resolved: entries.filter((e) => e.status === "resolved").length,
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Beta</p>
            <h2 className="text-2xl font-bold text-white mb-1">Feedback</h2>
            <p className="text-muted-foreground text-sm">
              Review and manage feedback submitted by beta users.
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
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "all", label: `All (${entries.length})` },
          { key: "new", label: `New (${counts.new})` },
          { key: "reviewed", label: `Reviewed (${counts.reviewed})` },
          { key: "resolved", label: `Resolved (${counts.resolved})` },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              filterStatus === f.key
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-white/[0.03] border-white/[0.07] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        {(["all", "bug", "feature", "general", "other"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all capitalize ${
              filterCategory === cat
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-white/[0.03] border-white/[0.07] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {cat === "all" ? "All types" : CATEGORY_META[cat].label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search feedback..."
          className="pl-9 bg-[#111111] border-white/[0.06] text-sm text-zinc-200 placeholder:text-zinc-700"
        />
      </div>

      {/* Entries */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/[0.03] border border-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">
          <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No feedback found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const catMeta = CATEGORY_META[entry.category];
            const statMeta = STATUS_META[entry.status];
            const CatIcon = catMeta.icon;
            const StatIcon = statMeta.icon;
            const isExpanded = expanded === entry.id;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl bg-[#111111] border transition-colors ${
                  isExpanded ? "border-white/[0.10]" : "border-white/[0.05] hover:border-white/[0.09]"
                }`}
              >
                <button
                  className="w-full flex items-start gap-4 px-4 py-3.5 text-left"
                  onClick={() => setExpanded(isExpanded ? null : entry.id)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${catMeta.bg}`}>
                    <CatIcon className={`w-3.5 h-3.5 ${catMeta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-[11px] font-semibold text-zinc-300">
                        {entry.userName || entry.userEmail}
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${catMeta.bg} ${catMeta.color}`}>
                        {catMeta.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${statMeta.color}`}>
                        <StatIcon className="w-2.5 h-2.5" />
                        {statMeta.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">{entry.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StarRating rating={entry.rating} />
                    <p className="text-[10px] text-zinc-700">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
                    <p className="text-xs text-zinc-300 leading-relaxed mb-3">{entry.message}</p>
                    <p className="text-[11px] text-zinc-600 mb-3">{entry.userEmail}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-zinc-500 font-medium">Status:</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingId === entry.id}
                            className="h-7 px-2.5 text-[11px] border-white/10 text-zinc-400 hover:text-white"
                          >
                            <StatIcon className={`w-3 h-3 mr-1.5 ${statMeta.color}`} />
                            {statMeta.label}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-[#111111] border-white/[0.10]">
                          {(["new", "reviewed", "resolved"] as const).map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => updateStatus(entry.id, s)}
                              className={`text-xs cursor-pointer ${STATUS_META[s].color} focus:${STATUS_META[s].color}`}
                            >
                              {STATUS_META[s].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
