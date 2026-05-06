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
    title: "Product Discovery",
    desc: "Uncover hidden market opportunities before your competitors even know they exist. Our AI maps demand signals across 200+ categories.",
    accent: "text-primary",
    bg: "bg-primary/8 border-primary/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(201,168,76,0.3)]",
    tag: "5 credits",
  },
  {
    icon: BarChart3,
    title: "Market Validation",
    desc: "Test viability with synthetic audience models and competitive density scoring. Kill bad ideas fast, back winners with data.",
    accent: "text-blue-400",
    bg: "bg-blue-400/8 border-blue-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(96,165,250,0.25)]",
    tag: "5 credits",
  },
  {
    icon: Rocket,
    title: "Campaign Generator",
    desc: "Deploy full-funnel marketing campaigns tailored to your niche. Audience targeting, messaging frameworks, channel strategies.",
    accent: "text-amber-400",
    bg: "bg-amber-400/8 border-amber-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(251,191,36,0.25)]",
    tag: "10 credits",
  },
  {
    icon: Brain,
    title: "Content Engine",
    desc: "Generate SEO-optimized blog posts, email sequences, landing page copy, and social content. Conversion-focused by default.",
    accent: "text-emerald-400",
    bg: "bg-emerald-400/8 border-emerald-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(52,211,153,0.25)]",
    tag: "8 credits",
  },
  {
    icon: Sparkles,
    title: "Creative Generator",
    desc: "Studio-quality creative concepts, visual briefs, ad frameworks, and brand direction — without the agency price tag.",
    accent: "text-purple-400",
    bg: "bg-purple-400/8 border-purple-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(192,132,252,0.25)]",
    tag: "15 credits",
  },
  {
    icon: Play,
    title: "Video Scripts",
    desc: "Craft viral-ready YouTube, TikTok, and ad scripts with hooks that stop the scroll, stories that build trust, and CTAs that convert.",
    accent: "text-rose-400",
    bg: "bg-rose-400/8 border-rose-400/15",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(251,113,133,0.25)]",
    tag: "10 credits",
  },
];

const steps = [
  {
    num: "01",
    title: "Describe your goal",
    desc: "Tell the AI what you're building, validating, or launching. No prompting expertise needed.",
    icon: Brain,
  },
  {
    num: "02",
    title: "AI generates intelligence",
    desc: "GPT-5 processes your input against real market patterns and generates structured, actionable output.",
    icon: Zap,
  },
  {
    num: "03",
    title: "Save, refine, launch",
    desc: "Export insights to your private workspace, iterate, and move from idea to execution in minutes.",
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
    name: "Free",
    price: "$0",
    period: "",
    credits: "50 credits / month",
    features: [
      "All 6 AI modules",
      "Private workspace",
      "Project management",
      "Activity history",
    ],
    cta: "Get Started Free",
    highlight: false,
    badge: null,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$79",
    period: "/mo",
    credits: "500 credits / month",
    features: [
      "All 6 AI modules",
      "Priority AI processing",
      "Unlimited projects",
      "Export results",
      "Priority support",
    ],
    cta: "Start Pro",
    highlight: true,
    badge: "Most Popular",
  },
  {
    key: "business",
    name: "Business",
    price: "$199",
    period: "/mo",
    credits: "2,000 credits / month",
    features: [
      "Everything in Pro",
      "Team workspace",
      "Advanced analytics",
      "API access",
      "Dedicated support",
    ],
    cta: "Start Business",
    highlight: false,
    badge: null,
  },
  {
    key: "agency",
    name: "Agency",
    price: "$499",
    period: "/mo",
    credits: "10,000 credits / month",
    features: [
      "Everything in Business",
      "Multi-client workspaces",
      "White-label reports",
      "Custom integrations",
      "SLA + dedicated CSM",
    ],
    cta: "Start Agency",
    highlight: false,
    badge: "Best Value",
  },
];

const faqs = [
  {
    q: "What are credits and how do they work?",
    a: "Credits are consumed each time you run an AI module. Different modules have different costs based on complexity — Product Discovery costs 5 credits, Campaign Generation costs 10, and Creative Generator costs 15. Credits reset every month on your billing date.",
  },
  {
    q: "Can I upgrade or downgrade my plan?",
    a: "Yes, anytime. Upgrades take effect immediately and you're prorated for the remainder of your billing cycle. Downgrades apply at the start of your next billing period.",
  },
  {
    q: "Is my data private and secure?",
    a: "Completely. Every account has an isolated private workspace. Your queries, results, and projects are never shared with other users or used to train AI models. All data is encrypted at rest and in transit.",
  },
  {
    q: "Which AI model powers IAttom Assist?",
    a: "IAttom Assist runs on GPT-5 mini, accessed through a secure Replit-managed integration. You get frontier-model intelligence without managing API keys or worrying about rate limits.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "You'll see a clear notification and won't be charged for partial results. You can upgrade your plan immediately to get more credits, or wait until your next monthly reset if you're on Free.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "The Free plan lets you explore all 6 AI modules with 50 credits — no credit card required. This gives you a real taste of the platform before you decide to upgrade.",
  },
];

const stats = [
  { value: "6", label: "AI Modules", icon: Brain },
  { value: "GPT-5", label: "Powered By", icon: Sparkles },
  { value: "100%", label: "Private Workspace", icon: Shield },
  { value: "4", label: "Plan Tiers", icon: TrendingUp },
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
        <p className="text-base font-bold text-primary mb-1">Already registered</p>
        <p className="text-sm text-zinc-500">That email is already on the waitlist. We'll be in touch.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Input
            type="text"
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-11 focus:border-primary/40"
          />
        </div>
        <div>
          <Input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-11 focus:border-primary/40"
          />
        </div>
      </div>
      <Textarea
        placeholder="What will you use IAttom Assist for? (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="bg-[#111111] border-white/[0.08] text-zinc-200 placeholder:text-zinc-700 h-20 resize-none focus:border-primary/40"
        maxLength={500}
      />
      {status === "error" && (
        <p className="text-xs text-red-400">Something went wrong. Please try again.</p>
      )}
      <Button
        type="submit"
        disabled={!email.trim() || status === "loading"}
        size="lg"
        className="w-full h-12 text-sm bg-primary text-black hover:bg-primary/90 font-black rounded-lg shadow-[0_0_40px_-8px_rgba(201,168,76,0.4)] hover:shadow-[0_0_60px_-8px_rgba(201,168,76,0.6)] transition-all duration-300"
      >
        {status === "loading" ? "Joining..." : "Request Beta Access"}
        {status !== "loading" && <ArrowRight className="ml-2 w-4 h-4" />}
      </Button>
      <p className="text-center text-xs text-zinc-700">No spam. No credit card. Access granted in batches.</p>
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
            {[["Features", "#features"], ["How it Works", "#how-it-works"], ["Pricing", "#pricing"], ["FAQ", "#faq"]].map(([label, href]) => (
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
              Sign In
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-primary text-black hover:bg-primary/90 font-bold px-5 rounded-lg text-sm">
                Get Started
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
                  Private intelligence for elite founders
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
                Not another chatbot. IAttom Assist is a surgical business intelligence platform — 
                built to find products, validate markets, and generate campaigns with lethal precision.
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
                    Start Free Today <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 text-sm border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white rounded-lg w-full sm:w-auto transition-all"
                  >
                    Sign In
                  </Button>
                </Link>
              </motion.div>

              {/* Subtle trust line */}
              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.45 }}
                className="text-xs text-zinc-600 mt-2"
              >
                No credit card required &middot; Free plan forever &middot; Cancel anytime
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
                How it Works
              </p>
              <h2 className="text-3xl md:text-[42px] font-black text-white tracking-tight mb-4 leading-[1.1]">
                From idea to intelligence <br className="hidden sm:block" />
                <span className="text-zinc-400">in three steps.</span>
              </h2>
              <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
                No training required. No complex setups. Just describe what you need and let the AI work.
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
                The Platform
              </p>
              <h2 className="text-3xl md:text-[42px] font-black text-white tracking-tight mb-4 leading-[1.1]">
                Six modules. <span className="text-zinc-400">Surgical precision.</span>
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-sm leading-relaxed">
                Every AI module is purpose-built for a specific business problem — not a generic chat interface.
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
                Trusted by Founders
              </p>
              <h2 className="text-3xl md:text-[42px] font-black text-white tracking-tight leading-[1.1]">
                Results that speak <span className="text-zinc-400">for themselves.</span>
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
                Pricing
              </p>
              <h2 className="text-3xl md:text-[42px] font-black text-white tracking-tight mb-4 leading-[1.1]">
                Start free. <span className="text-zinc-400">Scale when ready.</span>
              </h2>
              <p className="text-zinc-500 max-w-md mx-auto text-sm">
                Credits reset monthly. No hidden fees. Cancel anytime. Upgrade or downgrade instantly.
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
                Questions answered.
              </h2>
            </AnimatedSection>

            <AnimatedSection className="space-y-3">
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </AnimatedSection>
          </div>
        </section>

        {/* ─── WAITLIST ─── */}
        <section id="waitlist" className="py-24 bg-[#060606] border-t border-white/[0.05] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_rgba(201,168,76,0.06)_0%,_transparent_70%)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-10">
            <div className="max-w-xl mx-auto text-center mb-10">
              <AnimatedSection>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold tracking-wider uppercase mb-5">
                  <Rocket className="w-3 h-3" />
                  Private Beta
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">
                  Get Early Access
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  IAttom Assist is currently in private beta. Join the waitlist and we'll grant access in batches as we scale.
                </p>
              </AnimatedSection>
            </div>
            <WaitlistForm />
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="py-28 bg-[#080808] border-t border-white/[0.05] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_100%,_rgba(201,168,76,0.1)_0%,_transparent_70%)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center relative z-10">
            <AnimatedSection className="max-w-2xl mx-auto space-y-7">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold tracking-wider uppercase">
                <Users className="w-3 h-3" />
                Join the founding cohort
              </div>
              <h2 className="text-3xl md:text-[48px] font-black text-white tracking-tight leading-[1.08]">
                Your competition is already{" "}
                <br className="hidden sm:block" />
                using AI.{" "}
                <span className="bg-gradient-to-r from-[#F0DC8A] via-[#C9A84C] to-[#9A6F28] bg-clip-text text-transparent">
                  Are you?
                </span>
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed max-w-lg mx-auto">
                Start free in under 60 seconds. No credit card. No setup. 
                Just the most powerful AI business platform you'll ever use.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="h-12 px-10 text-sm bg-primary text-black hover:bg-primary/90 font-black rounded-lg shadow-[0_0_60px_-8px_rgba(201,168,76,0.5)] hover:shadow-[0_0_80px_-8px_rgba(201,168,76,0.65)] transition-all duration-300"
                  >
                    Start Free Today <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <p className="text-xs text-zinc-600">Free forever &middot; Upgrade anytime</p>
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
                Private AI intelligence for founders who refuse to build on guesswork.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Platform</p>
              <ul className="space-y-2.5">
                {[["Features", "#features"], ["How it Works", "#how-it-works"], ["Pricing", "#pricing"]].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Account</p>
              <ul className="space-y-2.5">
                {[["Sign In", "/sign-in"], ["Create Account", "/sign-up"], ["Dashboard", "/dashboard"]].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-700">
              &copy; {new Date().getFullYear()} IAttom Assist. All rights reserved.
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
