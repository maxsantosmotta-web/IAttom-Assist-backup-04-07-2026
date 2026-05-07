import { Link } from "wouter";
import { UserPlus, LogIn } from "lucide-react";
import { motion } from "framer-motion";

function IAttomBadge({ size = 240 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* ring shimmer — sweeps around the circle */}
        <linearGradient id="ig_ring" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FAE97A"/>
          <stop offset="18%"  stopColor="#B8840A"/>
          <stop offset="38%"  stopColor="#F0D050"/>
          <stop offset="55%"  stopColor="#ECC830"/>
          <stop offset="72%"  stopColor="#6A4400"/>
          <stop offset="88%"  stopColor="#E8C830"/>
          <stop offset="100%" stopColor="#FAE97A"/>
        </linearGradient>
        {/* A lettermark — bright gold top → deep amber bottom */}
        <linearGradient id="ig_a" x1="120" y1="42" x2="120" y2="162" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FAE870"/>
          <stop offset="35%"  stopColor="#D4A020"/>
          <stop offset="100%" stopColor="#6C4000"/>
        </linearGradient>
        {/* bars — gold top → dark amber bottom */}
        <linearGradient id="ig_bars" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#F0D040"/>
          <stop offset="100%" stopColor="#8A6010"/>
        </linearGradient>
        {/* IATTOM text — silver-white at top → gold → dark amber */}
        <linearGradient id="ig_text" x1="0" y1="155" x2="0" y2="183" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FEFCE8"/>
          <stop offset="28%"  stopColor="#F5DC60"/>
          <stop offset="60%"  stopColor="#C9A020"/>
          <stop offset="100%" stopColor="#7A5008"/>
        </linearGradient>
        {/* dark bg inside circle */}
        <radialGradient id="ig_bg" cx="50%" cy="38%" r="65%">
          <stop offset="0%"   stopColor="#221a08"/>
          <stop offset="100%" stopColor="#060504"/>
        </radialGradient>
      </defs>

      {/* ── rings ── */}
      {/* outermost glow */}
      <circle cx="120" cy="120" r="119.5" fill="none" stroke="#C49820" strokeWidth="1" opacity="0.22"/>
      {/* primary bold ring */}
      <circle cx="120" cy="120" r="116"   fill="none" stroke="url(#ig_ring)" strokeWidth="5.5"/>
      {/* secondary inner ring */}
      <circle cx="120" cy="120" r="109.5" fill="none" stroke="url(#ig_ring)" strokeWidth="1.5" opacity="0.6"/>
      {/* fill */}
      <circle cx="120" cy="120" r="108.5" fill="url(#ig_bg)"/>

      {/*
        ── "A" lettermark ──
        Wide, bold legs. Outer legs: x=48→192 bottom.
        Leg thickness ~22px at base.
        Crossbar at y=127–140.
        Counter (hole): inner triangle above crossbar.
        Using evenodd so inner triangle = hole.
      */}
      <path
        d="M120,42
           L194,162 L172,162
           L158,132 L82,132
           L68,162  L46,162
           Z
           M120,62 L156,124 L84,124 Z"
        fill="url(#ig_a)"
        fillRule="evenodd"
      />

      {/*
        ── Growth bar chart + arrow ──
        Bars overlap the right leg of the A and extend right.
        3 ascending bars left→right. Arrow goes upper-right.
      */}
      {/* bar 1 — shortest */}
      <rect x="152" y="120" width="9" height="18" rx="2" fill="url(#ig_bars)"/>
      {/* bar 2 — medium */}
      <rect x="163" y="107" width="9" height="31" rx="2" fill="url(#ig_bars)"/>
      {/* bar 3 — tallest */}
      <rect x="174" y="92"  width="9" height="46" rx="2" fill="url(#ig_bars)"/>
      {/* arrow line */}
      <polyline
        points="153,118 163,104 175,90 184,78"
        stroke="#FAE870"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* arrow head */}
      <polygon points="184,78 177,82 181,89" fill="#FAE870"/>

      {/*
        ── IATTOM wordmark ──
        Large, wide, metallic silver-to-gold gradient.
        Positioned in lower half of circle.
      */}
      <text
        x="120" y="182"
        textAnchor="middle"
        fontSize="28"
        fontWeight="900"
        fontFamily="'Arial Black', 'Arial Bold', Impact, Arial, sans-serif"
        fill="url(#ig_text)"
        letterSpacing="2"
      >IATTOM</text>

      {/* ── — ASSIST — tagline ── */}
      <text
        x="120" y="198"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="700"
        fontFamily="Arial, sans-serif"
        fill="#C49820"
        letterSpacing="4.5"
      >— ASSIST —</text>
    </svg>
  );
}

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
          className="drop-shadow-[0_0_18px_rgba(196,148,28,0.18)]"
        >
          <IAttomBadge size={216} />
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
