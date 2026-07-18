import { useState } from "react";
import { useSignIn } from "@clerk/react";
import { useLocation } from "wouter";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

const basePath = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
const dashboardPath = `${basePath}/dashboard` || "/dashboard";

type Step = "email" | "code" | "password";
type ClerkErrorLike = {
  errors?: { code?: string; message?: string; longMessage?: string }[];
  code?: string;
  message?: string;
};

function errorMessage(error: unknown, fallback: string): string {
  const clerkError = error as ClerkErrorLike;
  const first = clerkError?.errors?.[0];
  switch (first?.code ?? clerkError.code) {
    case "form_identifier_not_found":
      return "Não encontramos uma conta com este e-mail.";
    case "form_code_incorrect":
      return "Código inválido. Verifique e tente novamente.";
    case "form_code_expired":
      return "Código expirado. Solicite um novo código.";
    case "form_password_length_too_short":
      return "A nova senha deve ter pelo menos 8 caracteres.";
    case "form_password_pwned":
      return "Esta senha é muito comum. Escolha outra senha.";
    case "too_many_requests":
      return "Muitas tentativas. Aguarde alguns minutos.";
    default:
      return first?.longMessage ?? first?.message ?? clerkError.message ?? fallback;
  }
}

export function ForgotPasswordPage() {
  const { signIn } = useSignIn();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const finish = async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          setError("Sua conta exige uma etapa adicional de segurança.");
          return;
        }
        const decorated = decorateUrl(dashboardPath);
        const target = new URL(decorated, window.location.origin);
        if (target.origin === window.location.origin) {
          setLocation(`${target.pathname}${target.search}${target.hash}`);
        } else {
          window.location.assign(target.href);
        }
      },
    });
  };

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!signIn || loading || !email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { error: createError } = await signIn.create({ identifier: email.trim() });
      if (createError) throw createError;
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) throw sendError;
      setStep("code");
    } catch (err: unknown) {
      setError(errorMessage(err, "Não foi possível enviar o código."));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!signIn || loading || code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (verifyError) throw verifyError;
      setStep("password");
    } catch (err: unknown) {
      setError(errorMessage(err, "Não foi possível validar o código."));
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!signIn || loading) return;
    if (password.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: passwordError } = await signIn.resetPasswordEmailCode.submitPassword({
        password,
        signOutOfOtherSessions: true,
      });
      if (passwordError) throw passwordError;
      if (signIn.status === "complete") {
        await finish();
      } else {
        setLocation("/sign-in");
      }
    } catch (err: unknown) {
      setError(errorMessage(err, "Não foi possível redefinir a senha."));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!signIn || loading) return;
    setLoading(true);
    setError("");
    try {
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) throw sendError;
    } catch (err: unknown) {
      setError(errorMessage(err, "Não foi possível reenviar o código."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-8">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_45%_35%_at_50%_30%,rgba(180,128,18,0.055)_0%,transparent_70%)] pointer-events-none" />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-2xl overflow-hidden border border-white/[0.07]" style={{ background: "#0d0d0d", boxShadow: "0 24px 80px -16px rgba(0,0,0,0.7)" }}>
          <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, transparent, #B8902A 25%, #E8C84A 50%, #B8902A 75%, transparent)" }} />
          <div className="px-7 pt-8 pb-9 sm:px-9">
            <div className="flex justify-center mb-6">
              <img src="/iattom-logo-transparent.png" alt="IAttom Assist" width={68} height={68} draggable={false} className="w-[68px] h-[68px] object-contain select-none" />
            </div>
            <div className="text-center mb-7">
              <h1 className="text-[21px] font-bold text-white tracking-tight">
                {step === "email" ? "Recuperar senha" : step === "code" ? "Confirmar código" : "Criar nova senha"}
              </h1>
              <p className="text-[12.5px] text-white/38 mt-1">
                {step === "email" ? "Enviaremos um código para seu e-mail" : step === "code" ? `Código enviado para ${email}` : "Digite e confirme sua nova senha"}
              </p>
            </div>

            {step === "email" && (
              <form onSubmit={sendCode} className="flex flex-col gap-3.5">
                <label className="text-[11.5px] text-white/45 tracking-wide">E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email" className="w-full h-[43px] px-3.5 rounded-lg text-[13.5px] text-white placeholder:text-white/22 outline-none" style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.09)" }} />
                {error && <div className="rounded-lg px-4 py-3 text-[12.5px]" style={{ background: "rgba(127,29,29,0.25)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5" }}>{error}</div>}
                <button type="submit" disabled={loading} className="w-full h-[44px] rounded-lg font-bold text-[12.5px] tracking-[0.14em] uppercase text-black disabled:opacity-55" style={{ background: loading ? "#8a6820" : "linear-gradient(135deg,#E8C84A 0%,#C9A030 38%,#A07820 68%,#C9A030 100%)" }}>{loading ? "Enviando..." : "Enviar código"}</button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={verifyCode} className="flex flex-col gap-3.5">
                <label className="text-[11.5px] text-white/45 tracking-wide text-center">Código de 6 dígitos</label>
                <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} required autoComplete="one-time-code" className="w-full h-[58px] px-4 rounded-lg text-[26px] font-bold text-white text-center placeholder:text-white/18 outline-none" style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.09)", letterSpacing: "0.5em" }} />
                {error && <div className="rounded-lg px-4 py-3 text-[12.5px]" style={{ background: "rgba(127,29,29,0.25)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5" }}>{error}</div>}
                <button type="submit" disabled={loading || code.length !== 6} className="w-full h-[44px] rounded-lg font-bold text-[12.5px] tracking-[0.14em] uppercase text-black disabled:opacity-55" style={{ background: loading ? "#8a6820" : "linear-gradient(135deg,#E8C84A 0%,#C9A030 38%,#A07820 68%,#C9A030 100%)" }}>{loading ? "Verificando..." : "Confirmar código"}</button>
                <button type="button" onClick={resendCode} disabled={loading} className="text-[12px] disabled:opacity-50" style={{ color: "#C9A84C" }}>Reenviar código</button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={savePassword} className="flex flex-col gap-3.5">
                {[{ label: "Nova senha", value: password, setter: setPassword }, { label: "Confirmar nova senha", value: confirmPassword, setter: setConfirmPassword }].map((field) => (
                  <div key={field.label} className="flex flex-col gap-1.5">
                    <label className="text-[11.5px] text-white/45 tracking-wide">{field.label}</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={field.value} onChange={(e) => field.setter(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} autoComplete="new-password" className="w-full h-[43px] px-3.5 pr-11 rounded-lg text-[13.5px] text-white placeholder:text-white/22 outline-none" style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.09)" }} />
                      <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/28 hover:text-white/55">
                        {showPassword ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                      </button>
                    </div>
                  </div>
                ))}
                {error && <div className="rounded-lg px-4 py-3 text-[12.5px]" style={{ background: "rgba(127,29,29,0.25)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5" }}>{error}</div>}
                <button type="submit" disabled={loading} className="w-full h-[44px] rounded-lg font-bold text-[12.5px] tracking-[0.14em] uppercase text-black disabled:opacity-55" style={{ background: loading ? "#8a6820" : "linear-gradient(135deg,#E8C84A 0%,#C9A030 38%,#A07820 68%,#C9A030 100%)" }}>{loading ? "Salvando..." : "Salvar nova senha"}</button>
              </form>
            )}

            <div className="mt-6 flex justify-center">
              <button type="button" onClick={() => setLocation("/sign-in")} className="flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/55">
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
