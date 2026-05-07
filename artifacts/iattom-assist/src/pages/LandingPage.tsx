import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { LogoMark } from "@/components/ui/Logo";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col selection:bg-primary/25 selection:text-white">

      <main className="flex-1">

        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden">

          {/* ambient glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-5%,_rgba(201,168,76,0.16)_0%,_transparent_68%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_85%_95%,_rgba(201,168,76,0.045)_0%,_transparent_65%)] pointer-events-none" />

          {/* subtle grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.011)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.011)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none" />

          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 pb-20 sm:pt-32 sm:pb-28 relative z-10 w-full">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="max-w-3xl mx-auto text-center space-y-8 sm:space-y-10"
            >

              {/* logo mark */}
              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex justify-center"
              >
                <LogoMark size={72} />
              </motion.div>

              {/* headline */}
              <motion.h1
                variants={fadeUp}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="text-[44px] sm:text-[64px] md:text-[80px] font-black tracking-[-0.038em] text-white leading-[1.02] px-2"
              >
                Um passo sólido vale mais{" "}
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-[#F2E08E] via-[#C9A84C] to-[#9A6F28] bg-clip-text text-transparent">
                  do que cem recomeços.
                </span>
              </motion.h1>

              {/* supporting description */}
              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-[15px] sm:text-base text-zinc-500 max-w-md sm:max-w-lg mx-auto leading-relaxed tracking-wide"
              >
                Sua concorrência já usa inteligência artificial.
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
              >
                <Link href="/sign-up" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-12 px-9 text-[13px] bg-primary text-black hover:bg-primary/90 font-black rounded-lg shadow-[0_0_55px_-10px_rgba(201,168,76,0.55)] hover:shadow-[0_0_75px_-10px_rgba(201,168,76,0.7)] transition-all duration-300 tracking-wide"
                  >
                    Começar Agora <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/sign-in" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto h-12 px-9 text-[13px] border-white/[0.08] bg-white/[0.025] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 rounded-lg transition-all tracking-wide"
                  >
                    Já tenho conta
                  </Button>
                </Link>
              </motion.div>

            </motion.div>
          </div>
        </section>

      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.05] bg-[#060606]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 py-6 text-center">
          <p className="text-xs text-zinc-700">
            &copy; {new Date().getFullYear()} IAttom Assist. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
