import { readFileSync, writeFileSync } from "node:fs";

function patch(path, replacements) {
  const fileUrl = new URL(path, import.meta.url);
  let source = readFileSync(fileUrl, "utf8");
  let changed = false;

  for (const [before, after] of replacements) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) {
      console.warn(`Visual marker not found in ${path}: ${before.slice(0, 90)}`);
      continue;
    }
    source = source.replaceAll(before, after);
    changed = true;
  }

  if (changed) {
    writeFileSync(fileUrl, source);
    console.log(`Safe visual polish applied to ${path}`);
  } else {
    console.log(`Safe visual polish already present or not applicable in ${path}`);
  }
}

patch("../src/pages/admin/AdminWaitlist.tsx", [
  [
    'bg-white/5 border-white/[0.06]',
    'bg-gradient-to-br from-blue-500/10 via-[#0d1015] to-[#0d1015] border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]'
  ],
  [
    'bg-amber-500/5 border-amber-500/10',
    'bg-gradient-to-br from-amber-500/10 via-[#0d1015] to-[#0d1015] border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]'
  ],
  [
    'bg-emerald-500/5 border-emerald-500/10',
    'bg-gradient-to-br from-emerald-500/10 via-[#0d1015] to-[#0d1015] border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]'
  ],
  [
    'bg-red-500/5 border-red-500/10',
    'bg-gradient-to-br from-rose-500/10 via-[#0d1015] to-[#0d1015] border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]'
  ],
  [
    'className="bg-[#111111] border-white/[0.06]"',
    'className="bg-gradient-to-br from-amber-500/[0.08] via-[#0d1015] to-[#0d1015] border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.02),0_18px_45px_rgba(0,0,0,.18)]"'
  ]
]);

patch("../src/pages/admin/AdminFeedback.tsx", [
  [
    'className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20"',
    'className="flex min-h-16 items-center gap-2 rounded-xl border border-white/[0.07] bg-gradient-to-br from-amber-500/10 via-[#0d1015] to-[#0d1015] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]"'
  ],
  [
    'className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"',
    'className="flex min-h-16 items-center gap-2 rounded-xl border border-white/[0.07] bg-gradient-to-br from-emerald-500/10 via-[#0d1015] to-[#0d1015] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]"'
  ],
  [
    'className="pl-9 bg-[#111111] border-white/[0.06] text-sm text-zinc-200 placeholder:text-zinc-700"',
    'className="pl-9 bg-gradient-to-br from-violet-500/[0.04] via-[#0d1015] to-[#0d1015] border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]"'
  ],
  [
    'className="text-center py-16 text-zinc-600"',
    'className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-violet-500/[0.06] via-[#0d1015] to-[#0d1015] py-16 text-center text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]"'
  ]
]);

patch("../src/pages/admin/AdminUsers.tsx", [
  [
`      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >`,
`      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-blue-500/10 via-[#0d1015] to-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-blue-300"><Users className="h-4 w-4" /></div>
          <p className="text-2xl font-bold text-white">{data?.total ?? 0}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Total</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-emerald-500/10 via-[#0d1015] to-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-emerald-300"><UserCheck className="h-4 w-4" /></div>
          <p className="text-2xl font-bold text-white">{((data?.users ?? []) as AdminUser[]).filter((user) => user.role === "user").length}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Usuários</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-rose-500/10 via-[#0d1015] to-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-rose-300"><ShieldOff className="h-4 w-4" /></div>
          <p className="text-2xl font-bold text-white">{((data?.users ?? []) as AdminUser[]).filter((user) => user.role === "admin").length}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Admins</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-amber-500/10 via-[#0d1015] to-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-amber-300"><Zap className="h-4 w-4" /></div>
          <p className="text-2xl font-bold text-white">{((data?.users ?? []) as AdminUser[]).reduce((sum, user) => sum + Number(user.credits || 0), 0)}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Créditos</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >`
  ],
  [
    'className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50 w-full"',
    'className="pl-10 bg-gradient-to-br from-blue-500/[0.04] via-[#0d1015] to-[#0d1015] border-white/[0.08] focus-visible:ring-primary/50 w-full shadow-[inset_0_1px_0_rgba(255,255,255,.02)]"'
  ],
  [
    'className="flex-1 min-w-[130px] sm:flex-none sm:w-36 bg-[#111111] border-white/5"',
    'className="flex-1 min-w-[130px] sm:flex-none sm:w-36 bg-gradient-to-br from-violet-500/[0.04] via-[#0d1015] to-[#0d1015] border-white/[0.08]"'
  ],
  [
    'className="bg-[#111111] border-white/5"',
    'className="bg-gradient-to-br from-blue-500/[0.035] via-[#0d1015] to-[#0d1015] border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.02)]"'
  ]
]);

patch("../src/pages/admin/AdminWebhooks.tsx", [
  [
    'className="bg-white/3 border-white/8"',
    'className="bg-gradient-to-br from-primary/10 via-[#0d1015] to-[#0d1015] border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.02),0_18px_45px_rgba(0,0,0,.18)]"'
  ],
  [
    'className="bg-white/3 border-white/8"',
    'className="bg-gradient-to-br from-cyan-500/[0.05] via-[#0d1015] to-[#0d1015] border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.02),0_18px_45px_rgba(0,0,0,.18)]"'
  ]
]);