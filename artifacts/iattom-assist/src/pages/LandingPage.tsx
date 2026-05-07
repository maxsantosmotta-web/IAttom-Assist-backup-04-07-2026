import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Logo } from "@/components/ui/Logo";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col selection:bg-primary/25 selection:text-white">

      {/* ─── NAVBAR ─── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#080808]/88 backdrop-blur-xl border-b border-white/[0.055]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center">
          <Logo size={30} showWordmark />
        </div>
      </header>

      <main className="flex-1 pt-16">

        {/* ─── HERO ─── */}
        <section className="relative pt-24 pb-32 sm:pt-28 sm:pb-40 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,_rgba(201,168,76,0.18)_0%,_transparent_65%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_45%_at_80%_90%,_rgba(201,168,76,0.05)_0%,_transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:72px_72px] pointer-events-none" />

          <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-10">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="max-w-4xl mx-auto text-center space-y-7 sm:space-y-9"
            >
              <motion.div variants={fadeUp} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-bold tracking-widest uppercase">
                  <Sparkles className="w-3 h-3" />
                  Plataforma Privada de Negócios
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-[42px] sm:text-6xl md:text-[76px] font-black tracking-[-0.035em] text-white leading-[1.04] px-1 sm:px-4"
              >
                Crie, valide e escale{" "}
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-[#F0DC8A] via-[#C9A84C] to-[#9A6F28] bg-clip-text text-transparent">
                  com decisões precisas.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-[15px] sm:text-base md:text-lg text-zinc-400 max-w-xl sm:max-w-2xl mx-auto leading-relaxed px-2"
              >
                Uma plataforma completa para fundadores e equipes que recusam construir no achismo.
                Estratégia, validação e execução — tudo em um único lugar.
              </motion.p>

              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 px-4 sm:px-0"
              >
                <Link href="/sign-up" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-12 px-8 text-sm bg-primary text-black hover:bg-primary/90 font-black rounded-lg shadow-[0_0_50px_-8px_rgba(201,168,76,0.55)] hover:shadow-[0_0_70px_-8px_rgba(201,168,76,0.7)] transition-all duration-300"
                  >
                    Começar Agora <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/sign-in" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto h-12 px-8 text-sm border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white rounded-lg transition-all"
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
      <footer className="border-t border-white/[0.055] bg-[#060606]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8 text-center">
          <p className="text-xs text-zinc-700">
            &copy; {new Date().getFullYear()} IAttom Assist. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
