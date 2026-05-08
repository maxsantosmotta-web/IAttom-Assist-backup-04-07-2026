import { useState } from "react";
import { Link, useLocation } from "wouter";
import { UserPlus, LogIn, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

function SignUpDrawer({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    navigate("/sign-up");
  }

  const inputClass =
    "w-full h-[48px] rounded-xl px-4 text-[13px] text-white bg-white/[0.06] border border-white/[0.10] placeholder:text-white/30 focus:outline-none focus:border-[#C9A030]/60 focus:bg-white/[0.08] transition-all duration-200";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">

        {/* backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          onClick={onClose}
        />

        {/* drawer panel */}
        <motion.div
          className="relative z-10 w-full max-w-[480px] mx-auto rounded-t-3xl overflow-hidden"
          style={{
            background: "#0a0a0a",
            border: "1px solid rgba(201,160,48,0.10)",
            borderBottom: "none",
          }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 280, mass: 0.9 }}
        >
          {/* gold top accent line */}
          <div
            className="w-full h-[1.5px]"
            style={{ background: "linear-gradient(90deg, transparent, #C9A030 40%, #F0D050 50%, #C9A030 60%, transparent)" }}
          />

          {/* drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/15" />
          </div>

          <div className="px-6 pt-4 pb-10">

            {/* close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.10] transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Google button */}
            <button
              onClick={() => navigate("/sign-up")}
              className="w-full h-[48px] flex items-center justify-center gap-3 rounded-xl font-semibold text-[13px] text-white/80 hover:text-white transition-all duration-200 hover:bg-white/[0.08] mb-5"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continuar com Google
            </button>

            {/* divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-white/30 tracking-widest uppercase">ou</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* form */}
            <form onSubmit={handleContinue} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Digite seu email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
                required
              />
              <input
                type="password"
                placeholder="Crie uma senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
                required
              />

              {/* submit */}
              <button
                type="submit"
                className="w-full h-[50px] flex items-center justify-center rounded-xl font-black text-[12.5px] tracking-[0.16em] uppercase text-black mt-1 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, #E8C84A 0%, #C9A030 38%, #A07820 68%, #C9A030 100%)",
                  boxShadow: "0 4px 24px -6px rgba(201,160,48,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
                }}
              >
                Continuar
              </button>
            </form>

            {/* login link */}
            <p className="text-center text-[11.5px] text-white/35 mt-5">
              Já possui conta?{" "}
              <button
                onClick={() => navigate("/sign-in")}
                className="text-[#C9A030] hover:text-[#F0D050] transition-colors font-semibold"
              >
                Fazer login
              </button>
            </p>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function LandingPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center selection:bg-yellow-900/30 selection:text-white px-6 py-8 overflow-hidden">

        {/* ambient gold glow */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_45%_35%_at_50%_36%,_rgba(180,128,18,0.06)_0%,_transparent_70%)] pointer-events-none"/>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 flex flex-col items-center text-center w-full max-w-[320px] sm:max-w-[370px] gap-7 sm:gap-8"
        >

          {/* logo badge */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className=""
          >
            <img
              src="/iattom-logo-transparent.png"
              alt="IAttom Assist"
              width={216}
              height={216}
              draggable={false}
              className="w-[216px] h-[216px] object-contain select-none"
            />
          </motion.div>

          {/* slogan */}
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="text-[10.5px] sm:text-[11px] text-white/80 font-normal leading-snug tracking-wide px-1"
          >
            Um passo sólido vale mais do que cem recomeços.
          </motion.p>

          {/* buttons */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col w-full gap-2.5"
          >
            {/* primary — opens drawer */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full h-[50px] flex items-center justify-center gap-3 rounded-lg font-bold text-[11.5px] tracking-[0.18em] uppercase text-black transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #E8C84A 0%, #C9A030 38%, #A07820 68%, #C9A030 100%)",
                boxShadow: "0 4px 28px -6px rgba(201,160,48,0.6), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <UserPlus className="w-[16px] h-[16px]" strokeWidth={2.2}/>
              Criar Conta
            </button>

            {/* secondary — direct sign-in */}
            <Link href="/sign-in" className="w-full">
              <button
                className="w-full h-[50px] flex items-center justify-center gap-3 rounded-lg font-bold text-[11.5px] tracking-[0.18em] uppercase text-white/70 transition-all duration-200 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                }}
              >
                <LogIn className="w-[16px] h-[16px]" strokeWidth={2.2}/>
                Fazer Login
              </button>
            </Link>
          </motion.div>

          {/* footer */}
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-[10px] text-white/20 tracking-wide"
          >
            &copy; {new Date().getFullYear()} IAttom Assist. Todos os direitos reservados.
          </motion.p>

        </motion.div>
      </div>

      {/* bottom drawer — renders outside main container so it covers everything */}
      {drawerOpen && <SignUpDrawer onClose={() => setDrawerOpen(false)} />}
    </>
  );
}
