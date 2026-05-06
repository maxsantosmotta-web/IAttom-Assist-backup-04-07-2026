import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Check, CheckCheck, ExternalLink, Trophy, Info, AlertTriangle, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const typeIcon: Record<string, React.ElementType> = {
  achievement: Trophy,
  success: Check,
  warning: AlertTriangle,
  info: Info,
};

const typeColor: Record<string, string> = {
  achievement: "text-primary bg-primary/15 border-primary/25",
  success: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  warning: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  info: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setNotifications(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = async (id: number) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/read-all", { method: "POST" });
  };

  const dismiss = async (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen((v) => !v); if (!open) fetchNotifications(); }}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/[0.06] transition-colors text-zinc-500 hover:text-zinc-300"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-2 w-80 bg-[#111111] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-300">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 leading-tight">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-primary transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-700">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-5 h-5 text-zinc-700" />
                  </div>
                  <p className="text-xs text-zinc-600 font-medium">No notifications yet</p>
                  <p className="text-[10px] text-zinc-700 mt-1">We'll notify you about important updates</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const Icon = typeIcon[n.type] ?? Info;
                  const colors = typeColor[n.type] ?? typeColor.info;
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.05] transition-colors group ${
                        n.read ? "opacity-60" : "bg-white/[0.01]"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${colors}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-200 leading-snug">{n.title}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-zinc-700">{timeAgo(n.createdAt)}</span>
                          {n.link && (
                            <Link href={n.link} onClick={() => { markRead(n.id); setOpen(false); }}
                              className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 transition-colors">
                              <ExternalLink className="w-2.5 h-2.5" />
                              View
                            </Link>
                          )}
                          {!n.read && (
                            <button onClick={() => markRead(n.id)} className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors">
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => dismiss(n.id)}
                        className="w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
                <p className="text-[10px] text-zinc-700 text-center">{notifications.length} notification{notifications.length !== 1 ? "s" : ""} total</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
