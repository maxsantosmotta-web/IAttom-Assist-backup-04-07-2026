import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Globe, Shield, Sparkles, Target, Zap, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const features = [
  {
    icon: Target,
    title: "Product Discovery",
    desc: "Identify high-leverage market gaps before the competition even sees them.",
    accent: "text-primary",
    bg: "bg-primary/10 border-primary/20",
  },
  {
    icon: BarChart3,
    title: "Market Validation",
    desc: "Data-backed confidence. Test viability with synthetic audience models.",
    accent: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
  },
  {
    icon: Zap,
    title: "Campaign Generation",
    desc: "Deploy full-funnel marketing campaigns tailored to your niche, instantly.",
    accent: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
  },
  {
    icon: Shield,
    title: "Private Workspace",
    desc: "Your intelligence stays yours. Isolated, encrypted, never shared.",
    accent: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  },
  {
    icon: Globe,
    title: "Global Reach",
    desc: "Localize content and copy for 50+ markets in seconds.",
    accent: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
  },
  {
    icon: Sparkles,
    title: "Creative Assets",
    desc: "Generate studio-quality visuals and video scripts on demand.",
    accent: "text-rose-400",
    bg: "bg-rose-400/10 border-rose-400/20",
  },
];

const stats = [
  { value: "6", label: "AI Modules" },
  { value: "4", label: "Plan Tiers" },
  { value: "GPT-5", label: "Powered By" },
  { value: "100%", label: "Private" },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    credits: "50 credits / month",
    features: ["All 6 AI modules", "Private workspace", "Project management", "Activity history"],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    credits: "500 credits / month",
    features: ["All 6 AI modules", "Priority processing", "Credit rollover", "Export results"],
    cta: "Start Pro Trial",
    highlight: true,
  },
  {
    name: "Business",
    price: "$149",
    credits: "2,000 credits / month",
    features: ["Everything in Pro", "Team workspaces", "API access", "Priority support"],
    cta: "Start Business",
    highlight: false,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col selection:bg-primary/25 selection:text-white">
      {/* Navbar */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#080808]/90 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size={30} />
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link href="/sign-up">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-5 rounded-sm"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        {/* Hero */}
        <section className="relative pt-28 pb-24 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,_rgba(201,168,76,0.18)_0%,_transparent_65%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_80%,_rgba(201,168,76,0.04)_0%,_transparent_60%)] pointer-events-none" />

          <div className="container mx-auto px-6 relative z-10">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="max-w-4xl mx-auto text-center space-y-7"
            >
              <motion.div variants={fadeUp} transition={{ duration: 0.5 }}>
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wider uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  Private intelligence for elite founders
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                transition={{ duration: 0.55 }}
                className="text-5xl sm:text-6xl md:text-[76px] font-bold tracking-[-0.03em] text-white leading-[1.05]"
              >
                Your unfair edge in{" "}
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-[#EDD078] via-[#C9A84C] to-[#A07828] bg-clip-text text-transparent">
                  building businesses.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="text-base md:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed"
              >
                Not just another chat interface. IAttom Assist is a surgical tool designed to find
                products, validate markets, and generate campaigns with lethal precision.
              </motion.p>

              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
              >
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="h-13 px-8 text-base bg-primary text-black hover:bg-primary/90 font-bold rounded-sm w-full sm:w-auto"
                  >
                    Start Free Today <ArrowRight className="ml-2 w-4.5 h-4.5" />
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-13 px-8 text-base border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white rounded-sm w-full sm:w-auto"
                  >
                    Sign In
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="border-y border-white/5 bg-white/[0.015]">
          <div className="container mx-auto px-6 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 bg-[#060606]">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <p className="text-xs text-primary uppercase tracking-widest font-semibold mb-3">
                The Platform
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
                Surgical precision. Six tools.
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-sm leading-relaxed">
                Every module is engineered for maximum impact and minimum wasted effort.
              </p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto"
            >
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    variants={fadeUp}
                    transition={{ duration: 0.45 }}
                    className="group p-6 bg-[#0d0d0d] border border-white/5 rounded-xl hover:border-white/10 transition-all duration-200 hover:bg-[#101010]"
                  >
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border mb-4 ${feature.bg}`}
                    >
                      <Icon className={`w-5 h-5 ${feature.accent}`} />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1.5">{feature.title}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">{feature.desc}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-24 bg-[#080808]">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <p className="text-xs text-primary uppercase tracking-widest font-semibold mb-3">
                Pricing
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
                Start free. Scale when ready.
              </h2>
              <p className="text-zinc-400 max-w-md mx-auto text-sm">
                Credits reset monthly. No hidden fees. Cancel anytime.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative p-6 rounded-xl border transition-all duration-200 ${
                    plan.highlight
                      ? "bg-primary/5 border-primary/30 shadow-[0_0_40px_-8px_rgba(201,168,76,0.2)]"
                      : "bg-[#0d0d0d] border-white/5"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-primary text-black rounded-full">
                        Popular
                      </span>
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-zinc-400 mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-white">{plan.price}</span>
                      {plan.price !== "$0" && <span className="text-zinc-500 text-sm">/mo</span>}
                    </div>
                    <p className="text-xs text-primary font-medium">{plan.credits}</p>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-zinc-400">
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/sign-up">
                    <Button
                      className={`w-full rounded-sm font-semibold text-sm ${
                        plan.highlight
                          ? "bg-primary text-black hover:bg-primary/90"
                          : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-[#060606] border-t border-white/5">
          <div className="container mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Your competition is already using AI.
                <br />
                <span className="text-primary">Are you?</span>
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Join founders who have turned IAttom Assist into their most powerful business
                advantage. Start free in under 60 seconds.
              </p>
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="h-13 px-10 text-base bg-primary text-black hover:bg-primary/90 font-bold rounded-sm"
                >
                  Start Free Today <ArrowRight className="ml-2 w-4.5 h-4.5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t border-white/5 bg-[#080808]">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size={26} />
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} IAttom. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/sign-in" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              Sign In
            </Link>
            <Link href="/sign-up" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
