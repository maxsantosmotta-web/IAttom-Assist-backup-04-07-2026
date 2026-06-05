import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Trash2, RefreshCw } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { useUser } from "@clerk/react";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  streaming?: boolean;
}

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function getGreeting(name: string): Message {
  return {
    id: "init",
    role: "assistant",
    content: `Olá, ${name}.\nSou o IAttom.\nComo posso ajudar você hoje?`,
  };
}

type SyncStatus = "idle" | "syncing" | "done" | "error";

interface IAttomHelpPanelProps {
  open: boolean;
  onClose: () => void;
  /** When true the panel appears instantly (no slide-in) — used on session restore / pull-to-refresh */
  skipEntryAnimation?: boolean;
}

export function IAttomHelpPanel({ open, onClose, skipEntryAnimation = false }: IAttomHelpPanelProps) {
  const { user } = useUser();
  const userId = user?.id;
  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || "você";

  // ── Stable refs — consumed by callbacks without creating hook dependencies ──
  const firstNameRef = useRef(firstName);
  const messagesRef  = useRef<Message[]>([]);

  const [messages,      setMessages]      = useState<Message[]>([getGreeting("você")]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [syncStatus,    setSyncStatus]    = useState<SyncStatus>("idle");
  const [syncDoneLabel, setSyncDoneLabel] = useState("Atualizado agora");
  const [confirmClear,  setConfirmClear]  = useState(false);

  const messagesEndRef     = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef           = useRef<HTMLTextAreaElement>(null);

  // Tracks the Promise of the in-flight POST /api/help/save.
  // syncHistory awaits this before fetching — eliminates the race condition.
  const pendingSaveRef = useRef<Promise<void>>(Promise.resolve());
  // Auto-reset timer for syncStatus="done"
  const syncDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { firstNameRef.current = firstName; }, [firstName]);
  useEffect(() => { messagesRef.current  = messages;  }, [messages]);

  // Cleanup sync timer on unmount
  useEffect(() => () => {
    if (syncDoneTimerRef.current) clearTimeout(syncDoneTimerRef.current);
  }, []);

  // ── Smart scroll ────────────────────────────────────────────────────────────
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // ── loadHistory — STABLE (empty deps, uses refs) ───────────────────────────
  // Returns true on API success, false on network/server error.
  const loadHistory = useCallback(
    (showGreetingIfEmpty: boolean, skipIfIdentical = false): Promise<boolean> => {
      return fetch(`${BASE_URL}/api/help/history`, { credentials: "include" })
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{ id: number; role: string; content: string }[]>)
            : Promise.reject(new Error(`HTTP ${r.status}`))
        )
        .then((data) => {
          if (data && data.length > 0) {
            if (skipIfIdentical) {
              const curr = messagesRef.current;
              const isSame =
                data.length === curr.length &&
                data.every((item, i) => String(item.id) === curr[i]?.id);
              if (isSame) return true;
            }
            setMessages(
              data.map((m) => ({
                id: String(m.id),
                role: m.role as "user" | "assistant",
                content: m.content,
              }))
            );
          } else if (showGreetingIfEmpty) {
            setMessages([getGreeting(firstNameRef.current)]);
          }
          return true;
        })
        .catch(() => {
          if (showGreetingIfEmpty) setMessages([getGreeting(firstNameRef.current)]);
          return false;
        });
    },
    []
  );

  // ── Initial load — only fires when userId changes ─────────────────────────
  useEffect(() => {
    if (!userId) return;
    setHistoryLoaded(false);
    loadHistory(true).finally(() => setHistoryLoaded(true));
  }, [userId, loadHistory]);

  useEffect(() => {
    if (historyLoaded) setTimeout(() => scrollToBottom("auto"), 50);
  }, [historyLoaded, scrollToBottom]);

  useEffect(() => {
    if (isNearBottom()) scrollToBottom("smooth");
  }, [messages, isNearBottom, scrollToBottom]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 320);
  }, [open]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 112) + "px";
  };

  // ── Sincronizar — awaits pending save, calls real API, shows real feedback ──
  // "Sincronizando..." while request is in flight.
  // "Atualizado às HH:mm" on success (real API response, not a fake timeout).
  // "Erro ao sincronizar" if the GET /api/help/history call fails.
  const syncHistory = useCallback(async () => {
    if (syncStatus !== "idle" || loading || !historyLoaded) return;
    await pendingSaveRef.current;
    setSyncStatus("syncing");
    const success = await loadHistory(false, true);
    if (success) {
      const now = new Date();
      const hhmm = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setSyncDoneLabel(`Atualizado às ${hhmm}`);
      setSyncStatus("done");
      if (syncDoneTimerRef.current) clearTimeout(syncDoneTimerRef.current);
      syncDoneTimerRef.current = setTimeout(() => setSyncStatus("idle"), 2200);
    } else {
      setSyncStatus("error");
      if (syncDoneTimerRef.current) clearTimeout(syncDoneTimerRef.current);
      syncDoneTimerRef.current = setTimeout(() => setSyncStatus("idle"), 2500);
    }
  }, [syncStatus, loading, historyLoaded, loadHistory]);

  // ── saveExchange ───────────────────────────────────────────────────────────
  const saveExchange = (userContent: string, assistantContent: string): void => {
    if (!assistantContent) return;
    pendingSaveRef.current = fetch(`${BASE_URL}/api/help/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: userContent, assistantMessage: assistantContent }),
      credentials: "include",
    })
      .then(() => undefined)
      .catch(() => undefined);
  };

  // ── Limpar conversa ─────────────────────────────────────────────────────────
  const clearConversation = async () => {
    try {
      await fetch(`${BASE_URL}/api/help/history`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      // reset state regardless
    }
    setMessages([getGreeting(firstNameRef.current)]);
    setConfirmClear(false);
  };

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };

    const history = messages
      .filter((m) => !m.streaming && m.content !== "" && m.id !== "init")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    setTimeout(() => scrollToBottom("smooth"), 30);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    let finalAssistantContent = "";

    try {
      const res = await fetch(`${BASE_URL}/api/help/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        credentials: "include",
      });

      if (!res.ok || !res.body) throw new Error("Erro na resposta.");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
              message?: string;
            };
            if (data.type === "chunk" && data.content) {
              finalAssistantContent += data.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + data.content } : m
                )
              );
            } else if (data.type === "error" && data.message) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: data.message! } : m
                )
              );
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Não foi possível processar sua mensagem. Tente novamente." }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      );
      setLoading(false);
      if (finalAssistantContent) saveExchange(text, finalAssistantContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const hasHistory =
    messages.length > 1 ||
    (messages.length === 1 && messages[0].id !== "init");

  // Subtitle shown below the panel title — shows sync status feedback
  const subtitleText =
    syncStatus === "syncing" ? "Sincronizando..." :
    syncStatus === "done"    ? syncDoneLabel :
    syncStatus === "error"   ? "Erro ao sincronizar" :
    "Assistente IAttom Assist";

  const subtitleColor =
    syncStatus === "syncing" ? "text-zinc-400" :
    syncStatus === "done"    ? "text-primary/70" :
    syncStatus === "error"   ? "text-red-400/80" :
    "text-zinc-600";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={skipEntryAnimation ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          {/* Panel — initial={false} skips slide-in on session restore (pull-to-refresh fix) */}
          <motion.div
            initial={skipEntryAnimation ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[400px] flex flex-col bg-[#0a0a0a] border-l border-white/[0.07] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <LogoMark size={20} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white leading-tight">IAttom</p>
                  <p className={`text-[10px] leading-none mt-0.5 transition-colors duration-300 ${subtitleColor}`}>
                    {subtitleText}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {confirmClear ? (
                  <>
                    <span className="text-[11px] text-zinc-400 mr-1 whitespace-nowrap">
                      Apagar conversa?
                    </span>
                    <button
                      onClick={() => void clearConversation()}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md text-zinc-400 hover:bg-white/[0.06] transition-all"
                    >
                      Não
                    </button>
                  </>
                ) : (
                  <>
                    {/* Sincronizar */}
                    <button
                      onClick={() => void syncHistory()}
                      disabled={syncStatus !== "idle" || loading || !historyLoaded}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed
                        ${syncStatus === "done"
                          ? "text-primary/80 hover:bg-primary/10"
                          : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.06]"
                        }`}
                      title="Sincronizar conversa"
                      aria-label="Sincronizar conversa"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
                    </button>

                    {/* Excluir conversa */}
                    <button
                      onClick={() => setConfirmClear(true)}
                      disabled={loading || !hasHistory}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.06] transition-all disabled:opacity-0 disabled:pointer-events-none"
                      title="Excluir conversa"
                      aria-label="Excluir conversa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Fechar */}
                    <button
                      onClick={() => { setConfirmClear(false); onClose(); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all"
                      aria-label="Fechar IAttom Help"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-4 py-5 space-y-4 sidebar-scroll"
            >
              {!historyLoaded ? (
                <div className="flex items-center justify-center h-full">
                  <span className="inline-flex gap-1.5 items-center">
                    {([0, 150, 300] as const).map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </span>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <LogoMark size={15} />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary/10 text-zinc-200 rounded-tr-sm border border-primary/[0.15]"
                          : "bg-white/[0.04] text-zinc-300 rounded-tl-sm border border-white/[0.06]"
                      }`}
                    >
                      {msg.content}
                      {msg.streaming && msg.content === "" && (
                        <span className="inline-flex gap-1 items-center h-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      )}
                      {msg.streaming && msg.content !== "" && (
                        <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-5 pt-3 border-t border-white/[0.07] shrink-0">
              <div className="flex items-end gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 focus-within:border-primary/25 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte algo sobre o IAttom Assist..."
                  rows={1}
                  disabled={loading || !historyLoaded}
                  className="flex-1 resize-none bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none leading-relaxed overflow-y-auto sidebar-scroll"
                  style={{ minHeight: "20px", maxHeight: "112px" }}
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || loading || !historyLoaded}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-black shrink-0 mb-0.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all"
                  aria-label="Enviar mensagem"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
