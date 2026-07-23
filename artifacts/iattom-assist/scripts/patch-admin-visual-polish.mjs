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

patch("../src/pages/admin/AdminUsers.tsx", [
  [
    'free: "Gratuito",',
    'free: "FREE",'
  ],
  [
    '<SelectItem value="free">Gratuito</SelectItem>',
    '<SelectItem value="free">FREE</SelectItem>'
  ],
  [
`      </motion.div>

      <div className="flex flex-wrap items-center gap-3">`,
`      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-blue-500/10 via-[#0d1015] to-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-blue-300"><Users className="h-4 w-4" /></div>
          <p className="text-2xl font-bold text-white">{data?.total ?? 0}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Total de usuários</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-emerald-500/10 via-[#0d1015] to-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-emerald-300"><UserCheck className="h-4 w-4" /></div>
          <p className="text-2xl font-bold text-white">{((data?.users ?? []) as AdminUser[]).filter((user) => user.role === "user").length}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Usuários</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-rose-500/10 via-[#0d1015] to-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-rose-300"><ShieldOff className="h-4 w-4" /></div>
          <p className="text-2xl font-bold text-white">{((data?.users ?? []) as AdminUser[]).filter((user) => user.role === "admin").length}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Administradores</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-amber-500/10 via-[#0d1015] to-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-amber-300"><Zap className="h-4 w-4" /></div>
          <p className="text-2xl font-bold text-white">{((data?.users ?? []) as AdminUser[]).reduce((sum, user) => sum + Number(user.credits || 0) + Number(user.extraCredits || 0), 0)}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Créditos disponíveis</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-gradient-to-br from-primary/[0.05] via-[#0d1015] to-[#0d1015] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]">`
  ],
  [
    'className="pl-10 bg-[#111111] border-white/5"',
    'className="pl-10 bg-[#090b0f] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,.02)] focus-visible:ring-primary/40"'
  ],
  [
    'className="w-40 bg-[#111111] border-white/5"',
    'className="w-40 bg-[#090b0f] border-white/[0.08]"'
  ],
  [
    'className="w-36 bg-[#111111] border-white/5"',
    'className="w-36 bg-[#090b0f] border-white/[0.08]"'
  ],
  [
    '<div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="w-4 h-4" /> {data?.total ?? 0} usuários</div>',
    '<div className="ml-auto flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-zinc-400"><Users className="h-4 w-4 text-primary" /><span className="font-semibold text-white">{data?.total ?? 0}</span> usuários</div>'
  ],
  [
    '<Card className="bg-[#111111] border-white/5 overflow-hidden">',
    '<Card className="overflow-hidden border-white/[0.07] bg-gradient-to-br from-blue-500/[0.035] via-[#0d1015] to-[#0d1015] shadow-[inset_0_1px_0_rgba(255,255,255,.02),0_24px_60px_rgba(0,0,0,.22)]">'
  ],
  [
    '<thead><tr className="border-b border-white/5">',
    '<thead className="bg-white/[0.025]"><tr className="border-b border-white/[0.07]">'
  ],
  [
    'className="text-left px-5 py-3.5 text-xs text-muted-foreground"',
    'className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500"'
  ],
  [
    'className="text-left px-4 py-3.5 text-xs text-muted-foreground"',
    'className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500"'
  ],
  [
    'className="text-right px-4 py-3.5 text-xs text-muted-foreground"',
    'className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-zinc-500"'
  ],
  [
    'className="border-b border-white/5 hover:bg-white/[0.02]"',
    'className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.035]"'
  ],
  [
    'className="px-5 py-3"',
    'className="px-5 py-4"'
  ],
  [
    'className="p-1 text-muted-foreground hover:text-primary"',
    'className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-zinc-500 transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary"'
  ],
  [
    'className="p-1 text-muted-foreground hover:text-red-400"',
    'className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-zinc-500 transition-all hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-400"'
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