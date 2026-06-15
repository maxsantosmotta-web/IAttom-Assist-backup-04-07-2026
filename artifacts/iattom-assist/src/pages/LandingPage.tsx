import { useState } from "react";
import { UserPlus, LogIn, X } from "lucide-react";
import { motion } from "framer-motion";
import { SignIn, SignUp } from "@clerk/react";

/* ─── motion presets ─────────────────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };

/* ─── appearance override para o contexto de drawer ─────────────────── */
// O ClerkProvider já tem o tema dark/gold global.
// Aqui apenas removemos o card container (border/bg) pois o DrawerShell
// já provê o container visual — evitando dupla borda/fundo.
const drawerAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "!bg-transparent !border-0 !shadow-none !rounded-none w-full",
    card: "!bg-transparent !border-0 !shadow-none !rounded-none !p-0",
    footer: "!bg-transparent !border-0 !shadow-none !rounded-none !p-0",
    logoBox: "hidden",
    logoImage: "hidden",
    // Oculta "Já tem conta? Fazer Login" (no SignUpDrawer) e
    // "Não tem conta? Registre-se" (no SignInDrawer) — links automáticos
    // do Clerk que usam signInUrl/signUpUrl e tiram o usuário do fluxo
    // oficial dos drawers para as páginas full-page /sign-in e /sign-up.
    footerAction: "hidden",
  },
};

/* ─── drawer shell ───────────────────────────────────────────────────── */
// Sempre montado — visibilidade controlada via animate (sem unmount/remount).
// Isso evita que os componentes Clerk reinicializem a cada abertura/fechamento,
// reduzindo drasticamente as chamadas à API Clerk e eliminando o rate-limit 429.
function DrawerShell({ onClose, children, isVisible }: { onClose: () => void; children: React.ReactNode; isVisible: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={false}
        animate={{ opacity: isVisible ? 1 : 0 }}
        transition={{ duration: 0.28 }}
        onClick={onClose}
      />
      <motion.div
        className="relative z-10 w-full max-w-[480px] mx-auto rounded-t-3xl overflow-hidden"
        style={{ background: "#0a0a0a", border: "1px solid rgba(201,160,48,0.10)", borderBottom: "none" }}
        initial={false}
        animate={{ y: isVisible ? 0 : "100%" }}
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
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SIGN-UP DRAWER
   Container visual preservado. Lógica de auth delegada ao Clerk oficial.
═══════════════════════════════════════════════════════════════════════ */
function SignUpDrawer({ onClose, isVisible }: { onClose: () => void; onOpenLogin: () => void; isVisible: boolean }) {
  return (
    <DrawerShell onClose={onClose} isVisible={isVisible}>
      <SignUp
        routing="hash"
        fallbackRedirectUrl="/dashboard/billing"
        appearance={drawerAppearance}
      />
    </DrawerShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SIGN-IN DRAWER
   Container visual preservado. Lógica de auth delegada ao Clerk oficial.
═══════════════════════════════════════════════════════════════════════ */
function SignInDrawer({ onClose, isVisible }: { onClose: () => void; onOpenSignUp: () => void; isVisible: boolean }) {
  return (
    <DrawerShell onClose={onClose} isVisible={isVisible}>
      <SignIn
        routing="hash"
        fallbackRedirectUrl="/dashboard/billing"
        appearance={drawerAppearance}
      />
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

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-2"
          >
            <p className="text-[10px] text-white/20 tracking-wide">
              &copy; {new Date().getFullYear()} IAttom Assist. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-3 text-[10px] text-white/20">
              <a href="/about" className="hover:text-white/50 transition-colors">Sobre</a>
              <span className="text-white/10">·</span>
              <a href="/terms" className="hover:text-white/50 transition-colors">Termos</a>
              <span className="text-white/10">·</span>
              <a href="/privacy" className="hover:text-white/50 transition-colors">Privacidade</a>
              <span className="text-white/10">·</span>
              <a href="/help" className="hover:text-white/50 transition-colors">Ajuda</a>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <SignUpDrawer
        isVisible={signUpOpen}
        onClose={() => setSignUpOpen(false)}
        onOpenLogin={() => { setSignUpOpen(false); setSignInOpen(true); }}
      />
      <SignInDrawer
        isVisible={signInOpen}
        onClose={() => setSignInOpen(false)}
        onOpenSignUp={() => { setSignInOpen(false); setSignUpOpen(true); }}
      />
    </>
  );
}
