import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Sparkles, Check,
  ChevronDown, Users,
} from "lucide-react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={fadeUp}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StaggerSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const plans = [
  {
    key: "free",
    name: "START",
    price: "R$\u00a019,90",
    period: "/mês",
    credits: "50 créditos / mês",
    features: [
      "Todos os 6 módulos",
      "Espaço privado",
      "Gestão de projetos",
      "Histórico de atividades",
    ],
    cta: "Começar Agora",
    highlight: false,
    badge: null,
  },
  {
    key: "pro",
    name: "Pro",
    price: "R$\u00a089",
    period: "/mês",
    credits: "500 créditos / mês",
    features: [
      "Todos os 6 módulos",
      "Processamento prioritário",
      "Projetos ilimitados",
      "Exportar resultados",
      "Suporte prioritário",
    ],
    cta: "Assinar Pro",
    highlight: true,
    badge: "Mais Popular",
  },
  {
    key: "business",
    name: "Business",
    price: "R$\u00a0197",
    period: "/mês",
    credits: "2.000 créditos / mês",
    features: [
      "Tudo do Pro",
      "Workspace de equipe",
      "Análises avançadas",
      "Acesso via API",
      "Suporte dedicado",
    ],
    cta: "Assinar Business",
    highlight: false,
    badge: null,
  },
  {
    key: "agency",
    name: "Agency",
    price: "R$\u00a0497",
    period: "/mês",
    credits: "10.000 créditos / mês",
    features: [
      "Tudo do Business",
      "Multi-clientes",
      "Relatórios white-label",
      "Integrações customizadas",
      "SLA + CSM dedicado",
    ],
    cta: "Assinar Agency",
    highlight: false,
    badge: "Melhor Custo",
  },
];

const faqs = [
  {
    q: "O que são créditos e como funcionam?",
    a: "Créditos são consumidos a cada execução de módulo. Buscar Produto custa 5 créditos, Criar Campanha custa 10, Gerador Criativo custa 15. Os créditos renovam automaticamente todo mês.",
  },
  {
    q: "Posso mudar de plano a qualquer momento?",
    a: "Sim. Upgrades entram em vigor imediatamente com ajuste proporcional. Downgrades aplicam-se no início do próximo período de faturamento.",
  },
  {
    q: "Meus dados são privados e seguros?",
    a: "Cada conta tem um espaço de trabalho isolado. Suas consultas, resultados e projetos nunca são compartilhados com outros usuários. Todos os dados são criptografados em trânsito e em repouso.",
  },
  {
    q: "O que acontece se eu ficar sem créditos?",
    a: "Você receberá uma notificação antes de esgotar os créditos. É possível fazer upgrade imediatamente ou aguardar a renovação mensal automática.",
  },
  {
    q: "Os resultados são genéricos ou personalizados?",
    a: "Cada módulo gera resultados específicos para o seu contexto — produto, mercado, nicho e objetivos. Inteligência estruturada para o seu negócio, não respostas genéricas.",
  },
  {
    q: "Existe contrato de fidelidade?",
    a: "Não. Todos os planos são mensais e podem ser cancelados a qualquer momento, sem multa ou burocracia.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`border rounded-xl transition-all duration-200 cursor-pointer ${
        open ? "border-white/10 bg-white/[0.025]" : "border-white/[0.055] hover:border-white/[0.09]"
      }`}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between px-5 py-4 gap-4">
        <span className="text-sm font-medium text-zinc-200 leading-snug">{q}</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        </motion.div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm text-zinc-500 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col selection:bg-primary/25 selection:text-white">

      {/* ─── NAVBAR ─── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#080808]/88 backdrop-blur-xl border-b border-white/[0.055]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Logo size={30} showWordmark />
          <nav className="hidden md:flex items-center gap-7">
            {[["Preços", "#pricing"], ["FAQ", "#faq"]].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors font-medium"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="hidden sm:block text-[13px] font-medium text-zinc-500 hover:text-white transition-colors">
              Entrar
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-primary text-black hover:bg-primary/90 font-bold px-5 rounded-lg text-[13px] h-9 shadow-[0_0_20px_-4px_rgba(201,168,76,0.4)]">
                Começar Agora
              </Button>
            </Link>
          </div>
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

        {/* ─── PRICING ─── */}
        <section id="pricing" className="py-24 sm:py-28 bg-[#080808] border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <AnimatedSection className="text-center mb-14 sm:mb-16">
              <p className="text-[11px] text-primary uppercase tracking-widest font-bold mb-3">
                Planos e Preços
              </p>
              <h2 className="text-[28px] sm:text-4xl md:text-[42px] font-black text-white tracking-tight mb-4 leading-[1.1]">
                Escale no seu ritmo.
              </h2>
              <p className="text-zinc-500 max-w-xs sm:max-w-md mx-auto text-sm">
                Créditos renovam mensalmente. Sem contratos. Cancele quando quiser.
              </p>
            </AnimatedSection>

            <StaggerSection className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <motion.div
                  key={plan.name}
                  variants={fadeUp}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className={`relative flex flex-col p-5 sm:p-6 rounded-2xl border transition-all duration-300 ${
                    plan.highlight
                      ? "bg-primary/[0.07] border-primary/30 shadow-[0_0_60px_-12px_rgba(201,168,76,0.3)]"
                      : "bg-[#0d0d0d] border-white/[0.06] hover:border-white/[0.10]"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className={`px-3 py-0.5 text-[10px] font-black tracking-wider uppercase rounded-full whitespace-nowrap ${
                        plan.highlight ? "bg-primary text-black" : "bg-white/10 text-zinc-300 border border-white/10"
                      }`}>
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-0.5 mb-1.5">
                      <span className="text-3xl font-black text-white tracking-tight">{plan.price}</span>
                      {plan.period && <span className="text-zinc-600 text-sm ml-0.5">{plan.period}</span>}
                    </div>
                    <p className="text-xs font-semibold text-primary">{plan.credits}</p>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-zinc-400">
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/sign-up">
                    <Button
                      className={`w-full rounded-lg font-bold text-sm h-10 transition-all ${
                        plan.highlight
                          ? "bg-primary text-black hover:bg-primary/90 shadow-[0_0_30px_-6px_rgba(201,168,76,0.45)]"
                          : "bg-white/[0.05] text-white hover:bg-white/[0.09] border border-white/[0.08]"
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </StaggerSection>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" className="py-24 sm:py-28 bg-[#060606] border-t border-white/[0.05]">
          <div className="max-w-3xl mx-auto px-5 sm:px-6">
            <AnimatedSection className="text-center mb-12 sm:mb-14">
              <p className="text-[11px] text-primary uppercase tracking-widest font-bold mb-3">
                Dúvidas Frequentes
              </p>
              <h2 className="text-[28px] sm:text-4xl md:text-[42px] font-black text-white tracking-tight leading-[1.1]">
                Perguntas respondidas.
              </h2>
            </AnimatedSection>

            <AnimatedSection className="space-y-2.5">
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </AnimatedSection>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="py-24 sm:py-32 bg-[#080808] border-t border-white/[0.05] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_100%,_rgba(201,168,76,0.11)_0%,_transparent_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_0%,_rgba(201,168,76,0.04)_0%,_transparent_60%)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center relative z-10">
            <AnimatedSection className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-bold tracking-widest uppercase">
                <Users className="w-3 h-3" />
                Pronto para escalar?
              </div>
              <h2 className="text-[32px] sm:text-4xl md:text-[52px] font-black text-white tracking-tight leading-[1.06]">
                Sua concorrência já usa{" "}
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-[#F0DC8A] via-[#C9A84C] to-[#9A6F28] bg-clip-text text-transparent">
                  inteligência artificial.
                </span>
              </h2>
              <p className="text-zinc-400 text-[15px] sm:text-base leading-relaxed max-w-lg mx-auto px-2 sm:px-0">
                Acesse a plataforma completa e transforme a forma como você cria, valida e escala negócios.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 px-4 sm:px-0">
                <Link href="/sign-up" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-12 px-10 text-[15px] bg-primary text-black hover:bg-primary/90 font-black rounded-lg shadow-[0_0_60px_-8px_rgba(201,168,76,0.55)] hover:shadow-[0_0_80px_-8px_rgba(201,168,76,0.7)] transition-all duration-300"
                  >
                    Começar Agora <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/sign-in" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto h-12 px-8 text-sm border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-white rounded-lg transition-all"
                  >
                    Já tenho conta
                  </Button>
                </Link>
              </div>
            </AnimatedSection>
          </div>
        </section>

      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.055] bg-[#060606]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo size={26} showWordmark />
            <p className="text-xs text-zinc-700">
              &copy; {new Date().getFullYear()} IAttom Assist. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
