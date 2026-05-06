import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, LayoutDashboard, Sparkles, FileText, CheckCircle,
  Megaphone, Video, FolderOpen, Clock, Zap, CreditCard, Settings,
  ArrowRight, Command, BookMarked, BarChart2, Bell,
} from "lucide-react";

const ALL_PAGES = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, desc: "Dashboard overview", keywords: "home dashboard" },
  { href: "/dashboard/find-products", label: "Find Products", icon: Search, desc: "AI product discovery", keywords: "find product discovery" },
  { href: "/dashboard/validate-products", label: "Validate Products", icon: CheckCircle, desc: "Test market demand", keywords: "validate market" },
  { href: "/dashboard/create-campaign", label: "Create Campaign", icon: Megaphone, desc: "Launch marketing campaigns", keywords: "campaign marketing" },
  { href: "/dashboard/create-content", label: "Create Content", icon: FileText, desc: "Generate compelling copy", keywords: "content copy writing" },
  { href: "/dashboard/creative-generator", label: "Creative Generator", icon: Sparkles, desc: "Design visual creatives", keywords: "creative design visual" },
  { href: "/dashboard/video-scripts", label: "Video Scripts", icon: Video, desc: "Write viral video scripts", keywords: "video script" },
  { href: "/dashboard/projects", label: "Projects", icon: FolderOpen, desc: "Manage your projects", keywords: "projects workspace" },
  { href: "/dashboard/history", label: "History", icon: Clock, desc: "AI activity timeline", keywords: "history activity log" },
  { href: "/dashboard/credits", label: "Credits", icon: Zap, desc: "View credit balance", keywords: "credits balance" },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard, desc: "Manage subscription", keywords: "billing subscription plan upgrade" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, desc: "Account preferences", keywords: "settings account profile" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2, desc: "Your usage insights", keywords: "analytics insights stats" },
  { href: "/dashboard/prompts", label: "Saved Prompts", icon: BookMarked, desc: "Your prompt library", keywords: "prompts saved library" },
];

function score(item: typeof ALL_PAGES[0], q: string): number {
  const lq = q.toLowerCase();
  const label = item.label.toLowerCase();
  const desc = item.desc.toLowerCase();
  const kw = item.keywords;
  if (label === lq) return 100;
  if (label.startsWith(lq)) return 80;
  if (label.includes(lq)) return 60;
  if (desc.includes(lq)) return 40;
  if (kw.includes(lq)) return 30;
  return 0;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? ALL_PAGES
        .map((p) => ({ ...p, s: score(p, query) }))
        .filter((p) => p.s > 0)
        .sort((a, b) => b.s - a.s)
    : ALL_PAGES;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const navigate = useCallback((href: string) => {
    setLocation(href);
    onClose();
  }, [setLocation, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[activeIndex]) navigate(filtered[activeIndex].href);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, filtered, activeIndex, navigate, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[201] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto w-full max-w-lg bg-[#111111] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08]">
                <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages and actions..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
                />
                <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-zinc-600 bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 font-mono">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <p className="text-center text-sm text-zinc-600 py-10">No results for "{query}"</p>
                ) : (
                  <>
                    {!query && (
                      <p className="px-4 py-1.5 text-[9px] font-black tracking-widest text-zinc-700 uppercase">
                        All Pages
                      </p>
                    )}
                    {filtered.map((item, i) => {
                      const Icon = item.icon;
                      const isActive = i === activeIndex;
                      return (
                        <button
                          key={item.href}
                          data-index={i}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => navigate(item.href)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75 ${
                            isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isActive ? "bg-primary/20 border border-primary/30" : "bg-white/[0.04] border border-white/[0.08]"
                          }`}>
                            <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-zinc-500"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate transition-colors ${isActive ? "text-white" : "text-zinc-300"}`}>
                              {item.label}
                            </p>
                            <p className="text-xs text-zinc-600 truncate mt-0.5">{item.desc}</p>
                          </div>
                          {isActive && <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-3 text-[10px] text-zinc-700">
                  <span className="flex items-center gap-1">
                    <kbd className="bg-white/[0.06] border border-white/[0.08] rounded px-1 py-0.5 font-mono">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="bg-white/[0.06] border border-white/[0.08] rounded px-1 py-0.5 font-mono">↵</kbd>
                    open
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-zinc-700">
                  <Command className="w-3 h-3" />
                  <span>K</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
