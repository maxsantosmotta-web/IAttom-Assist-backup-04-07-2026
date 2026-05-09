import { useState } from "react";
import { UserPlus, LogIn, X, Eye, EyeOff, Mail, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSignUp, useSignIn } from "@clerk/react";
import { useLocation } from "wouter";

/* ─── motion presets ─────────────────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };

/* ─── shared input style ─────────────────────────────────────────────── */
const inputBase =
  "w-full h-[48px] rounded-xl px-4 text-[13px] text-white bg-white/[0.06] border border-white/[0.10] placeholder:text-white/30 focus:outline-none focus:border-[#C9A030]/60 focus:bg-white/[0.08] transition-all duration-200";

/* ─── error mapper ───────────────────────────────────────────────────── */

// Erros com segunda linha de orientação ficam separados por \n
const errMap: Record<string, string> = {
  /* senha */
  form_password_incorrect:                 "Usuário ou senha inválidos.",
  form_password_pwned:                     "Sua senha precisa ter no mínimo 8 caracteres.",
  form_password_length_too_short:          "Sua senha precisa ter no mínimo 8 caracteres.",
  form_password_size_in_bytes_exceeded:    "Sua senha precisa ter no mínimo 8 caracteres.",
  form_password_no_password:              "Informe uma senha para continuar.",
  form_password_not_enabled_for_user:      "Esta conta não possui senha configurada.",

  /* identificadores — login */
  form_identifier_not_found:               "Usuário não encontrado.",
  user_not_found:                          "Usuário não encontrado.",

  /* identificadores — cadastro */
  form_identifier_exists:                  "Este email já possui cadastro.",
  phone_number_exists:                     "Este telefone já possui cadastro.",
  username_exists_in_instance:             "Este usuário já está em uso.",

  /* estratégia / método */
  strategy_for_user_invalid:               "Usuário ou senha inválidos.",
  not_allowed_access:                      "Acesso não permitido para esta conta.",
  client_state_invalid:                    "Sessão expirada. Recarregue a página.",
  strategy_not_allowed_for_instance:       "Usuário ou senha inválidos.",

  /* código de verificação */
  form_code_incorrect:                     "Código incorreto. Tente novamente.",
  form_code_expired:                       "Código expirado. Solicite um novo.",
  verification_failed:                     "Verificação falhou. Tente novamente.",
  verification_expired:                    "Verificação expirada. Recomece o processo.",

  /* campos / formato */
  form_param_format_invalid:               "Dados inválidos. Verifique as informações.",
  form_param_nil:                          "Preencha todos os campos.",
  form_param_missing:                      "Preencha todos os campos.",
  form_param_unknown:                      "Ocorreu um erro inesperado. Tente novamente.",
  form_conditional_param_value_disallowed: "Ocorreu um erro inesperado. Tente novamente.",

  /* sessão */
  session_exists:                          "Você já está autenticado.",
  session_not_found:                       "Sessão encerrada. Faça login novamente.",

  /* limites */
  too_many_requests:                       "Muitas tentativas. Aguarde alguns instantes.",
  quota_exceeded:                          "Muitas tentativas. Aguarde alguns instantes.",
  captcha_invalid:                         "Verificação de segurança falhou. Tente novamente.",

  /* conta / Google */
  user_locked:                             "Conta temporariamente bloqueada.\nAguarde alguns minutos e tente novamente.",
  account_transfer_invalid:               "Ocorreu um erro inesperado. Tente novamente.",
  external_account_exists:                 "Este email já possui cadastro.\nUse Fazer login ou redefina sua senha.",
  oauth_account_already_exists:            "Este email já possui cadastro.\nUse Fazer login ou redefina sua senha.",
  account_already_exists:                  "Este email já possui cadastro.\nUse Fazer login ou redefina sua senha.",
  external_account_email_address_verification_failed: "Este email já possui cadastro.\nUse Fazer login ou redefina sua senha.",
};

/* frases em inglês que podem vir em longMessage/message */
const msgPhrases: Array<[RegExp, string]> = [
  [/password is incorrect/i,                           "Usuário ou senha inválidos."],
  [/verification strategy is not valid/i,              "Usuário ou senha inválidos."],
  [/strategy.*not.*valid/i,                           "Usuário ou senha inválidos."],
  [/identifier (is )?not found/i,                      "Usuário não encontrado."],
  [/already (exists|taken)/i,                          "Este email já possui cadastro."],
  [/external.*account|oauth.*account|google.*account/i,"Esta conta usa outro método de acesso."],
  [/password.*not.*enabled|not.*allowed.*password/i,   "Esta conta não possui senha configurada."],
  [/is not allowed/i,                                  "Método de acesso inválido para esta conta."],
  [/too many (requests|attempts)/i,                    "Muitas tentativas. Aguarde alguns instantes."],
  [/code (is )?incorrect/i,                           "Código incorreto. Tente novamente."],
  [/code (is )?expired/i,                             "Código expirado. Solicite um novo."],
  [/locked/i,                                         "Conta temporariamente bloqueada.\nAguarde alguns minutos e tente novamente."],
  [/session.*not found/i,                             "Sessão encerrada. Faça login novamente."],
  [/failed to fetch/i,                                "Não foi possível conectar ao servidor."],
  [/network/i,                                        "Não foi possível conectar ao servidor."],
];

type ClerkErr = { code: string; longMessage?: string; message?: string };

function clerkMsg(e: ClerkErr | null | unknown): string {
  if (!e) return "Ocorreu um erro inesperado. Tente novamente.";

  // timeout de 5 segundos
  if (e instanceof Error && e.message === "__timeout__") {
    return "Usuário já possui cadastro. Faça login ou redefina sua senha.";
  }

  // erro de rede / fetch
  if (e instanceof TypeError || (e instanceof Error && /fetch|network/i.test(e.message))) {
    return "Não foi possível conectar ao servidor.";
  }

  // Clerk error: pode ser { code } direto OU ClerkAPIResponseError { errors: [] }
  const ce = extractFirstClerkErr(e) ?? (e as ClerkErr);

  // 1. código mapeado
  if (ce.code && errMap[ce.code]) return errMap[ce.code];

  // 2. texto da mensagem com padrões conhecidos
  const raw = ce.longMessage ?? ce.message ?? "";
  for (const [pattern, pt] of msgPhrases) {
    if (pattern.test(raw)) return pt;
  }

  // 3. fallback genérico (nunca expõe texto técnico)
  return "Ocorreu um erro inesperado. Tente novamente.";
}

/* ─── helper: timeout (10s) ──────────────────────────────────────────── */
function withTimeout<T>(p: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("__timeout__")), ms)
    ),
  ]);
}

/* ─── extrai o primeiro ClerkErr de qualquer formato de erro ─────────── */
// Clerk v6 pode retornar { error } OU lançar ClerkAPIResponseError { errors: [] }
function extractFirstClerkErr(ex: unknown): ClerkErr | null {
  if (!ex || typeof ex !== "object") return null;
  const arr = (ex as { errors?: ClerkErr[] }).errors;
  if (Array.isArray(arr) && arr.length > 0) return arr[0];
  const ce = ex as ClerkErr;
  if (ce.code) return ce;
  return null;
}

/* ─── detecta erros de conta já existente por código ou texto ───────── */
const EXISTING_ACCOUNT_CODES = new Set([
  "form_identifier_exists",
  "strategy_for_user_invalid",
  "strategy_not_allowed_for_instance",
  "form_password_not_enabled_for_user",
  "external_account_exists",
  "oauth_account_already_exists",
  "account_already_exists",
  "external_account_email_address_verification_failed",
]);

const EXISTING_ACCOUNT_PATTERN =
  /already.*(exists|taken)|external.*account|oauth.*account|password.*not.*enabled|not.*allowed.*password|identifier.*exist/i;

function isExistingAccount(e: ClerkErr | unknown): boolean {
  const ce = extractFirstClerkErr(e) ?? (e as ClerkErr);
  if (!ce?.code && !ce?.longMessage && !ce?.message) return false;
  if (ce.code && EXISTING_ACCOUNT_CODES.has(ce.code)) return true;
  const raw = ce.longMessage ?? ce.message ?? "";
  return EXISTING_ACCOUNT_PATTERN.test(raw);
}

/* ─── drawer shell ───────────────────────────────────────────────────── */
function DrawerShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          onClick={onClose}
        />
        <motion.div
          className="relative z-10 w-full max-w-[480px] mx-auto rounded-t-3xl overflow-hidden"
          style={{ background: "#0a0a0a", border: "1px solid rgba(201,160,48,0.10)", borderBottom: "none" }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 280, mass: 0.9 }}
        >
          <div className="w-full h-[1.5px]"
            style={{ background: "linear-gradient(90deg,transparent,#C9A030 40%,#F0D050 50%,#C9A030 60%,transparent)" }}
          />
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/15" />
          </div>
          <div className="px-6 pt-4 pb-10">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.10] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/* ─── password field with show/hide ─────────────────────────────────── */
function PasswordInput({ placeholder, value, onChange, autoComplete }: {
  placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputBase + " pr-11"}
        autoComplete={autoComplete}
        required
        minLength={8}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

/* ─── method toggle (Email / Telefone) ───────────────────────────────── */
function MethodToggle({ value, onChange }: { value: "email" | "phone"; onChange: (v: "email" | "phone") => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-white/[0.08] mb-1">
      {(["email", "phone"] as const).map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className="flex-1 h-[42px] flex items-center justify-center gap-2 text-[11.5px] font-semibold tracking-wide transition-all duration-200"
          style={{
            background: value === opt ? "rgba(201,160,48,0.12)" : "transparent",
            color: value === opt ? "#C9A030" : "rgba(255,255,255,0.30)",
            borderBottom: value === opt ? "1.5px solid #C9A030" : "1.5px solid transparent",
          }}
        >
          {opt === "email"
            ? <><Mail className="w-3.5 h-3.5" /> Email</>
            : <><Phone className="w-3.5 h-3.5" /> Telefone</>
          }
        </button>
      ))}
    </div>
  );
}

/* ─── gold submit button ─────────────────────────────────────────────── */
function GoldBtn({ label, busy }: { label: string; busy?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full h-[50px] flex items-center justify-center rounded-xl font-black text-[12.5px] tracking-[0.16em] uppercase text-black mt-1 hover:brightness-110 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
      style={{
        background: "linear-gradient(135deg, #E8C84A 0%, #C9A030 38%, #A07820 68%, #C9A030 100%)",
        boxShadow: "0 4px 24px -6px rgba(201,160,48,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      {busy
        ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" />
        : label
      }
    </button>
  );
}

/* ─── error block (suporta duas linhas separadas por \n) ────────────── */
function ErrLine({ msg }: { msg: string }) {
  if (!msg) return null;
  const [line1, line2] = msg.split("\n");
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-[11.5px] text-red-400/90 text-center leading-snug">{line1}</p>
      {line2 && (
        <p className="text-[11px] text-white/40 text-center leading-snug">{line2}</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SIGN-UP DRAWER
═══════════════════════════════════════════════════════════════════════ */
type SignUpStep = "form" | "verify" | "exists_code" | "reset_form";

function SignUpDrawer({ onClose, onOpenLogin }: { onClose: () => void; onOpenLogin: () => void }) {
  const [, navigate] = useLocation();
  const { signUp } = useSignUp();
  const { signIn } = useSignIn();

  const [method, setMethod]       = useState<"email" | "phone">("email");
  const [step, setStep]           = useState<SignUpStep>("form");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [password, setPass]       = useState("");
  const [confirm, setConfirm]     = useState("");
  const [code, setCode]           = useState("");
  const [err, setErr]             = useState("");
  const [loading, setLoading]     = useState(false);
  const [showResetLink, setReset] = useState(false);
  const [checking, setChecking]   = useState(false);
  const [lastChecked, setLastChecked] = useState("");

  const busy = loading;

  const NOT_FOUND_CODES = new Set([
    "form_identifier_not_found", "user_not_found", "resource_not_found",
  ]);

  async function handleIdentifierBlur() {
    const value = method === "email" ? email.trim() : phone.trim();
    if (!value || value === lastChecked) return;
    setLastChecked(value);
    setChecking(true);
    try {
      // signIn.create() throws on error in Clerk v6 — it does NOT return { error }
      await withTimeout(signIn.create({ identifier: value }), 5000);
      // Resolved without throwing → identifier exists in Clerk
      setErr("Usuário já possui cadastro. Faça login ou redefina sua senha.");
      setReset(true);
    } catch (ex) {
      // Timeout or network error → silently ignore, let submit handle it
      if (ex instanceof Error && ex.message === "__timeout__") return;
      // Network / fetch error → silently ignore
      if (ex instanceof TypeError || (ex instanceof Error && /fetch|network/i.test(ex.message))) return;

      // Extract Clerk error code
      const ce = extractFirstClerkErr(ex);
      const code = ce?.code ?? "";

      if (NOT_FOUND_CODES.has(code)) {
        // Identifier genuinely not found → clear any stale message
        setErr("");
        setReset(false);
      } else if (isExistingAccount(ex)) {
        // Strategy mismatch or other "account exists" signal
        setErr("Usuário já possui cadastro. Faça login ou redefina sua senha.");
        setReset(true);
      }
      // Any other error → silently ignore, normal submit will handle it
    } finally {
      setChecking(false);
    }
  }

  function handleMethodChange(m: "email" | "phone") {
    setMethod(m); setErr(""); setEmail(""); setPhone("");
    setPass(""); setConfirm(""); setStep("form"); setReset(false);
    setLastChecked(""); setChecking(false);
  }

  /* ── PASSO 1: tentativa de cadastro ─────────────────────────────── */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr("Sua senha precisa ter no mínimo 8 caracteres."); return; }
    if (password !== confirm) { setErr("As senhas não conferem."); return; }
    setErr(""); setReset(false); setLoading(true);

    try {
      const params =
        method === "email"
          ? { emailAddress: email, password }
          : { phoneNumber: phone, password };

      const { error: e1 } = await withTimeout(signUp.password(params));

      // Conta já existe → mostrar mensagem inline + link "Redefinir senha"
      if (e1) {
        const msg = clerkMsg(e1);
        const isExisting = isExistingAccount(e1) || /já possui cadastro|já está vinculado/i.test(msg);
        setErr(isExisting
          ? "Usuário já possui cadastro. Faça login ou redefina sua senha."
          : msg
        );
        setReset(isExisting);
        return;
      }

      if (signUp.status === "complete") {
        const { error: e2 } = await withTimeout(signUp.finalize());
        if (e2) { setErr(clerkMsg(e2)); return; }
        if (method === "phone") localStorage.setItem("iattom_signup_phone", phone);
        navigate("/onboarding");
        return;
      }

      // Precisa verificar email
      const { error: e3 } = await withTimeout(signUp.verifications.sendEmailCode());
      if (e3) { setErr(clerkMsg(e3)); return; }
      setStep("verify");
    } catch (ex) {
      // Clerk às vezes lança ClerkAPIResponseError ao invés de retornar { error }
      if (isExistingAccount(ex)) {
        setErr("Usuário já possui cadastro. Faça login ou redefina sua senha.");
        setReset(true);
      } else {
        setErr(clerkMsg(ex));
      }
    } finally {
      setLoading(false);
    }
  }

  /* ── PASSO 2a: verificar email de novo cadastro ──────────────────── */
  async function handleVerifyNewAccount(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);

    try {
      const { error: e1 } = await withTimeout(signUp.verifications.verifyEmailCode({ code }));
      if (e1) { setErr(clerkMsg(e1)); return; }

      const { error: e2 } = await withTimeout(signUp.finalize());
      if (e2) { setErr(clerkMsg(e2)); return; }

      navigate("/onboarding");
    } catch (ex) {
      setErr(clerkMsg(ex));
    } finally {
      setLoading(false);
    }
  }

  /* ── "Redefinir senha" clicado: enviar código para conta existente ─ */
  async function handleSendResetCode() {
    setErr(""); setReset(false); setLoading(true);

    try {
      const { error: e1 } = await withTimeout(signIn.create({ identifier: email }));
      if (e1) { setErr(clerkMsg(e1)); setReset(true); return; }

      const { error: e2 } = await withTimeout(signIn.resetPasswordEmailCode.sendCode());
      if (e2) { setErr(clerkMsg(e2)); setReset(true); return; }

      setCode("");
      setStep("exists_code");
    } catch (ex) {
      setErr(clerkMsg(ex));
      setReset(true);
    } finally {
      setLoading(false);
    }
  }

  /* ── PASSO 3b: verificar OTP e definir senha na conta existente ──── */
  async function handleVerifyAndSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);

    try {
      const { error: e1 } = await withTimeout(signIn.resetPasswordEmailCode.verifyCode({ code }));
      if (e1) { setErr(clerkMsg(e1)); return; }

      const { error: e2 } = await withTimeout(signIn.resetPasswordEmailCode.submitPassword({ password }));
      if (e2) { setErr(clerkMsg(e2)); return; }

      const { error: e3 } = await withTimeout(signIn.finalize());
      if (e3) { setErr(clerkMsg(e3)); return; }

      navigate("/dashboard");
    } catch (ex) {
      setErr(clerkMsg(ex));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetNewAccount() {
    await signUp.reset();
    setStep("form"); setCode(""); setErr(""); setReset(false);
  }

  /* ── RENDER ──────────────────────────────────────────────────────── */
  return (
    <DrawerShell onClose={onClose}>

      {/* ── Formulário principal ────────────────────────────────────── */}
      {step === "form" && (
        <>
          <p className="text-[11px] text-white/30 uppercase tracking-[0.18em] font-semibold mb-4 text-center">
            Criar conta
          </p>
          <MethodToggle value={method} onChange={handleMethodChange} />
          <form onSubmit={handleCreate} className="flex flex-col gap-3 mt-3">
            {method === "email" ? (
              <div key="email" className="relative">
                <input
                  type="email"
                  placeholder="Digite seu email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErr(""); setReset(false); setLastChecked(""); }}
                  onBlur={handleIdentifierBlur}
                  className={inputBase}
                  autoComplete="email"
                  required
                />
                {checking && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 tracking-wide">
                    verificando...
                  </span>
                )}
              </div>
            ) : (
              <div key="phone" className="relative">
                <input
                  type="tel"
                  placeholder="Digite seu telefone (ex: +5511999999999)"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setErr(""); setReset(false); setLastChecked(""); }}
                  onBlur={handleIdentifierBlur}
                  className={inputBase}
                  autoComplete="tel"
                  required
                />
                {checking && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 tracking-wide">
                    verificando...
                  </span>
                )}
              </div>
            )}
            <PasswordInput
              placeholder="Crie uma senha (mín. 8 caracteres)"
              value={password}
              onChange={setPass}
              autoComplete="new-password"
            />
            <PasswordInput
              placeholder="Confirme sua senha"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />

            <ErrLine msg={err} />

            <GoldBtn label="Continuar" busy={busy} />
          </form>
          <p className="text-center text-[11.5px] text-white/35 mt-5">
            Já possui conta?{" "}
            <button
              onClick={() => { onClose(); onOpenLogin(); }}
              className="text-[#C9A030] hover:text-[#F0D050] transition-colors font-semibold"
            >
              Fazer login
            </button>
            <span className="mx-1.5 opacity-40">•</span>
            <button
              type="button"
              onClick={() => { setStep("reset_form"); setErr(""); setReset(false); }}
              className="text-[#C9A030] hover:text-[#F0D050] transition-colors font-semibold"
            >
              Redefinir senha
            </button>
          </p>
        </>
      )}

      {/* ── Verificar email — novo cadastro ─────────────────────────── */}
      {step === "verify" && (
        <>
          <p className="text-[11px] text-white/30 uppercase tracking-[0.18em] font-semibold mb-2 text-center">
            Verificar email
          </p>
          <p className="text-[12px] text-white/45 text-center mb-5 leading-snug">
            Enviamos um código de verificação para{" "}
            <span className="text-white/70 font-medium">{email}</span>
          </p>
          <form onSubmit={handleVerifyNewAccount} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={inputBase + " text-center tracking-[0.35em] text-lg font-semibold"}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
            <ErrLine msg={err} />
            <GoldBtn label="Verificar" busy={busy} />
          </form>
          <p className="text-center text-[11.5px] text-white/35 mt-5">
            Email errado?{" "}
            <button
              onClick={handleResetNewAccount}
              className="text-[#C9A030] hover:text-[#F0D050] transition-colors font-semibold"
            >
              Alterar
            </button>
          </p>
        </>
      )}

      {/* ── Conta existente — verificar OTP e definir senha ─────────── */}
      {step === "exists_code" && (
        <>
          <p className="text-[11px] text-white/30 uppercase tracking-[0.18em] font-semibold mb-2 text-center">
            Verificar identidade
          </p>
          <p className="text-[12px] text-white/45 text-center mb-5 leading-snug">
            Enviamos um código para{" "}
            <span className="text-white/70 font-medium">{email}</span>
            <br />
            <span className="text-[11px]">Insira o código para criar sua senha.</span>
          </p>
          <form onSubmit={handleVerifyAndSetPassword} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={inputBase + " text-center tracking-[0.35em] text-lg font-semibold"}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
            <ErrLine msg={err} />
            <GoldBtn label="Criar senha e entrar" busy={busy} />
          </form>
          <p className="text-center text-[11.5px] text-white/35 mt-5">
            <button
              onClick={() => { setStep("form"); setCode(""); setErr(""); setReset(true); }}
              className="text-[#C9A030] hover:text-[#F0D050] transition-colors font-semibold"
            >
              Voltar
            </button>
          </p>
        </>
      )}

      {/* ── Redefinir senha (a partir de conta existente detectada) ─── */}
      {step === "reset_form" && (
        <ResetFormStep
          initialIdentifier={method === "email" ? email : phone}
          onBack={() => { setStep("form"); setErr(""); setReset(true); }}
          backLabel="Voltar"
        />
      )}

    </DrawerShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   RESET FORM STEP — reutilizado nos dois drawers
═══════════════════════════════════════════════════════════════════════ */
function ResetFormStep({
  initialIdentifier = "",
  onBack,
  backLabel = "Voltar para entrar",
  onSuccess,
}: {
  initialIdentifier?: string;
  onBack: () => void;
  backLabel?: string;
  onSuccess?: () => void;
}) {
  const { signIn } = useSignIn();

  type RStep = "identifier" | "code" | "success";
  const [rstep, setRStep]     = useState<RStep>("identifier");
  const [identifier, setId]   = useState(initialIdentifier);
  const [code, setCode]       = useState("");
  const [password, setPass]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  /* ── Passo 1: enviar código ────────────────────────────────────── */
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setErr(""); setLoading(true);
    try {
      const { error: e1 } = await withTimeout(
        signIn.create({ identifier: identifier.trim() }),
        5000,
      );
      if (e1) { setErr(clerkMsg(e1)); return; }

      const { error: e2 } = await withTimeout(
        signIn.resetPasswordEmailCode.sendCode(),
        5000,
      );
      if (e2) { setErr(clerkMsg(e2)); return; }

      setCode(""); setPass(""); setConfirm("");
      setRStep("code");
    } catch (ex) {
      setErr(ex instanceof Error && ex.message === "__timeout__"
        ? "Não foi possível conectar. Tente novamente."
        : clerkMsg(ex));
    } finally {
      setLoading(false);
    }
  }

  /* ── Passo 2: verificar código + nova senha ────────────────────── */
  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr("A senha precisa ter no mínimo 8 caracteres."); return; }
    if (password !== confirm) { setErr("As senhas não conferem."); return; }
    setErr(""); setLoading(true);
    try {
      const { error: e1 } = await withTimeout(
        signIn.resetPasswordEmailCode.verifyCode({ code }),
        5000,
      );
      if (e1) { setErr(clerkMsg(e1)); return; }

      const { error: e2 } = await withTimeout(
        signIn.resetPasswordEmailCode.submitPassword({ password }),
        5000,
      );
      if (e2) { setErr(clerkMsg(e2)); return; }

      const { error: e3 } = await withTimeout(signIn.finalize(), 5000);
      if (e3) { setErr(clerkMsg(e3)); return; }

      setRStep("success");
    } catch (ex) {
      setErr(ex instanceof Error && ex.message === "__timeout__"
        ? "Não foi possível conectar. Tente novamente."
        : clerkMsg(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="text-[11px] text-white/30 uppercase tracking-[0.18em] font-semibold mb-5 text-center">
        Redefinir senha
      </p>

      {/* ── Passo 1: identificador ─────────────────────────────────── */}
      {rstep === "identifier" && (
        <form onSubmit={handleSend} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Email ou telefone"
            value={identifier}
            onChange={e => { setId(e.target.value); setErr(""); }}
            className={inputBase}
            autoComplete="username"
            required
          />
          <ErrLine msg={err} />
          <GoldBtn label="Enviar instruções" busy={loading} />
        </form>
      )}

      {/* ── Passo 2: código + nova senha ───────────────────────────── */}
      {rstep === "code" && (
        <>
          <p className="text-[12px] text-white/35 text-center mb-3 leading-snug">
            Enviamos um código para <span className="text-white/60">{identifier}</span>. Insira abaixo junto com sua nova senha.
          </p>
          <form onSubmit={handleReset} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Código recebido"
              value={code}
              onChange={e => { setCode(e.target.value); setErr(""); }}
              className={inputBase}
              autoComplete="one-time-code"
              required
            />
            <PasswordInput
              placeholder="Nova senha (mín. 8 caracteres)"
              value={password}
              onChange={v => { setPass(v); setErr(""); }}
              autoComplete="new-password"
            />
            <PasswordInput
              placeholder="Confirmar nova senha"
              value={confirm}
              onChange={v => { setConfirm(v); setErr(""); }}
              autoComplete="new-password"
            />
            <ErrLine msg={err} />
            <GoldBtn label="Redefinir senha" busy={loading} />
          </form>
          <p className="text-center text-[11.5px] text-white/35 mt-4">
            <button
              type="button"
              onClick={() => { setRStep("identifier"); setErr(""); }}
              className="text-[#C9A030] hover:text-[#F0D050] transition-colors font-semibold"
            >
              Reenviar código
            </button>
          </p>
        </>
      )}

      {/* ── Passo 3: sucesso ───────────────────────────────────────── */}
      {rstep === "success" && (
        <div
          className="rounded-xl px-4 py-5 flex flex-col items-center gap-2"
          style={{ background: "rgba(201,160,48,0.07)", border: "1px solid rgba(201,160,48,0.18)" }}
        >
          <p className="text-[13px] text-white/80 text-center font-medium leading-snug">
            Senha redefinida com sucesso.
          </p>
          <p className="text-[12px] text-white/40 text-center leading-snug mt-1">
            Você já pode entrar com sua nova senha.
          </p>
        </div>
      )}

      {/* ── Rodapé ─────────────────────────────────────────────────── */}
      {rstep !== "code" && (
        <p className="text-center text-[11.5px] text-white/35 mt-5">
          <button
            type="button"
            onClick={rstep === "success" ? (onSuccess ?? onBack) : onBack}
            className="text-[#C9A030] hover:text-[#F0D050] transition-colors font-semibold"
          >
            {rstep === "success" ? "Entrar agora" : backLabel}
          </button>
        </p>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SIGN-IN DRAWER
═══════════════════════════════════════════════════════════════════════ */
function SignInDrawer({ onClose, onOpenSignUp }: { onClose: () => void; onOpenSignUp: () => void }) {
  const [, navigate] = useLocation();
  const { signIn, fetchStatus } = useSignIn();

  const [step, setStep]     = useState<"login" | "reset_form">("login");
  const [identifier, setId] = useState("");
  const [password, setPass] = useState("");
  const [err, setErr]       = useState("");

  const busy = fetchStatus === "fetching";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    try {
      const { error: e1 } = await signIn.password({ identifier, password });
      if (e1) { setErr(clerkMsg(e1)); return; }

      if (signIn.status === "complete") {
        const { error: e2 } = await signIn.finalize();
        if (e2) { setErr(clerkMsg(e2)); return; }
        navigate("/dashboard");
      } else {
        setErr("Ocorreu um erro inesperado. Tente novamente.");
      }
    } catch (ex) {
      setErr(clerkMsg(ex));
    }
  }

  return (
    <DrawerShell onClose={onClose}>

      {/* ── Login ───────────────────────────────────────────────────── */}
      {step === "login" && (
        <>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Email ou telefone"
              value={identifier}
              onChange={e => setId(e.target.value)}
              className={inputBase}
              autoComplete="username"
              required
            />
            <PasswordInput
              placeholder="Sua senha"
              value={password}
              onChange={setPass}
              autoComplete="current-password"
            />
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => { setStep("reset_form"); setErr(""); }}
                className="text-[11.5px] text-white/35 hover:text-[#C9A030] transition-colors duration-150"
              >
                Esqueci minha senha
              </button>
            </div>
            <ErrLine msg={err} />
            <GoldBtn label="Entrar" busy={busy} />
          </form>
          <p className="text-center text-[11.5px] text-white/35 mt-5">
            Nao possui conta?{" "}
            <button
              onClick={() => { onClose(); onOpenSignUp(); }}
              className="text-[#C9A030] hover:text-[#F0D050] transition-colors font-semibold"
            >
              Criar conta
            </button>
          </p>
        </>
      )}

      {/* ── Redefinir senha ─────────────────────────────────────────── */}
      {step === "reset_form" && (
        <ResetFormStep
          initialIdentifier={identifier}
          onBack={() => { setStep("login"); }}
          backLabel="Voltar para entrar"
          onSuccess={() => { setStep("login"); }}
        />
      )}

    </DrawerShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LANDING PAGE — nao alterar nada abaixo desta linha
═══════════════════════════════════════════════════════════════════════ */
export function LandingPage() {
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <>
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center selection:bg-yellow-900/30 selection:text-white px-6 py-8 overflow-hidden">
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_45%_35%_at_50%_36%,_rgba(180,128,18,0.06)_0%,_transparent_70%)] pointer-events-none" />

        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="relative z-10 flex flex-col items-center text-center w-full max-w-[320px] sm:max-w-[370px] gap-7 sm:gap-8"
        >
          <motion.div variants={fadeUp} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <img
              src="/iattom-logo-transparent.png"
              alt="IAttom Assist"
              width={216} height={216}
              draggable={false}
              className="w-[216px] h-[216px] object-contain select-none"
            />
          </motion.div>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="text-[10.5px] sm:text-[11px] text-white/80 font-normal leading-snug tracking-wide px-1"
          >
            Um passo solido vale mais do que cem recomeco.
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col w-full gap-2.5"
          >
            <button
              onClick={() => setSignUpOpen(true)}
              className="w-full h-[50px] flex items-center justify-center gap-3 rounded-lg font-bold text-[11.5px] tracking-[0.18em] uppercase text-black transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #E8C84A 0%, #C9A030 38%, #A07820 68%, #C9A030 100%)",
                boxShadow: "0 4px 28px -6px rgba(201,160,48,0.6), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <UserPlus className="w-[16px] h-[16px]" strokeWidth={2.2} />
              Criar Conta
            </button>

            <button
              onClick={() => setSignInOpen(true)}
              className="w-full h-[50px] flex items-center justify-center gap-3 rounded-lg font-bold text-[11.5px] tracking-[0.18em] uppercase text-white/70 transition-all duration-200 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1.5px solid rgba(255,255,255,0.12)",
              }}
            >
              <LogIn className="w-[16px] h-[16px]" strokeWidth={2.2} />
              Fazer Login
            </button>
          </motion.div>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-[10px] text-white/20 tracking-wide"
          >
            &copy; {new Date().getFullYear()} IAttom Assist. Todos os direitos reservados.
          </motion.p>
        </motion.div>
      </div>

      {signUpOpen && (
        <SignUpDrawer
          onClose={() => setSignUpOpen(false)}
          onOpenLogin={() => { setSignUpOpen(false); setSignInOpen(true); }}
        />
      )}
      {signInOpen && (
        <SignInDrawer
          onClose={() => setSignInOpen(false)}
          onOpenSignUp={() => { setSignInOpen(false); setSignUpOpen(true); }}
        />
      )}
    </>
  );
}
