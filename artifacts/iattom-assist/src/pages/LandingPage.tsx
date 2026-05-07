import { Link } from "wouter";
import { UserPlus, LogIn } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

export function LandingPage() {
  return (
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

        {/* slogan — 35% smaller than before */}
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
          {/* primary — gold */}
          <Link href="/sign-up" className="w-full">
            <button
              className="w-full h-[50px] flex items-center justify-center gap-3 rounded-lg font-bold text-[11.5px] tracking-[0.18em] uppercase text-black transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #E8C84A 0%, #C9A030 38%, #A07820 68%, #C9A030 100%)",
                boxShadow: "0 4px 28px -6px rgba(201,160,48,0.6), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <UserPlus className="w-[16px] h-[16px]" strokeWidth={2.2}/>
              Criar Conta
            </button>
          </Link>

          {/* secondary — outlined */}
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
  );
}
