import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  streaming?: boolean;
}

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content: "Olá, eu sou o IAttom.\n\nPosso ajudar com qualquer dúvida relacionada ao IAttom Assist.",
};

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface IAttomHelpPanelProps {
  open: boolean;
  onClose: () => void;
}

export function IAttomHelpPanel({ open, onClose }: IAttomHelpPanelProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 320);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 112) + "px";
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch(`${BASE_URL}/api/help/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        credentials: "include",
      });

      if (!res.ok || !res.body) throw new Error("Erro na resposta.");

      const reader = res.body.getReader();
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
            const data = JSON.parse(line.slice(6)) as { type: string; content?: string };
            if (data.type === "chunk" && data.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data.content }
                    : m
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
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m
        )
      );
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
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
                  <p className="text-[10px] text-zinc-600 leading-none mt-0.5">Assistente IAttom Assist</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all"
                aria-label="Fechar IAttom Help"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 sidebar-scroll">
              {messages.map((msg) => (
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
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </span>
                    )}
                    {msg.streaming && msg.content !== "" && (
                      <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-5 pt-3 border-t border-white/[0.07] shrink-0">
              <div className="flex items-end gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 focus-within:border-primary/25 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoResize(e.target);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte algo sobre o IAttom Assist..."
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none leading-relaxed overflow-y-auto sidebar-scroll"
                  style={{ minHeight: "20px", maxHeight: "112px" }}
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-black shrink-0 mb-0.5 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all"
                  aria-label="Enviar mensagem"
                >
                  {loading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
              <p className="text-[10px] text-zinc-700 mt-2 text-center">
                Enter para enviar · Shift+Enter para nova linha
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
