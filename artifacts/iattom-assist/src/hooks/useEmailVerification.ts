import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSendVerificationCode,
  useVerifyCode,
  getGetMeQueryKey,
} from "@workspace/api-client-react";

export type VerificationStep =
  | "idle"
  | "sending"
  | "awaiting_code"
  | "verifying"
  | "confirmed"
  | "error"
  | "expired";

export interface UseEmailVerificationReturn {
  step: VerificationStep;
  error: string | null;
  resendCooldown: number;
  sendCode: () => Promise<void>;
  resendCode: () => Promise<void>;
  verify: (code: string) => Promise<void>;
  reset: () => void;
  isSending: boolean;
  isVerifying: boolean;
  isConfirmed: boolean;
  isExpired: boolean;
  canResend: boolean;
}

const RESEND_COOLDOWN_SECS = 60;

function extractErrorCode(err: unknown): string | null {
  if (err && typeof err === "object") {
    const d = (err as { data?: { error?: string } }).data;
    if (typeof d?.error === "string") return d.error;
  }
  return null;
}

export function useEmailVerification(): UseEmailVerificationReturn {
  const [step, setStep] = useState<VerificationStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startCooldown = useCallback(() => {
    clearTimer();
    setResendCooldown(RESEND_COOLDOWN_SECS);
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => clearTimer(), []);

  const sendMutation = useSendVerificationCode();
  const verifyMutation = useVerifyCode();

  const sendCode = useCallback(async () => {
    setError(null);
    setStep("sending");
    try {
      await sendMutation.mutateAsync();
      setStep("awaiting_code");
      startCooldown();
    } catch {
      setStep("error");
      setError("Não foi possível enviar o código. Tente novamente.");
    }
  }, [sendMutation, startCooldown]);

  const resendCode = useCallback(async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setStep("sending");
    try {
      await sendMutation.mutateAsync();
      setStep("awaiting_code");
      startCooldown();
    } catch {
      setStep("awaiting_code");
      setError("Falha ao reenviar o código. Tente novamente.");
    }
  }, [sendMutation, startCooldown, resendCooldown]);

  const verify = useCallback(
    async (code: string) => {
      setError(null);
      setStep("verifying");
      try {
        await verifyMutation.mutateAsync({ data: { code } });
        setStep("confirmed");
        void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      } catch (err: unknown) {
        const errCode = extractErrorCode(err);
        if (errCode === "code_expired") {
          setStep("expired");
          setError("Código expirado. Solicite um novo código.");
        } else if (errCode === "invalid_code") {
          setStep("awaiting_code");
          setError("Código incorreto. Verifique e tente novamente.");
        } else if (errCode === "no_pending_code") {
          setStep("expired");
          setError("Nenhum código ativo encontrado. Solicite um novo.");
        } else {
          setStep("awaiting_code");
          setError("Falha na verificação. Tente novamente.");
        }
      }
    },
    [verifyMutation, queryClient],
  );

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    clearTimer();
    setResendCooldown(0);
  }, []);

  return {
    step,
    error,
    resendCooldown,
    sendCode,
    resendCode,
    verify,
    reset,
    isSending: step === "sending",
    isVerifying: step === "verifying",
    isConfirmed: step === "confirmed",
    isExpired: step === "expired",
    canResend: resendCooldown === 0 && step !== "sending" && step !== "verifying",
  };
}
