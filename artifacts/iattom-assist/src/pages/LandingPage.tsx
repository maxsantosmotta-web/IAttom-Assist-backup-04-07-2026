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
const errMap: Record<string, string> = {
  /* senhas */
  form_password_pwned:                     "Senha muito comum. Escolha uma senha mais forte.",
  form_password_incorrect:                 "Senha incorreta. Verifique e tente novamente.",
  form_password_length_too_short:          "A senha deve ter pelo menos 8 caracteres.",
  form_password_size_in_bytes_exceeded:    "Senha muito longa. Reduza o tamanho.",
  form_password_no_password:              "Informe uma senha para continuar.",

  /* identificadores */
  form_identifier_exists:                  "Este email já está cadastrado.",
  form_identifier_not_found:               "Usuário não encontrado. Verifique os dados.",
  phone_number_exists:                     "Este número de telefone já está cadastrado.",
  username_exists_in_instance:             "Este nome de usuário já está em uso.",

  /* estratégia / método */
  strategy_for_user_invalid:               "Este método de acesso não está disponível para esta conta. Tente entrar usando a mesma opção utilizada no cadastro.",
  not_allowed_access:                      "Acesso não permitido para esta conta.",
  client_state_invalid:                    "Sessão inválida. Recarregue a página e tente novamente.",
  strategy_not_allowed_for_instance:       "Este método de autenticação não está habilitado.",

  /* código de verificação */
  form_code_incorrect:                     "Código incorreto. Tente novamente.",
  form_code_expired:                       "Código expirado. Solicite um novo.",
  verification_failed:                     "Verificação falhou. Tente novamente.",
  verification_expired:                    "Verificação expirada. Recomece o processo.",

  /* campos / formato */
  form_param_format_invalid:               "Formato inválido. Verifique os dados informados.",
  form_param_nil:                          "Preencha todos os campos obrigatórios.",
  form_param_missing:                      "Campo obrigatório não preenchido.",
  form_param_unknown:                      "Dados não reconhecidos pelo sistema.",
  form_conditional_param_value_disallowed: "Combinação de dados inválida.",

  /* sessão */
  session_exists:                          "Você já está autenticado.",
  session_not_found:                       "Sessão não encontrada. Faça login novamente.",

  /* limites */
  too_many_requests:                       "Muitas tentativas. Aguarde alguns instantes.",
  quota_exceeded:                          "Limite de tentativas excedido. Tente mais tarde.",
  captcha_invalid:                         "Verificação de segurança falhou. Tente novamente.",

  /* conta */
  account_transfer_invalid:                "Erro na transferência de conta. Tente novamente.",
  user_locked:                             "Conta temporariamente bloqueada. Aguarde e tente novamente.",
  user_not_found:                          "Usuário não encontrado.",
};

/* frases em inglês que podem vir no campo message/longMessage */
const msgPhrases: Array<[RegExp, string]> = [
  [/verification strategy is not valid/i,        "Este método de acesso não está disponível para esta conta. Tente entrar usando a mesma opção utilizada no cadastro."],
  [/password is incorrect/i,                     "Senha incorreta. Verifique e tente novamente."],
  [/identifier (is )?not found/i,                "Usuário não encontrado. Verifique os dados."],
  [/already (exists|taken)/i,                    "Estes dados já estão cadastrados. Tente fazer login."],
  [/too many (requests|attempts)/i,              "Muitas tentativas. Aguarde alguns instantes."],
  [/code (is )?incorrect/i,                      "Código incorreto. Tente novamente."],
  [/code (is )?expired/i,                        "Código expirado. Solicite um novo."],
  [/is not allowed/i,                            "Ação não permitida para esta conta."],
  [/strategy.*not.*valid/i,                      "Este método de acesso não está disponível para esta conta. Tente entrar usando a mesma opção utilizada no cadastro."],
  [/locked/i,                                    "Conta temporariamente bloqueada. Aguarde e tente novamente."],
  [/session.*not found/i,                        "Sessão não encontrada. Faça login novamente."],
  [/is invalid/i,                                "Dado inválido. Verifique e tente novamente."],
];

type ClerkErr = { code: string; longMessage?: string; message?: string };

function clerkMsg(e: ClerkErr | null): string {
  if (!e) return "Erro desconhecido.";

  // 1. código mapeado diretamente
  if (errMap[e.code]) return errMap[e.code];

  // 2. busca na mensagem por frases em inglês conhecidas
  const raw = e.longMessage ?? e.message ?? "";
  for (const [pattern, pt] of msgPhrases) {
    if (pattern.test(raw)) return pt;
  }

  // 3. fallback: retorna o texto original se já estiver em pt, ou mensagem genérica
  if (raw) return raw;
  return "Erro ao autenticar. Tente novamente.";
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

/* ─── error line ─────────────────────────────────────────────────────── */
function ErrLine({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="text-[11.5px] text-red-400/90 text-center leading-snug">{msg}</p>;
}

/* ═══════════════════════════════════════════════════════════════════════
   SIGN-UP DRAWER
═══════════════════════════════════════════════════════════════════════ */
function SignUpDrawer({ onClose, onOpenLogin }: { onClose: () => void; onOpenLogin: () => void }) {
  const [, navigate] = useLocation();
  const { signUp, fetchStatus } = useSignUp();

  const [method, setMethod]   = useState<"email" | "phone">("email");
  const [step, setStep]       = useState<"form" | "verify">("form");
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [password, setPass]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode]       = useState("");
  const [err, setErr]         = useState("");

  const busy = fetchStatus === "fetching";

  function handleMethodChange(m: "email" | "phone") {
    setMethod(m);
    setErr("");
    setEmail("");
    setPhone("");
    setPass("");
    setConfirm("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr("A senha deve ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setErr("As senhas não coincidem."); return; }
    setErr("");

    const params =
      method === "email"
        ? { emailAddress: email, password }
        : { phoneNumber: phone, password };

    const { error: e1 } = await signUp.password(params);
    if (e1) { setErr(clerkMsg(e1)); return; }

    if (signUp.status === "complete") {
      const { error: e2 } = await signUp.finalize();
      if (e2) { setErr(clerkMsg(e2)); return; }
      if (method === "phone") localStorage.setItem("iattom_signup_phone", phone);
      navigate("/onboarding");
      return;
    }

    // needs verification (email OTP)
    const { error: e3 } = await signUp.verifications.sendEmailCode();
    if (e3) { setErr(clerkMsg(e3)); return; }
    setStep("verify");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    const { error: e1 } = await signUp.verifications.verifyEmailCode({ code });
    if (e1) { setErr(clerkMsg(e1)); return; }

    const { error: e2 } = await signUp.finalize();
    if (e2) { setErr(clerkMsg(e2)); return; }

    navigate("/onboarding");
  }

  async function handleReset() {
    await signUp.reset();
    setStep("form");
    setCode("");
    setErr("");
  }

  return (
    <DrawerShell onClose={onClose}>
      {step === "form" ? (
        <>
          <p className="text-[11px] text-white/30 uppercase tracking-[0.18em] font-semibold mb-4 text-center">
            Criar conta
          </p>

          <MethodToggle value={method} onChange={handleMethodChange} />

          <form onSubmit={handleCreate} className="flex flex-col gap-3 mt-3">
            {method === "email" ? (
              <input
                key="email"
                type="email"
                placeholder="Digite seu email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputBase}
                autoComplete="email"
                required
              />
            ) : (
              <input
                key="phone"
                type="tel"
                placeholder="Digite seu telefone (ex: +5511999999999)"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className={inputBase}
                autoComplete="tel"
                required
              />
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
          </p>
        </>
      ) : (
        <>
          <p className="text-[11px] text-white/30 uppercase tracking-[0.18em] font-semibold mb-2 text-center">
            Verificar email
          </p>
          <p className="text-[12px] text-white/45 text-center mb-5 leading-snug">
            Enviamos um código de verificação para{" "}
            <span className="text-white/70 font-medium">{email}</span>
          </p>
          <form onSubmit={handleVerify} className="flex flex-col gap-3">
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
              onClick={handleReset}
              className="text-[#C9A030] hover:text-[#F0D050] transition-colors font-semibold"
            >
              Alterar
            </button>
          </p>
        </>
      )}
    </DrawerShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SIGN-IN DRAWER
═══════════════════════════════════════════════════════════════════════ */
function SignInDrawer({ onClose, onOpenSignUp }: { onClose: () => void; onOpenSignUp: () => void }) {
  const [, navigate] = useLocation();
  const { signIn, fetchStatus } = useSignIn();

  const [identifier, setId] = useState("");
  const [password, setPass] = useState("");
  const [err, setErr]       = useState("");

  const busy = fetchStatus === "fetching";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    const { error: e1 } = await signIn.password({ identifier, password });
    if (e1) { setErr(clerkMsg(e1)); return; }

    if (signIn.status === "complete") {
      const { error: e2 } = await signIn.finalize();
      if (e2) { setErr(clerkMsg(e2)); return; }
      navigate("/dashboard");
    } else {
      setErr("Autenticação incompleta. Tente novamente.");
    }
  }

  return (
    <DrawerShell onClose={onClose}>
      <p className="text-[11px] text-white/30 uppercase tracking-[0.18em] font-semibold mb-5 text-center">
        Entrar
      </p>
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
