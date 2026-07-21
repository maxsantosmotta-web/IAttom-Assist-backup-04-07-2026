import { readFileSync, writeFileSync } from "node:fs";

function patch(path, transforms) {
  const fileUrl = new URL(path, import.meta.url);
  let source = readFileSync(fileUrl, "utf8");
  let changed = false;

  for (const [before, after] of transforms) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) {
      console.warn(`Visual polish marker not found in ${path}: ${before.slice(0, 80)}`);
      continue;
    }
    source = source.replace(before, after);
    changed = true;
  }

  if (changed) {
    writeFileSync(fileUrl, source);
    console.log(`Visual polish applied to ${path}`);
  } else {
    console.log(`Visual polish already present or not applicable in ${path}`);
  }
}

patch("../src/pages/admin/AdminWaitlist.tsx", [
  [
`          { key: "all", label: "Total", icon: Users, color: "text-zinc-400", bg: "bg-white/5 border-white/[0.06]" },
          { key: "pending", label: "Pendente", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/10" },
          { key: "approved", label: "Aprovado", icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/10" },
          { key: "denied", label: "Negado", icon: UserX, color: "text-red-400", bg: "bg-red-500/5 border-red-500/10" },`,
`          { key: "all", label: "Total", icon: Users, color: "text-blue-300", glow: "rgba(96,165,250,.12)" },
          { key: "pending", label: "Pendente", icon: Clock, color: "text-amber-300", glow: "rgba(245,180,35,.12)" },
          { key: "approved", label: "Aprovado", icon: UserCheck, color: "text-emerald-300", glow: "rgba(16,185,129,.12)" },
          { key: "denied", label: "Negado", icon: UserX, color: "text-rose-300", glow: "rgba(244,63,94,.11)" },`
  ],
  [
`              className={\`p-4 rounded-xl border text-left transition-all \${stat.bg} \${filter === stat.key ? "ring-1 ring-primary/30" : ""}\`}
            >`,
`              className={\`relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1015] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.22)] transition-all \${filter === stat.key ? "ring-1 ring-primary/35" : "hover:border-white/[0.12]"}\`}
              style={{ backgroundImage: \`radial-gradient(circle at 18% 16%, \${stat.glow}, transparent 48%), linear-gradient(135deg, rgba(255,255,255,.014), transparent 55%)\` }}
            >`
  ],
  [
`                <Icon className={\`w-4 h-4 \${stat.color}\`} />`,
`                <div className={\`flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] \${stat.color}\`}><Icon className="h-4 w-4" /></div>`
  ],
  [
`        <Card className="bg-[#111111] border-white/[0.06]">`,
`        <Card className="border-white/[0.07] bg-[#0d1015] shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]" style={{ backgroundImage: "radial-gradient(circle at 12% 18%, rgba(245,180,35,.08), transparent 44%), linear-gradient(135deg, rgba(255,255,255,.012), transparent 55%)" }}>`
  ],
]);

patch("../src/pages/admin/AdminFeedback.tsx", [
  [
`      {/* Response summary chips */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">`,
`      {/* Response summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-h-20 items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]" style={{ backgroundImage: "radial-gradient(circle at 12% 30%, rgba(245,180,35,.12), transparent 46%)" }}>`
  ],
  [
`        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">`,
`        <div className="flex min-h-20 items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]" style={{ backgroundImage: "radial-gradient(circle at 12% 30%, rgba(16,185,129,.12), transparent 46%)" }}>`
  ],
  [
`        <div className="text-center py-16 text-zinc-600">
          <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum feedback encontrado</p>
        </div>`,
`        <div className="rounded-xl border border-white/[0.07] bg-[#0d1015] py-16 text-center text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]" style={{ backgroundImage: "radial-gradient(circle at 50% 20%, rgba(167,139,250,.07), transparent 42%)" }}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]"><MessageSquare className="h-5 w-5 text-white/[0.18]" /></div>
          <p className="text-sm font-medium text-zinc-500">Nenhum feedback encontrado</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-700">Os feedbacks enviados pelos usuários aparecerão aqui para revisão e resposta.</p>
        </div>`
  ],
  [
`          className="pl-9 bg-[#111111] border-white/[0.06] text-sm text-zinc-200 placeholder:text-zinc-700"`,
`          className="pl-9 bg-[#0d1015] border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]"`
  ],
]);

patch("../src/pages/admin/AdminUsers.tsx", [
  [
`      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >`,
`      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: data?.total ?? 0, icon: Users, color: "text-blue-300", glow: "rgba(96,165,250,.12)" },
          { label: "Usuários", value: (data?.users ?? []).filter((user) => user.role === "user").length, icon: UserCheck, color: "text-emerald-300", glow: "rgba(16,185,129,.12)" },
          { label: "Admins", value: (data?.users ?? []).filter((user) => user.role === "admin").length, icon: ShieldOff, color: "text-rose-300", glow: "rgba(244,63,94,.11)" },
          { label: "Créditos", value: (data?.users ?? []).reduce((sum, user) => sum + Number(user.credits || 0), 0), icon: Zap, color: "text-amber-300", glow: "rgba(245,180,35,.12)" },
        ].map(({ label, value, icon: Icon, color, glow }) => (
          <div key={label} className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]" style={{ backgroundImage: \`radial-gradient(circle at 18% 16%, \${glow}, transparent 48%), linear-gradient(135deg, rgba(255,255,255,.014), transparent 55%)\` }}>
            <div className={\`mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] \${color}\`}><Icon className="h-4 w-4" /></div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >`
  ],
  [
`            className="pl-10 bg-[#111111] border-white/5 focus-visible:ring-primary/50 w-full"`,
`            className="pl-10 bg-[#0d1015] border-white/[0.08] focus-visible:ring-primary/50 w-full shadow-[inset_0_1px_0_rgba(255,255,255,.02)]"`
  ],
]);

patch("../src/pages/admin/AdminWebhooks.tsx", [
  [
`  const kpis = [
    { label: "Total de Eventos",   value: events.length > 0 ? String(events.length) : "—", icon: Package,   color: "text-primary"      },
    { label: "Eventos (24h)",      value: String(recent24h),                                icon: Activity,  color: "text-emerald-400"  },
    { label: "Plataformas",        value: String(Object.keys(byPlatform).length),           icon: BarChart2, color: "text-violet-400"   },
    { label: "Última Atualização", value: lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—", icon: Clock, color: "text-zinc-400" },
  ];`,
`  const kpis = [
    { label: "Total de Eventos", value: events.length > 0 ? String(events.length) : "—", icon: Package, color: "text-amber-300", glow: "rgba(245,180,35,.12)" },
    { label: "Eventos (24h)", value: String(recent24h), icon: Activity, color: "text-emerald-300", glow: "rgba(16,185,129,.12)" },
    { label: "Plataformas", value: String(Object.keys(byPlatform).length), icon: BarChart2, color: "text-violet-300", glow: "rgba(139,92,246,.12)" },
    { label: "Última Atualização", value: lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—", icon: Clock, color: "text-blue-300", glow: "rgba(96,165,250,.11)" },
  ];`
  ],
  [
`        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-white/3 border-white/8">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-tight">{label}</p>
                <Icon className={\`w-3.5 h-3.5 \${color} shrink-0\`} />
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
            </CardContent>
          </Card>
        ))}`,
`        {kpis.map(({ label, value, icon: Icon, color, glow }) => (
          <Card key={label} className="relative overflow-hidden border-white/[0.07] bg-[#0d1015] shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)]" style={{ backgroundImage: \`radial-gradient(circle at 18% 16%, \${glow}, transparent 48%), linear-gradient(135deg, rgba(255,255,255,.014), transparent 55%)\` }}>
            <CardContent className="p-4">
              <div className={\`mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] \${color}\`}><Icon className="h-4 w-4" /></div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
            </CardContent>
          </Card>
        ))}`
  ],
  [
`      <Card className="bg-white/3 border-white/8">`,
`      <Card className="border-white/[0.07] bg-[#0d1015] shadow-[inset_0_1px_0_rgba(255,255,255,.02),0_18px_45px_rgba(0,0,0,.18)]" style={{ backgroundImage: "radial-gradient(circle at 50% 10%, rgba(34,211,238,.045), transparent 42%)" }}>`
  ],
]);
