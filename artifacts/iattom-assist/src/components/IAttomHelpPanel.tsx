import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Trash2, RefreshCw, Paperclip } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { useUser } from "@clerk/react";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  streaming?: boolean;
  /** Data URLs for images attached by the user — display only, not persisted */
  imageUrls?: string[];
}

interface AttachedImage {
  dataUrl: string;
  name: string;
  /** GCS serving URL — populated after eager upload completes */
  storageUrl?: string;
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

  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

  const messagesEndRef     = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef           = useRef<HTMLTextAreaElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);

  // AbortController for the in-flight /help/chat SSE request
  const abortControllerRef = useRef<AbortController | null>(null);
  // Tracks whether component is still mounted — guards setState after unmount
  const mountedRef         = useRef(true);

  // Tracks the Promise of the in-flight POST /api/help/save.
  // syncHistory awaits this before fetching — eliminates the race condition.
  const pendingSaveRef = useRef<Promise<void>>(Promise.resolve());
  // Auto-reset timer for syncStatus="done"
  const syncDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { firstNameRef.current = firstName; }, [firstName]);
  useEffect(() => { messagesRef.current  = messages;  }, [messages]);

  // Mount/unmount lifecycle — abort any in-flight stream on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

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
            ? (r.json() as Promise<{ id: number; role: string; content: string; imageUrls?: string[] }[]>)
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
                ...(m.imageUrls && m.imageUrls.length > 0 ? { imageUrls: m.imageUrls } : {}),
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

  // ── Sincronizar — real API call + minimum overlay display time ──────────────
  // Shows overlay over the messages area during the full sync cycle.
  // "Sincronizando conversa..." while in flight (minimum 600ms visible).
  // "Conversa atualizada" on success (visible 900ms before dismissing).
  // "Não foi possível sincronizar agora." on error (visible 2200ms).
  const syncHistory = useCallback(async () => {
    if (syncStatus !== "idle" || loading || !historyLoaded) return;
    await pendingSaveRef.current;
    setSyncStatus("syncing");
    // Guarantee minimum visual time even if API responds instantly
    const MIN_MS = 600;
    const [success] = await Promise.all([
      loadHistory(false, true),
      new Promise<void>((resolve) => setTimeout(resolve, MIN_MS)),
    ]);
    if (syncDoneTimerRef.current) clearTimeout(syncDoneTimerRef.current);
    if (success) {
      const now = new Date();
      const hhmm = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setSyncDoneLabel(`Atualizado às ${hhmm}`);
      setSyncStatus("done");
      syncDoneTimerRef.current = setTimeout(() => setSyncStatus("idle"), 900);
    } else {
      setSyncStatus("error");
      syncDoneTimerRef.current = setTimeout(() => setSyncStatus("idle"), 2200);
    }
  }, [syncStatus, loading, historyLoaded, loadHistory]);

  // ── saveExchange ───────────────────────────────────────────────────────────
  const saveExchange = (userContent: string, assistantContent: string, imageUrls?: string[]): void => {
    if (!assistantContent) return;
    pendingSaveRef.current = fetch(`${BASE_URL}/api/help/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage: userContent,
        assistantMessage: assistantContent,
        ...(imageUrls && imageUrls.length > 0 ? { imageUrls } : {}),
      }),
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

  // ── File selection handler (up to 10 images, with eager GCS upload) ──────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Reset the input so the same files can be re-selected later
    (e.target as HTMLInputElement).value = "";
    if (files.length === 0) return;

    const MAX_IMAGES = 10;
    const current = attachedImages.length;
    const slots = MAX_IMAGES - current;
    if (slots <= 0) return; // already at limit

    const eligible = files
      .filter((f) => f.type.startsWith("image/") && f.size <= 5_000_000)
      .slice(0, slots);

    if (eligible.length === 0) return;

    const startIdx = current;

    const readers = eligible.map(
      (file) =>
        new Promise<AttachedImage>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) resolve({ dataUrl, name: file.name });
          };
          reader.readAsDataURL(file);
        }),
    );

    void Promise.all(readers).then((newImages) => {
      setAttachedImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));

      // Eager upload to GCS — runs in background, non-blocking
      // By the time the user hits send, storageUrl is typically already populated
      void (async () => {
        try {
          const uploadRes = await fetch(`${BASE_URL}/api/help/images/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: newImages.map((i) => i.dataUrl) }),
            credentials: "include",
          });
          if (!uploadRes.ok) return;
          const { urls } = (await uploadRes.json()) as { urls: string[] };
          setAttachedImages((curr) => {
            const result = [...curr];
            urls.forEach((url, i) => {
              const idx = startIdx + i;
              if (idx < result.length) result[idx] = { ...result[idx], storageUrl: url };
            });
            return result;
          });
        } catch {
          // Upload failed — images still visible this session but won't persist after reload
        }
      })();
    });
  };

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && attachedImages.length === 0) || loading) return;

    const snapshots = [...attachedImages];
    // storageUrls: GCS URLs for persistence. Populated if eager upload already completed.
    const storageUrls = snapshots.map((s) => s.storageUrl).filter((u): u is string => !!u);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      // Display: prefer storageUrl (will survive reload), fall back to dataUrl (session only)
      ...(snapshots.length > 0
        ? { imageUrls: snapshots.map((s) => s.storageUrl || s.dataUrl) }
        : {}),
    };

    // Build history — include imageUrls only for the last user message that has them.
    // All other history messages are text-only to keep token cost bounded.
    const historySlice = messages
      .filter((m) => !m.streaming && m.content !== "" && m.id !== "init")
      .slice(-6);

    // Index of the last user message in the slice that carries imageUrls
    const lastImgIdx = historySlice.reduce<number>((found, m, i) => {
      if (m.role === "user" && m.imageUrls && m.imageUrls.length > 0) return i;
      return found;
    }, -1);

    const history = historySlice.map((m, i) => ({
      role: m.role,
      content: m.content,
      ...(i === lastImgIdx && m.imageUrls && m.imageUrls.length > 0
        ? { imageUrls: m.imageUrls }
        : {}),
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedImages([]);
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    setTimeout(() => scrollToBottom("smooth"), 30);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    let finalAssistantContent = "";
    let streamCompleted = false;

    // Abort any previous in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      // Always send dataUrls to OpenAI (base64 required for vision)
      const body: Record<string, unknown> = { message: text, history };
      if (snapshots.length > 0) body.images = snapshots.map((i) => i.dataUrl);

      // ── [HELP DEBUG] Diagnóstico de payload outgoing ──────────────────────
      console.log("[HELP DEBUG] outgoing history count", history.length);
      console.log("[HELP DEBUG] outgoing history", history);
      console.log("[HELP DEBUG] outgoing imageUrls in history", history.map((h) => (h as { imageUrls?: string[] }).imageUrls));
      console.log("[HELP DEBUG] outgoing images current", snapshots.length);
      console.log("[HELP DEBUG] attachedImages snapshots", snapshots.map((s) => ({ name: s.name, hasDataUrl: !!s.dataUrl, hasStorageUrl: !!(s as { storageUrl?: string }).storageUrl })));
      // ─────────────────────────────────────────────────────────────────────

      const res = await fetch(`${BASE_URL}/api/help/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
        signal: ac.signal,
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
              if (mountedRef.current) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + data.content } : m
                  )
                );
              }
            } else if (data.type === "done") {
              streamCompleted = true;
            } else if (data.type === "error" && data.message) {
              if (mountedRef.current) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: data.message! } : m
                  )
                );
              }
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      // Request aborted (component unmounted or new message sent) — do not update UI
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (mountedRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: finalAssistantContent
                  ? finalAssistantContent + "\n\n(resposta interrompida — tente novamente)"
                  : "Não foi possível processar sua mensagem. Tente novamente." }
              : m
          )
        );
      }
    } finally {
      if (mountedRef.current) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
        );
        setLoading(false);
        // Only save if there is content and component is still mounted
        if (finalAssistantContent) {
          const contentToSave = streamCompleted
            ? finalAssistantContent
            : finalAssistantContent + "\n\n(resposta interrompida — tente novamente)";
          saveExchange(text, contentToSave, storageUrls.length > 0 ? storageUrls : undefined);
        }
      }
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

            {/* Messages — relative wrapper hosts the sync overlay */}
            <div className="flex-1 relative min-h-0">

              {/* Sync overlay — visible during "syncing", "done", "error" */}
              <AnimatePresence>
                {syncStatus !== "idle" && (
                  <motion.div
                    key="sync-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]/80 backdrop-blur-[2px]"
                  >
                    {syncStatus === "syncing" && (
                      <>
                        <RefreshCw className="w-5 h-5 text-primary/70 animate-spin" />
                        <p className="text-[12px] text-zinc-400 font-medium tracking-wide">
                          Sincronizando conversa...
                        </p>
                      </>
                    )}
                    {syncStatus === "done" && (
                      <p className="text-[12px] text-primary/80 font-medium tracking-wide">
                        Conversa atualizada
                      </p>
                    )}
                    {syncStatus === "error" && (
                      <p className="text-[12px] text-red-400/90 font-medium tracking-wide">
                        Não foi possível sincronizar agora.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div
                ref={scrollContainerRef}
                className="h-full overflow-y-auto px-4 py-5 space-y-4 sidebar-scroll"
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
                      {msg.imageUrls && msg.imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.imageUrls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Imagem ${idx + 1}`}
                              className="max-h-40 max-w-[48%] rounded-lg object-contain border border-white/10"
                            />
                          ))}
                        </div>
                      )}
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
            </div>{/* end relative wrapper */}

            {/* Input */}
            <div className="px-4 pb-5 pt-3 border-t border-white/[0.07] shrink-0">
              {/* Image preview strip — shown above the textarea when images are attached */}
              {attachedImages.length > 0 && (
                <div className="mb-1.5 px-1">
                  {/* Count + clear all */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-500">
                      {attachedImages.length === 1
                        ? "1 imagem anexada"
                        : `${attachedImages.length} imagens anexadas`}
                      {attachedImages.length >= 10 && (
                        <span className="ml-1 text-primary/70">(limite atingido)</span>
                      )}
                    </span>
                    <button
                      onClick={() => setAttachedImages([])}
                      className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Remover todas
                    </button>
                  </div>
                  {/* Thumbnails row */}
                  <div className="flex flex-wrap gap-1.5">
                    {attachedImages.map((img, idx) => (
                      <div key={idx} className="relative shrink-0">
                        <img
                          src={img.dataUrl}
                          alt={`Imagem ${idx + 1}`}
                          className="h-14 w-14 rounded-lg object-cover border border-white/10"
                          title={img.name}
                        />
                        <button
                          onClick={() =>
                            setAttachedImages((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-700 border border-white/10 flex items-center justify-center hover:bg-zinc-600 transition-colors"
                          aria-label={`Remover imagem ${idx + 1}`}
                        >
                          <X className="w-2.5 h-2.5 text-zinc-300" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden file input — multiple selection allowed */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="flex items-end gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 focus-within:border-primary/25 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte algo... (Shift+Enter para nova linha)"
                  rows={1}
                  disabled={loading || !historyLoaded || syncStatus !== "idle"}
                  className="flex-1 resize-none bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none leading-relaxed overflow-y-auto sidebar-scroll"
                  style={{ minHeight: "20px", maxHeight: "112px" }}
                />
                {/* Attach image button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || !historyLoaded}
                  className={`relative w-7 h-7 flex items-center justify-center rounded-lg shrink-0 mb-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                    attachedImages.length > 0
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
                  }`}
                  aria-label="Anexar imagem"
                  title="Anexar imagem (máx. 5MB)"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>
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
