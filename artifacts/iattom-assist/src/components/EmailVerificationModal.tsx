import { useState, useRef, useCallback, useEffect, ClipboardEvent, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Loader2, MailCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { useEmailVerification } from "@/hooks/useEmailVerification";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailVerificationModalProps {
  open: boolean;
  email?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// ─── OTP Input ────────────────────────────────────────────────────────────────

interface OtpInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setRef = (i: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[i] = el;
  };

  const focusAt = (i: number) => {
    const el = inputRefs.current[Math.min(Math.max(i, 0), 5)];
    el?.focus();
  };

  const handleChange = useCallback(
    (i: number, raw: string) => {
      const digit = raw.replace(/\D/g, "").slice(-1);
      const next = [...value];
      next[i] = digit;
      onChange(next);
      if (digit && i < 5) focusAt(i + 1);
    },
    [value, onChange],
  );

  const handleKeyDown = useCallback(
    (i: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (value[i]) {
          const next = [...value];
          next[i] = "";
          onChange(next);
        } else if (i > 0) {
          focusAt(i - 1);
          const next = [...value];
          next[i - 1] = "";
          onChange(next);
        }
      } else if (e.key === "ArrowLeft" && i > 0) {
        focusAt(i - 1);
      } else if (e.key === "ArrowRight" && i < 5) {
        focusAt(i + 1);
      }
    },
    [value, onChange],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (!pasted) return;
      const next = Array(6).fill("");
      pasted.split("").forEach((d, i) => { next[i] = d; });
      onChange(next);
      focusAt(Math.min(pasted.length, 5));
    },
    [onChange],
  );

  return (
    <div className="flex gap-2.5 justify-center">
      {Array(6).fill(null).map((_, i) => (
        <input
          key={i}
          ref={setRef(i)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={[
            "w-11 h-13 text-center text-xl font-bold rounded-xl border bg-[#111] text-white",
            "transition-all duration-150 outline-none",
            "focus:border-[#C9A84C] focus:shadow-[0_0_0_2px_rgba(201,168,76,0.18)]",
            value[i]
              ? "border-[#C9A84C]/60 text-[#E8C96A]"
              : "border-white/[0.10] text-white/60",
            disabled ? "opacity-40 cursor-not-allowed" : "cursor-text",
          ].join(" ")}
          style={{ height: "52px" }}
          aria-label={`Dígito ${i + 1} do código`}
        />
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function EmailVerificationModal({
  open,
  email,
  onClose,
  onSuccess,
}: EmailVerificationModalProps) {
  const { signOut } = useClerk();

  const {
    step,
    error,
    resendCooldown,
    sendCode,
    resendCode,
    verify,
    reset,
    isSending,
    isVerifying,
    isConfirmed,
    isExpired,
    canResend,
  } = useEmailVerification();

  // Digits state kept here so the component owns the OTP value
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      reset();
      setDigits(Array(6).fill(""));
      sendCode();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    reset();
    setDigits(Array(6).fill(""));
    onClose();
    // Encerra a sessão Clerk não confirmada. Sem signOut o usuário permanece
    // isSignedIn=true com registrationConfirmed=false e BetaGate re-exibe o
    // modal imediatamente — loop infinito. redirectUrl devolve para a landing.
    void signOut({ redirectUrl: "/" });
  };

  const handleConfirm = async () => {
    const code = digits.join("");
    if (code.length < 6) return;
    await verify(code);
  };

  // Auto-call onSuccess when confirmed
  useEffect(() => {
    if (isConfirmed) {
      setTimeout(() => {
        onSuccess?.();
      }, 1200);
    }
  }, [isConfirmed, onSuccess]);

  const isInputDisabled = isSending || isVerifying || isConfirmed || isExpired;
  const code = digits.join("");
  const isComplete = code.length === 6;

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_m, a, b, c) => a + b.replace(/./g, "*") + c)
    : "seu e-mail";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Card */}
          <motion.div
            className="relative z-10 w-full max-w-sm bg-[#0e0e0e] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Gold top accent */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent" />

            <div className="p-7">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20">
                    <MailCheck className="h-5 w-5 text-[#C9A84C]" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-white leading-tight">
                      Confirme seu acesso
                    </h2>
                    <p className="text-[12px] text-zinc-500 mt-0.5">
                      Enviamos um código para
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Email display */}
              <div className="mb-6 px-3.5 py-2.5 rounded-xl bg-[#111] border border-white/[0.06] text-center">
                <span className="text-[13px] text-zinc-400 font-mono tracking-wide">
                  {maskedEmail}
                </span>
              </div>

              {/* ── States ─────────────────────────────────────────────── */}
              <AnimatePresence mode="wait">

                {/* Sending initial code */}
                {isSending && (
                  <motion.div
                    key="sending"
                    className="flex flex-col items-center gap-3 py-6"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <Loader2 className="h-8 w-8 text-[#C9A84C] animate-spin" />
                    <p className="text-[13px] text-zinc-500">Enviando código...</p>
                  </motion.div>
                )}

                {/* Awaiting / Verifying */}
                {(step === "awaiting_code" || isVerifying) && (
                  <motion.div
                    key="input"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <p className="text-[12px] text-zinc-500 text-center mb-4">
                      Digite o código de 6 dígitos
                    </p>

                    <OtpInput
                      value={digits}
                      onChange={setDigits}
                      disabled={isInputDisabled}
                    />

                    {/* Error message */}
                    {error && (
                      <motion.p
                        className="mt-3 text-[12px] text-red-400 text-center"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {error}
                      </motion.p>
                    )}

                    {/* Confirm button */}
                    <Button
                      onClick={handleConfirm}
                      disabled={!isComplete || isVerifying}
                      className="mt-5 w-full bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black font-bold text-[13px] h-11 rounded-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isVerifying ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verificando...
                        </span>
                      ) : (
                        "Confirmar"
                      )}
                    </Button>

                    {/* Resend */}
                    <div className="mt-4 text-center">
                      {resendCooldown > 0 ? (
                        <p className="text-[12px] text-zinc-600">
                          Reenviar em{" "}
                          <span className="text-zinc-400 tabular-nums">
                            {resendCooldown}s
                          </span>
                        </p>
                      ) : (
                        <button
                          onClick={resendCode}
                          disabled={!canResend}
                          className="text-[12px] text-zinc-500 hover:text-[#C9A84C] transition-colors flex items-center gap-1.5 mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reenviar código
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Expired */}
                {isExpired && (
                  <motion.div
                    key="expired"
                    className="flex flex-col items-center gap-4 py-4"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <ShieldAlert className="h-6 w-6 text-amber-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-[14px] font-medium text-white mb-1">
                        Código expirado
                      </p>
                      <p className="text-[12px] text-zinc-500">
                        {error ?? "Solicite um novo código para continuar."}
                      </p>
                    </div>
                    <Button
                      onClick={() => { resendCode(); setDigits(Array(6).fill("")); }}
                      className="mt-1 w-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-[#C9A84C] text-[13px] h-10 rounded-xl hover:bg-[#C9A84C]/25 transition-all font-semibold"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-2" />
                      Solicitar novo código
                    </Button>
                  </motion.div>
                )}

                {/* Error fallback (send failed entirely) */}
                {step === "error" && (
                  <motion.div
                    key="error"
                    className="flex flex-col items-center gap-4 py-4"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
                      <ShieldAlert className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-[14px] font-medium text-white mb-1">
                        Algo deu errado
                      </p>
                      <p className="text-[12px] text-zinc-500">
                        {error ?? "Não foi possível enviar o código."}
                      </p>
                    </div>
                    <Button
                      onClick={() => { reset(); setDigits(Array(6).fill("")); sendCode(); }}
                      className="mt-1 w-full bg-white/[0.06] border border-white/[0.10] text-zinc-300 text-[13px] h-10 rounded-xl hover:bg-white/[0.10] transition-all"
                    >
                      Tentar novamente
                    </Button>
                  </motion.div>
                )}

                {/* Confirmed */}
                {isConfirmed && (
                  <motion.div
                    key="confirmed"
                    className="flex flex-col items-center gap-3 py-6"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30"
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-[15px] font-semibold text-white mb-1">
                        Acesso confirmado
                      </p>
                      <p className="text-[12px] text-zinc-500">
                        Seu cadastro foi verificado com sucesso.
                      </p>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>

              {/* Footer note */}
              {(step === "awaiting_code" || isVerifying) && (
                <p className="mt-5 text-[11px] text-zinc-700 text-center leading-relaxed">
                  Verifique também sua pasta de spam.
                  <br />O código é válido por 10 minutos.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
