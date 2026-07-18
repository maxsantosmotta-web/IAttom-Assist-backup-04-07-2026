import { useState } from "react";
import { useSignUp } from "@clerk/react";
import { useLocation } from "wouter";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

const basePath = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
const canonicalOrigin = "https://www.iattomassist.com.br";
const billingPath = `${basePath}/dashboard/billing` || "/dashboard/billing";
const googleCallbackUrl = `${canonicalOrigin}${basePath}/sign-up/sso-callback`;
const googleRedirectUrl = `${canonicalOrigin}${billingPath}`;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function mapSignUpError(code?: string, msg?: string): string {
  switch (code) {
    case "form_identifier_exists":
      return "E-mail já cadastrado. Utilize Fazer Login.";
    case "form_param_format_invalid":
      return "E-mail inválido.";
    case "form_password_length_too_short":
      return "Senha muito curta. Mínimo 8 caracteres.";
    case "form_password_pwned":
      return "Senha muito comum. Escolha outra senha.";
    case "form_code_incorrect":
      return "Código inválido. Verifique e tente novamente.";
    case "form_code_expired":
      return "Código expirado. Solicite um novo.";
    case "too_many_requests":
      return "Muitas tentativas. Aguarde alguns minutos.";
    default:
      return msg ?? "Erro ao processar. Tente novamente.";
  }
}

type ClerkErrorLike = {
  errors?: { code?: string; message?: string; longMessage?: string }[];
  code?: string;
  message?: string;
};

export function SignUpPage() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signUp } = useSignUp();
  const [, setLocation] = useLocation();

  const finishSignUp = async () => {
    await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          console.error("[SignUp] Pending session task:", session.currentTask);
          setError("Sua conta exige uma etapa adicional antes de continuar.");
          return;
        }

        const url = decorateUrl(billingPath);
        if (url.startsWith("http")) window.location.assign(url);
        else setLocation(url);
      },
    });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp || loading) return;

    setLoading(true);
    setError("");

    try {
      const { error: clerkError } = await signUp.password({
        emailAddress: email.trim(),
        password,
      });

      if (clerkError) {
        const first = (clerkError as ClerkErrorLike)?.errors?.[0];
        setError(mapSignUpError(first?.code, first?.longMessage ?? first?.message));
        return;
      }

      if (signUp.status === "complete") {
        await finishSignUp();
        return;
      }

      if (signUp.status === "missing_requirements") {
        const { error: verificationError } = await signUp.verifications.sendEmailCode();
        if (verificationError) {
          const first = (verificationError as ClerkErrorLike)?.errors?.[0];
          setError(mapSignUpError(first?.code, first?.longMessage ?? first?.message));
          return;
        }
        setStep("otp");
        return;
      }

      console.error("[SignUp] Unexpected status:", signUp.status, signUp);
      setError("Não foi possível iniciar o cadastro.");
    } catch (err: unknown) {
      const clerkError = err as ClerkErrorLike;
      const first = clerkError?.errors?.[0];
      console.error("[SignUp] Clerk error:", err);
      setError(mapSignUpError(first?.code ?? clerkError.code, first?.longMessage ?? first?.message ?? clerkError.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp || loading || code.length !== 6) return;

    setLoading(true);
    setError("");

    try {
      const { error: clerkError } = await signUp.verifications.verifyEmailCode({ code });

      if (clerkError) {
        const first = (clerkError as ClerkErrorLike)?.errors?.[0];
        setError(mapSignUpError(first?.code, first?.longMessage ?? first?.message));
        return;
      }

      if (signUp.status === "complete") {
        await finishSignUp();
        return;
      }

      console.error("[SignUp OTP] Verification incomplete:", signUp.status, signUp);
      setError("Verificação incompleta. Tente novamente.");
    } catch (err: unknown) {
      const clerkError = err as ClerkErrorLike;
      const first = clerkError?.errors?.[0];
      console.error("[SignUp OTP] Clerk error:", err);
      setError(mapSignUpError(first?.code ?? clerkError.code, first?.longMessage ?? first?.message ?? clerkError.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signUp || loading) return;

    setLoading(true);
    setError("");

    try {
      const { error: clerkError } = await signUp.verifications.sendEmailCode();
      if (clerkError) {
        const first = (clerkError as ClerkErrorLike)?.errors?.[0];
        setError(mapSignUpError(first?.code, first?.longMessage ?? first?.message));
      }
    } catch (err: unknown) {
      const clerkError = err as ClerkErrorLike;
      const first = clerkError?.errors?.[0];
      console.error("[SignUp resend] Clerk error:", err);
      setError(mapSignUpError(first?.code ?? clerkError.code, first?.longMessage ?? first?.message ?? clerkError.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!signUp || loading) return;

    setLoading(true);
    setError("");

    const timeoutId = window.setTimeout(() => {
      setLoading(false);
      setError("O Google não abriu. Atualize a página e tente novamente.");
    }, 12_000);

    try {
      const { error: clerkError } = await signUp.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: googleCallbackUrl,
        redirectUrl: googleRedirectUrl,
      });

      if (clerkError) {
        window.clearTimeout(timeoutId);
        const first = (clerkError as ClerkErrorLike)?.errors?.[0];
        setError(first?.longMessage ?? first?.message ?? "Erro ao autenticar com Google. Tente novamente.");
        setLoading(false);
      }
    } catch (err: unknown) {
      window.clearTimeout(timeoutId);
      const clerkError = err as ClerkErrorLike;
      const first = clerkError?.errors?.[0];
      console.error("[SignUp Google] Clerk error:", err);
      setError(first?.longMessage ?? first?.message ?? clerkError.message ?? "Erro ao autenticar com Google. Tente novamente.");
      setLoading(false);
    }
  };

  const returnToEmail = () => {
    signUp.reset();
    setStep("email");
    setError("");
    setCode("");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-8">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_45%_35%_at_50%_30%,rgba(180,128,18,0.055)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-2xl overflow-hidden border border-white/[0.07]" style={{ background: "#0d0d0d", boxShadow: "0 24px 80px -16px rgba(0,0,0,0.7)" }}>
          <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, transparent, #B8902A 25%, #E8C84A 50%, #B8902A 75%, transparent)" }} />

          <div className="px-7 pt-8 pb-9 sm:px-9">
            <div className="flex justify-center mb-6">
              <img
                src="/iattom-logo-transparent.png"
                alt="IAttom Assist"
                width={68} height={68}
                draggable={false}
                className="w-[68px] h-[68px] object-contain select-none"
              />
            </div>

            {step === "email" ? (
              <>
                <div className="text-center mb-7">
                  <h1 className="text-[21px] font-bold text-white tracking-tight">Criar conta</h1>
                  <p className="text-[12.5px] text-white/38 mt-1">Acesse o IAttom Assist</p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full h-[44px] flex items-center justify-center gap-2.5 rounded-lg border border-white/[0.10] text-white/80 text-[13px] font-medium transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed mb-5"
                  style={{ background: "rgba(255,255,255,0.025)" }}
                >
                  <GoogleIcon />
                  {loading ? "Abrindo Google..." : "Continuar com Google"}
                </button>

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                  <span className="text-[10.5px] text-white/25 tracking-[0.16em]">OU</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                </div>

                <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11.5px] text-white/45 tracking-wide">E-mail</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      autoComplete="email"
                      className="w-full h-[43px] px-3.5 rounded-lg text-[13.5px] text-white placeholder:text-white/22 outline-none transition-colors"
                      style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.09)" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.5)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11.5px] text-white/45 tracking-wide">Senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        required
                        autoComplete="new-password"
                        className="w-full h-[43px] px-3.5 pr-11 rounded-lg text-[13.5px] text-white placeholder:text-white/22 outline-none transition-colors"
                        style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.09)" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.5)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/28 hover:text-white/55 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg px-4 py-3 text-[12.5px] leading-snug" style={{ background: "rgba(127,29,29,0.25)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5" }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[44px] rounded-lg font-bold text-[12.5px] tracking-[0.14em] uppercase text-black transition-all disabled:opacity-55 disabled:cursor-not-allowed mt-1"
                    style={{ background: loading ? "#8a6820" : "linear-gradient(135deg,#E8C84A 0%,#C9A030 38%,#A07820 68%,#C9A030 100%)" }}
                  >
                    {loading ? "Aguarde..." : "Continuar"}
                  </button>
                </form>

                <div className="mt-6 flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLocation("/")}
                    className="flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/55 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar ao início
                  </button>
                  <p className="text-[12px] text-white/25">
                    Já tem conta?{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/sign-in")}
                      className="transition-colors"
                      style={{ color: "#C9A84C" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#E8C96A"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#C9A84C"; }}
                    >
                      Fazer Login
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-7">
                  <h1 className="text-[21px] font-bold text-white tracking-tight">Confirmar e-mail</h1>
                  <p className="text-[12.5px] text-white/38 mt-1.5 leading-snug px-2">
                    Código enviado para<br />
                    <span className="text-white/65">{email}</span>
                  </p>
                </div>

                <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11.5px] text-white/45 tracking-wide text-center">Código de 6 dígitos</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      required
                      maxLength={6}
                      autoComplete="one-time-code"
                      className="w-full h-[58px] px-4 rounded-lg text-[26px] font-bold text-white text-center placeholder:text-white/18 placeholder:text-[22px] outline-none transition-colors"
                      style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.09)", letterSpacing: "0.5em" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.5)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg px-4 py-3 text-[12.5px] leading-snug" style={{ background: "rgba(127,29,29,0.25)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5" }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || code.length < 6}
                    className="w-full h-[44px] rounded-lg font-bold text-[12.5px] tracking-[0.14em] uppercase text-black transition-all disabled:opacity-55 disabled:cursor-not-allowed"
                    style={{ background: (loading || code.length < 6) ? "#8a6820" : "linear-gradient(135deg,#E8C84A 0%,#C9A030 38%,#A07820 68%,#C9A030 100%)" }}
                  >
                    {loading ? "Verificando..." : "Confirmar código"}
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-[12px] text-center transition-colors disabled:opacity-50"
                    style={{ color: "#C9A84C" }}
                    onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = "#E8C96A"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#C9A84C"; }}
                  >
                    Reenviar código
                  </button>
                </form>

                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={returnToEmail}
                    className="flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/55 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
