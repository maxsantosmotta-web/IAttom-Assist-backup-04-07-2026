import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, BarChart3, Globe, Shield, Sparkles, Target, Zap, Check,
  ChevronDown, Play, TrendingUp, Users, Brain, Rocket, Star,
} from "lucide-react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
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

const modules = [
  {
    icon: Target,
    title: "Buscar Produtos",
    desc: "Descubra oportunidades de mercado ocultas antes da concorrência. Mapeamos sinais de demanda em 200+ categorias.",
    accent: "text-primary",
    bg: "bg-primary/8 border-primary/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(201,168,76,0.3)]",
    tag: "5 créditos",
  },
  {
    icon: BarChart3,
    title: "Validar Produtos",
    desc: "Teste a viabilidade com modelos de audiência e pontuação de densidade competitiva. Elimine más ideias rápido, apoie vencedoras com dados.",
    accent: "text-blue-400",
    bg: "bg-blue-400/8 border-blue-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(96,165,250,0.25)]",
    tag: "5 créditos",
  },
  {
    icon: Rocket,
    title: "Criar Campanha",
    desc: "Lance campanhas de marketing de funil completo adaptadas ao seu nicho. Segmentação, frameworks de mensagem, estratégias de canal.",
    accent: "text-amber-400",
    bg: "bg-amber-400/8 border-amber-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(251,191,36,0.25)]",
    tag: "10 créditos",
  },
  {
    icon: Brain,
    title: "Criar Conteúdo",
    desc: "Gere posts de blog otimizados para SEO, sequências de e-mail, copy de landing page e conteúdo social. Focado em conversão.",
    accent: "text-emerald-400",
    bg: "bg-emerald-400/8 border-emerald-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(52,211,153,0.25)]",
    tag: "8 créditos",
  },
  {
    icon: Sparkles,
    title: "Gerador Criativo",
    desc: "Conceitos criativos de qualidade, briefings visuais, frameworks de anúncio e direção de marca — sem preço de agência.",
    accent: "text-purple-400",
    bg: "bg-purple-400/8 border-purple-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(192,132,252,0.25)]",
    tag: "15 créditos",
  },
  {
    icon: Play,
    title: "Scripts de Vídeo",
    desc: "Crie scripts virais para YouTube, TikTok e anúncios com ganchos que param o scroll, histórias que geram confiança e CTAs que convertem.",
    accent: "text-rose-400",
    bg: "bg-rose-400/8 border-rose-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(251,113,133,0.25)]",
    tag: "10 créditos",
  },
];

const steps = [
  {
    num: "01",
    title: "Descreva seu objetivo",
    desc: "Diga o que você está construindo, validando ou lançando. Sem necessidade de expertise em prompts.",
    icon: Brain,
  },
  {
    num: "02",
    title: "Inteligência gerada",
    desc: "O GPT-5 processa sua entrada contra padrões reais de mercado e gera resultados estruturados e acionáveis.",
    icon: Zap,
  },
  {
    num: "03",
    title: "Salve, refine, lance",
    desc: "Exporte insights para seu espaço privado, itere e vá da ideia à execução em minutos.",
    icon: Rocket,
  },
];

const testimonials = [
  {
    name: "Marcus Chen",
    role: "Founder, Apex Digital",
    quote: "IAttom Assist found us a $2M niche opportunity in an industry we'd never considered. The product discovery module alone has paid for itself 50x over.",
    stars: 5,
    initials: "MC",
    color: "bg-primary/20 text-primary",
  },
  {
    name: "Priya Sharma",
    role: "CEO, LaunchStack",
    quote: "We validated three product ideas in an afternoon. Two would have been disasters. One became our biggest revenue stream. The market validation is uncanny.",
    stars: 5,
    initials: "PS",
    color: "bg-blue-400/20 text-blue-400",
  },
  {
    name: "Jordan Williams",
    role: "Growth Lead, Nomad Labs",
    quote: "The campaign generator replaced a $8,000/month agency retainer. The output quality is genuinely better — and it's ready in minutes, not weeks.",
    stars: 5,
    initials: "JW",
    color: "bg-emerald-400/20 text-emerald-400",
  },
];

const plans = [
  {
    key: "free",
    name: "START",
    price: "$0",
    period: "",
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
    price: "$79",
    period: "/mo",
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
    price: "$199",
    period: "/mo",
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
    price: "$499",
    period: "/mo",
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
    a: "Créditos são consumidos a cada vez que você executa um módulo. Diferentes módulos têm custos diferentes: Busca de Produto custa 5 créditos, Criar Campanha custa 10, e Gerador Criativo custa 15. Os créditos renovam todo mês na data de faturamento.",
  },
  {
    q: "Posso mudar de plano a qualquer momento?",
    a: "Sim. Upgrades entram em vigor imediatamente e são proporcionais ao restante do ciclo. Downgrades aplicam-se no início do próximo período.",
  },
  {
    q: "Meus dados são privados e seguros?",
    a: "Completamente. Cada conta tem um espaço de trabalho privado isolado. Suas consultas, resultados e projetos nunca são compartilhados com outros usuários nem usados para treinar modelos. Todos os dados são criptografados.",
  },
  {
    q: "Qual modelo de inteligência artificial é usado?",
    a: "A plataforma roda em GPT-5 mini, acessado através de uma integração segura gerenciada pela Replit. Você tem acesso a inteligência de ponta sem gerenciar chaves de API.",
  },
  {
    q: "O que acontece se eu ficar sem créditos?",
    a: "Você verá uma notificação clara e não será cobrado por resultados parciais. Você pode atualizar seu plano imediatamente para obter mais créditos, ou aguardar a renovação mensal.",
  },
  {
    q: "Existe uma versão gratuita?",
    a: "Sim. O plano START permite explorar todos os 6 módulos com 50 créditos — sem cartão de crédito. Isso dá uma experiência real da plataforma antes de decidir fazer upgrade.",
  },
];

const stats = [
  { value: "6", label: "Módulos", icon: Brain },
  { value: "GPT-5", label: "Tecnologia", icon: Sparkles },
  { value: "100%", label: "Espaço Privado", icon: Shield },
  { value: "4", label: "Planos", icon: TrendingUp },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`border rounded-xl transition-all duration-200 cursor-pointer ${
        open ? "border-white/10 bg-white/[0.03]" : "border-white/[0.06] hover:border-white/[0.09]"
      }`}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between p-5 gap-4">
        <span className="text-sm font-medium text-zinc-200">{q}</span>
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

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, message: message.trim() || undefined }),
      });
      if (res.status === 409) { setStatus("already"); return; }
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="max-w-md mx-auto text-center p-8 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-base font-bold text-emerald-400 mb-1">You're on the list.</p>
        <p className="text-sm text-zinc-500">We'll reach out to <span className="text-zinc-300 font-medium">{email}</span> when your access is ready.</p>
      </div>
    );
  }

  if (status === "already") {
    return (
      <div className="max-w-md mx-auto text-center p-8 rounded-2xl bg-primary/5 border border-primary/20">
        <p className="text-base font-bold text-primary mb-1">Já cadastrado</p>
        <p className="text-sm text-zinc-500">Esse e-mail já está registrado. Entraremos em contato.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Input
            type="text"
            placeholder="Seu nome (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-11 focus:border-primary/40"
          />
        </div>
        <div>
          <Input
            type="email"
            placeholder="Seu endereço de e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-11 focus:border-primary/40"
          />
        </div>
      </div>
      <Textarea
        placeholder="Para que você usará IAttom Assist? (opcional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-20 resize-none focus:border-primary/40"
        maxLength={500}
      />
      {status === "error" && (
        <p className="text-xs text-red-400">Algo deu errado. Por favor, tente novamente.</p>
      )}
      <Button
        type="submit"
        disabled={!email.trim() || status === "loading"}
        size="lg"
        className="w-full h-12 text-sm bg-primary text-black hover:bg-primary/90 font-black rounded-lg shadow-[0_0_40px_-8px_rgba(201,168,76,0.4)] hover:shadow-[0_0_60px_-8px_rgba(201,168,76,0.6)] transition-all duration-300"
      >
        {status === "loading" ? "Entrando..." : "Solicitar Acesso"}
        {status !== "loading" && <ArrowRight className="ml-2 w-4 h-4" />}
      </Button>
      <p className="text-center text-xs text-zinc-700">Sem spam. Sem cartão de crédito. Acesso concedido em lotes.</p>
    </form>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col selection:bg-primary/25 selection:text-white">

      {/* Navbar */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#080808]/85 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Logo size={30} showWordmark />
          <nav className="hidden md:flex items-center gap-6">
            {[["Recursos", "#features"], ["Como Funciona", "#how-it-works"], ["Preços", "#pricing"], ["FAQ", "#faq"]].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors font-medium"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="hidden sm:block text-sm font-medium text-zinc-500 hover:text-white transition-colors">
              Entrar
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-primary text-black hover:bg-primary/90 font-bold px-5 rounded-lg text-sm">
                Começar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">

        {/* ─── HERO ─── */}
        <section className="relative pt-24 pb-28 overflow-hidden">
          {/* Background glows */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,_rgba(201,168,76,0.16)_0%,_transparent_65%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_90%,_rgba(201,168,76,0.05)_0%,_transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_30%_30%_at_10%_80%,_rgba(96,165,250,0.04)_0%,_transparent_60%)] pointer-events-none" />

          {/* Subtle grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:72px_72px] pointer-events-none" />

          <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-10">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="max-w-4xl mx-auto text-center space-y-8"
            >
              {/* Badge */}
              <motion.div variants={fadeUp} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold tracking-wider uppercase">
                  <Sparkles className="w-3 h-3" />
                  Inteligência privada para fundadores de elite
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={fadeUp}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-5xl sm:text-6xl md:text-[78px] font-black tracking-[-0.035em] text-white leading-[1.04] px-2"
              >
                Your unfair edge
                <br />
                <span className="bg-gradient-to-r from-[#F0DC8A] via-[#C9A84C] to-[#9A6F28] bg-clip-text text-transparent">
                  in building businesses.
                </span>
              </motion.h1>

              {/* Sub */}
              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-base md:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed"
              >
                Não é mais um chatbot. IAttom Assist é uma plataforma de inteligência de negócios —
                construída para descobrir produtos, validar mercados e gerar campanhas com precisão cirúrgica.
              </motion.p>

              {/* CTAs */}
              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
              >
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-sm bg-primary text-black hover:bg-primary/90 font-bold rounded-lg w-full sm:w-auto shadow-[0_0_40px_-8px_rgba(201,168,76,0.5)] hover:shadow-[0_0_60px_-8px_rgba(201,168,76,0.6)] transition-all duration-300"
                  >
                    Começar Agora <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 text-sm border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white rounded-lg w-full sm:w-auto transition-all"
                  >
                    Entrar
                  </Button>
                </Link>
              </motion.div>

              {/* Subtle trust line */}
              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.45 }}
                className="text-xs text-zinc-600 mt-2"
              >
                Sem cartão de crédito &middot; Cancele quando quiser
              </motion.p>
            </motion.div>
          </div>
        </section>

        {/* ─── STATS STRIP ─── */}
        <section className="border-y border-white/[0.06] bg-white/[0.015]">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8">
            <StaggerSection className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <motion.div key={stat.label} variants={fadeUp} transition={{ duration: 0.4 }} className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5 text-primary/70" />
                      <p className="text-2xl font-black text-primary tracking-tight">{stat.value}</p>
                    </div>
                    <p className="text-xs text-zinc-600 font-medium">{stat.label}</p>
                  </motion.div>
                );
              })}
            </StaggerSection>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section id="how-it-works" className="py-28 bg-[#060606]">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <AnimatedSection className="text-center mb-16">
              <p className="text-xs text-primary uppercase tracking-widest font-bold mb-3">
                Como Funciona
              </p>
              <h2 className="text-3xl md:text-[42px] font-black text-white tracking-tight mb-4 leading-[1.1]">
                Da ideia à inteligência <br className="hidden sm:block" />
                <span className="text-zinc-400">em três passos.</span>
              </h2>
              <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
                Sem treinamento. Sem configurações complexas. Descreva o que precisa e a inteligência faz o resto.
              </p>
            </AnimatedSection>

            <StaggerSection className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.num}
                    variants={fadeUp}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="relative p-7 bg-[#0d0d0d] border border-white/[0.06] rounded-2xl hover:border-white/[0.10] transition-all duration-300"
                  >
                    {i < 2 && (
                      <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-white/[0.08] -translate-y-1/2" />
                    )}
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-4xl font-black text-white/[0.04] leading-none">{step.num}</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
                  </motion.div>
                );
              })}
            </StaggerSection>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="py-28 bg-[#080808]">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <AnimatedSection className="text-center mb-16">
              <p className="text-xs text-primary uppercase tracking-widest font-bold mb-3">
                A Plataforma
              </p>
              <h2 className="text-3xl md:text-[42px] font-black text-white tracking-tight mb-4 leading-[1.1]">
                Seis módulos. <span className="text-zinc-400">Precisão cirúrgica.</span>
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-sm leading-relaxed">
                Cada módulo é construído para um problema específico de negócio — não uma interface de chat genérica.
              </p>
            </AnimatedSection>

            <StaggerSection className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <motion.div
                    key={mod.title}
                    variants={fadeUp}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className={`group relative p-6 bg-[#0d0d0d] border border-white/[0.06] rounded-2xl hover:border-white/[0.12] transition-all duration-300 ${mod.glow}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border ${mod.bg}`}>
                        <Icon className={`w-5 h-5 ${mod.accent}`} />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${mod.bg} ${mod.accent}`}>
                        {mod.tag}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">{mod.title}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">{mod.desc}</p>
                  </motion.div>
                );
              })}
            </StaggerSection>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─── */}
        <section className="py-28 bg-[#060606] border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <AnimatedSection className="text-center mb-16">
              <p className="text-xs text-primary uppercase tracking-widest font-bold mb-3">
                Confiado por Fundadores
              </p>
              <h2 className="text-3xl md:text-[42px] font-black text-white tracking-tight leading-[1.1]">
                Resultados que <span className="text-zinc-400">falam por si.</span>
              </h2>
            </AnimatedSection>

            <StaggerSection className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {testimonials.map((t) => (
                <motion.div
                  key={t.name}
                  variants={fadeUp}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="p-6 bg-[#0d0d0d] border border-white/[0.06] rounded-2xl hover:border-white/[0.10] transition-all duration-300 flex flex-col gap-4"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-primary fill-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed flex-1">"{t.quote}"</p>
                  <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${t.color}`}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{t.name}</p>
                      <p className="text-[10px] text-zinc-600">{t.role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </StaggerSection>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" className="py-28 bg-[#080808] border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <AnimatedSection className="text-center mb-16">
              <p className="text-xs text-primary uppercase tracking-widest font-bold mb-3">
                Preços
              </p>
              <h2 className="text-3xl md:text-[42px] font-black text-white tracking-tight mb-4 leading-[1.1]">
                Planos para cada etapa. <span className="text-zinc-400">Escale quando precisar.</span>
              </h2>
              <p className="text-zinc-500 max-w-md mx-auto text-sm">
                Créditos renovam mensalmente. Sem taxas ocultas. Cancele quando quiser.
              </p>
            </AnimatedSection>

            <StaggerSection className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <motion.div
                  key={plan.name}
                  variants={fadeUp}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${
                    plan.highlight
                      ? "bg-primary/[0.06] border-primary/30 shadow-[0_0_60px_-12px_rgba(201,168,76,0.25)]"
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
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-0.5 mb-1.5">
                      <span className="text-4xl font-black text-white tracking-tight">{plan.price}</span>
                      {plan.period && <span className="text-zinc-600 text-sm ml-1">{plan.period}</span>}
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
                          ? "bg-primary text-black hover:bg-primary/90 shadow-[0_0_30px_-6px_rgba(201,168,76,0.4)]"
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
        <section id="faq" className="py-28 bg-[#060606] border-t border-white/[0.05]">
          <div className="max-w-3xl mx-auto px-5 sm:px-6">
            <AnimatedSection className="text-center mb-14">
              <p className="text-xs text-primary uppercase tracking-widest font-bold mb-3">
                FAQ
              </p>
              <h2 className="text-3xl md:text-[42px] font-black text-white tracking-tight leading-[1.1]">
                Perguntas respondidas.
              </h2>
            </AnimatedSection>

            <AnimatedSection className="space-y-3">
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </AnimatedSection>
          </div>
        </section>

        {/* ─── SIGNUP CTA ─── */}
        <section id="waitlist" className="py-24 bg-[#060606] border-t border-white/[0.05] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_rgba(201,168,76,0.06)_0%,_transparent_70%)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-10">
            <div className="max-w-xl mx-auto text-center mb-10">
              <AnimatedSection>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold tracking-wider uppercase mb-5">
                  <Rocket className="w-3 h-3" />
                  Acesso Antecipado
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">
                  Comece Gratuitamente
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Crie sua conta e comece a usar todos os módulos agora mesmo.
                </p>
              </AnimatedSection>
            </div>
            <div className="max-w-xs mx-auto">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="w-full h-12 text-sm bg-primary text-black hover:bg-primary/90 font-black rounded-lg shadow-[0_0_40px_-8px_rgba(201,168,76,0.4)] hover:shadow-[0_0_60px_-8px_rgba(201,168,76,0.6)] transition-all duration-300"
                >
                  Criar Conta <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <p className="text-center text-xs text-zinc-700 mt-3">Sem cartão de crédito. Configuração em segundos.</p>
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="py-28 bg-[#080808] border-t border-white/[0.05] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_100%,_rgba(201,168,76,0.1)_0%,_transparent_70%)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center relative z-10">
            <AnimatedSection className="max-w-2xl mx-auto space-y-7">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold tracking-wider uppercase">
                <Users className="w-3 h-3" />
                Junte-se aos primeiros usuários
              </div>
              <h2 className="text-3xl md:text-[48px] font-black text-white tracking-tight leading-[1.08]">
                Sua concorrência já está{" "}
                <br className="hidden sm:block" />
                usando inteligência.{" "}
                <span className="bg-gradient-to-r from-[#F0DC8A] via-[#C9A84C] to-[#9A6F28] bg-clip-text text-transparent">
                  E você?
                </span>
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed max-w-lg mx-auto">
                Comece em menos de 60 segundos. Sem cartão de crédito. Sem configuração.
                A plataforma de inteligência de negócios mais poderosa que você vai usar.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="h-12 px-10 text-sm bg-primary text-black hover:bg-primary/90 font-black rounded-lg shadow-[0_0_60px_-8px_rgba(201,168,76,0.5)] hover:shadow-[0_0_80px_-8px_rgba(201,168,76,0.65)] transition-all duration-300"
                  >
                    Começar Agora <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <p className="text-xs text-zinc-600">Comece gratuitamente &middot; Cancele quando quiser</p>
              </div>
            </AnimatedSection>
          </div>
        </section>

      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.06] bg-[#060606]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            <div>
              <Logo size={28} showWordmark />
              <p className="text-xs text-zinc-600 mt-3 leading-relaxed max-w-[220px]">
                Inteligência privada para fundadores que se recusam a construir no achismo.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Plataforma</p>
              <ul className="space-y-2.5">
                {[["Recursos", "#features"], ["Como Funciona", "#how-it-works"], ["Preços", "#pricing"]].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Conta</p>
              <ul className="space-y-2.5">
                {[["Entrar", "/sign-in"], ["Criar Conta", "/sign-up"], ["Painel", "/dashboard"]].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-700">
              &copy; {new Date().getFullYear()} IAttom Assist. Todos os direitos reservados.
            </p>
            <p className="text-xs text-zinc-700">
              Powered by GPT-5 &middot; Built on Replit
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
