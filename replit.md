# IAttom Assist

A premium dark-themed AI business assistant SaaS platform for product discovery, validation, campaign creation, content generation, creative generation, video scripts, and marketing automation. Full Clerk authentication, private user workspaces, full admin dashboard, private beta mode with waitlist, feedback collection, referral system, and smart upgrade/monetization layer.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/iattom-assist run dev` — run the frontend (port 25638)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (always fix `lib/api-zod/src/index.ts` after — must only export `./generated/api`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-products` — create Stripe products/prices in Stripe dashboard (run once after connecting Stripe integration)
- Required env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
- Beta mode: set `VITE_BETA_MODE=true` to enable invite-only access gate
- Stripe: connected via Replit Stripe integration (no manual API key needed)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, Framer Motion, shadcn/ui, Recharts, wouter, @clerk/react
- API: Express 5, @clerk/express, stripe, stripe-replit-sync
- DB: PostgreSQL + Drizzle ORM
- Auth: Clerk (Replit-managed) — email/password + Google OAuth
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Brand Identity

- Logo mark: `artifacts/iattom-assist/public/logo.svg` — "iA" lettermark (A with dot above), gold gradient, dark background.
- React logo component: `artifacts/iattom-assist/src/components/ui/Logo.tsx` — `<LogoMark size>` and `<Logo size showWordmark>`
- Loading screen: `artifacts/iattom-assist/src/components/LoadingScreen.tsx` — animated brand splash, auto-dismisses after 1.2s

## Where things live

- `artifacts/iattom-assist/src/App.tsx` — routing (lazy-loaded AI + admin + Referral pages), BetaGate wrapper
- `artifacts/iattom-assist/src/components/layout/SidebarLayout.tsx` — glass topbar, spring-animated nav pill, 15 nav items, Referral added
- `artifacts/iattom-assist/src/components/layout/AdminLayout.tsx` — admin shell (7 nav items)
- `artifacts/iattom-assist/src/components/PlanComparisonModal.tsx` — side-by-side plan comparison modal (openable from anywhere)
- `artifacts/iattom-assist/src/components/UpgradeNudge.tsx` — smart upgrade banner (triggers at <35% credits or power user; dismissible)
- `artifacts/iattom-assist/src/hooks/useMilestones.ts` — milestone celebration toasts (1/5/10/25/50 AI runs, 1/5 projects; localStorage-persisted)
- `artifacts/iattom-assist/src/pages/dashboard/Referral.tsx` — referral dashboard (code display, copy link, stats, apply code form)
- `artifacts/iattom-assist/src/pages/dashboard/Billing.tsx` — conversion-focused billing (upgrade nudge for free users, plan comparison CTA, referral CTA)
- `artifacts/iattom-assist/src/pages/dashboard/DashboardHome.tsx` — home with UpgradeNudge + useMilestones + achievements + onboarding
- `artifacts/iattom-assist/src/pages/admin/AdminAnalytics.tsx` — full analytics: growth KPIs, churn risk, plan distribution, feature adoption
- `artifacts/iattom-assist/src/components/CommandPalette.tsx` — Cmd+K palette (15 pages incl. Referrals)
- `lib/db/src/schema/referrals.ts` — referrals table (clerkUserId, code unique, totalUses, creditsEarned)
- `lib/db/src/schema/referralUses.ts` — referral_uses table (referralCode, referrerUserId, referredUserId unique, creditsAwarded)
- `artifacts/api-server/src/routes/referral.ts` — GET /referral/my, POST /referral/use (credit awards via DB transaction)
- `artifacts/api-server/src/routes/adminGrowth.ts` — GET /admin/growth-stats (MRR, conversion, activation, churn risk, referral stats)
- `artifacts/api-server/src/routes/admin.ts` — all other admin API routes (waitlist + feedback CRUD + launch-status)
- `artifacts/iattom-assist/src/lib/credits.ts` — FEATURE_COSTS, PLAN_CREDITS, PLAN_PRICES
- `artifacts/iattom-assist/src/components/CreditsGate.tsx` — feature gating; deducts credits, shows 402 upgrade modal
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `artifacts/api-server/src/routes/stripe.ts` — GET /stripe/plans, GET /stripe/subscription, POST /stripe/checkout, POST /stripe/portal

## Architecture decisions

- App is always dark mode; "dark" class applied globally to `<html>` — no theme toggle needed
- `lib/api-zod/src/index.ts` only exports from `./generated/api` (not `./generated/types`) to avoid naming conflicts from Orval split mode
- AI SSE protocol: `{type:"start"}` → `{type:"chunk",content:"..."}` → `{type:"result",data:{...}}` → `{type:"done"}` (or `{type:"error",message:"..."}`)
- Credits flow: CreditsGate deducts credits first (POST /api/credits/use), then onSuccess fires the AI fetch — AI routes do NOT deduct credits, only log to history
- Referral credits flow: POST /referral/use runs a DB transaction — referrer +50 credits, referred user +25 credits, both logged to creditsTransactions
- UpgradeNudge: client-side only, reads credits balance + summary stats; renders nothing if plan is paid and credits > 15%; dismissed state is per-mount (not persisted)
- useMilestones: localStorage-persisted via `iattom_milestones_v1` key; fires once per milestone, detects 7 action + project thresholds
- Referral/feedback/waitlist/notifications/prompts routes use direct fetch (not codegen) — not in the OpenAPI spec
- Growth stats (/admin/growth-stats): computed live from DB — MRR from plan×price table, churn = paid users with <15% credits left
- Stripe webhook at `POST /api/stripe/webhook` registered BEFORE `express.json()` in app.ts (needs raw Buffer)

## Product

- Landing page: hero, features, pricing, FAQ, waitlist section, final CTA
- Private beta mode: `VITE_BETA_MODE=true` gates dashboard; signed-in users without betaAccess see waitlist holding page
- User dashboard with sidebar (15 sections incl. Referrals + Cmd+K + Beta badge)
- **Referral system** (`/dashboard/referral`): unique 8-char code (XXXX-XXXX), shareable link, stats, apply-a-code form, recent referrals list
- **UpgradeNudge**: auto-shown banner on DashboardHome when credits < 35% OR totalActions ≥ 15 (power user). Three variants: low/critical/power
- **PlanComparisonModal**: beautiful side-by-side plan comparison; triggered from Billing, UpgradeNudge, CreditsGate
- **Milestone celebrations**: `useMilestones` fires toast on first run, 5/10/25/50 runs, first/5 projects
- **Billing page** (conversion-focused): free-user upgrade banner, "what Pro unlocks" grid, referral CTA section, plan comparison shortcut
- **Admin Analytics**: Revenue KPIs (MRR, subscribers, conversion rate, activation rate), churn risk list, plan distribution chart, referral stats, feature adoption
- **Command Palette** (Cmd+K): 15 pages including Referrals
- All 6 AI feature modules use real OpenAI GPT-5-mini via SSE streaming
- Lazy loading: all AI module pages + admin pages + Referral page via React.lazy + Suspense

## Protected Areas — ALTERAÇÃO BLOQUEADA SEM AUTORIZAÇÃO EXPLÍCITA

As áreas abaixo foram validadas e aprovadas. Nenhuma modificação deve ser feita nelas sem comando explícito do usuário. Antes de alterar qualquer arquivo listado, exibir o aviso: "Área protegida do projeto. Alteração bloqueada sem autorização explícita."

### Arquivos protegidos

| Área | Arquivos |
|---|---|
| Splash screen / animação inicial | `src/components/LoadingScreen.tsx` |
| Transição splash → conteúdo | `src/App.tsx` (bloco `showContent` / `onExitComplete`) |
| Login / Cadastro / Redefinição de senha | `src/pages/LandingPage.tsx` |
| Autenticação Clerk | `src/main.tsx`, qualquer configuração de `<ClerkProvider>` |
| PWA — manifest | `public/manifest.json` |
| PWA — service worker | `public/sw.js` |
| PWA — ícones | `public/icon-*.png`, `public/apple-touch-icon.png` |
| Logos aprovadas | `public/logo-nobg.png`, `public/logo-splash.png`, `public/logo.svg`, `src/components/ui/Logo.tsx` |
| HTML base (meta/preload/bg) | `index.html` |

### Regra

- Escopo de qualquer tarefa futura deve ser restrito ao que foi explicitamente solicitado.
- Se uma tarefa exigir alterar um arquivo protegido como efeito colateral, parar e informar antes de prosseguir.
- Correções de bugs dentro de `LandingPage.tsx` restritas à lógica solicitada — layout, animações e fluxo Clerk não devem ser tocados.

### PAINEL ADMINISTRATIVO — CONGELADO E VALIDADO (TODOS OS MÓDULOS)

O painel ADM está bloqueado em seu estado atual — ESTRUTURA COMPLETA CONGELADA E VALIDADA. Nenhuma alteração deve ser feita nos arquivos abaixo sem comando explícito e direto autorizando mudanças no painel administrativo.

| Arquivo | Módulo |
|---|---|
| `src/components/layout/AdminLayout.tsx` | Layout, sidebar e nav do painel ADM |
| `src/pages/admin/AdminGuard.tsx` | Guarda de acesso admin |
| `src/pages/admin/AdminOverview.tsx` | Visão Geral |
| `src/pages/admin/AdminAnalytics.tsx` | Análises |
| `src/pages/admin/AdminUsers.tsx` | Usuários |
| `src/pages/admin/AdminActivity.tsx` | Atividade |
| `src/pages/admin/AdminWaitlist.tsx` | Lista de Espera |
| `src/pages/admin/AdminFeedback.tsx` | Feedback |
| `src/pages/admin/AdminLaunchChecklist.tsx` | Checklist de Lançamento |
| `src/pages/admin/AdminIntegrations.tsx` | Integrações |
| `src/pages/admin/AdminWhatsApp.tsx` | WhatsApp |
| `src/pages/admin/AdminInstagram.tsx` | Instagram |
| `src/pages/admin/AdminFacebook.tsx` | Facebook |
| `src/pages/admin/AdminShopee.tsx` | Shopee |
| `src/pages/admin/AdminTikTok.tsx` | TikTok |
| `src/pages/admin/AdminMercadoLivre.tsx` | Mercado Livre |
| `src/pages/admin/AdminHotmart.tsx` | Hotmart |
| `src/pages/admin/AdminKiwify.tsx` | Kiwify |
| `src/pages/admin/AdminTrash.tsx` | Lixeira |

Proibido sem autorização explícita: layout, grid, cards, sidebar, navegação, estilos, responsividade, textos, cores, traduções, refatorações, componentes, alinhamentos, analytics, unificação com USER.

Regra de isolamento: qualquer nova implementação deve ocorrer somente no USER, ou em novos componentes separados, sem reutilizar ou modificar componentes críticos do ADMIN.

## REGRA GLOBAL DE PROTEÇÃO — ESTRUTURA VISUAL OFICIAL BLOQUEADA

O estado atual da plataforma é a BASE ESTÁVEL OFICIAL E APROVADA. Toda alteração futura deve ser estritamente cirúrgica.

### Regras de execução obrigatórias

1. NÃO alterar nada fora do escopo exato do comando solicitado.
2. NÃO otimizar componentes sem autorização explícita.
3. NÃO refatorar estrutura existente.
4. NÃO alterar estilos globais.
5. NÃO alterar textos que não forem citados explicitamente.
6. NÃO alterar cores já aprovadas.
7. NÃO alterar componentes compartilhados/globais sem autorização.
8. NÃO modificar rotas.
9. NÃO modificar lógica existente fora do alvo solicitado.
10. NÃO substituir componentes por versões "melhores".
11. NÃO alterar responsividade já aprovada.
12. NÃO alterar navbar, sidebar, cards, botões ou layouts sem comando direto.
13. NÃO alterar telas já aprovadas visualmente.
14. NÃO executar limpeza automática de código que possa impactar a interface.
15. NÃO alterar estados, providers ou stores globais sem autorização explícita.

### Protocolo antes de cada alteração

- Analisar impacto no restante da plataforma.
- Se houver risco indireto: NÃO executar alteração ampla. Aplicar solução isolada/local.
- Ao final: validar mobile, desktop, alinhamento e isolamento da alteração.

## MODO PROTEÇÃO — PROTOCOLO OPERACIONAL OBRIGATÓRIO

Estado atual: BASE ESTÁVEL VALIDADA E APROVADA. Nenhuma alteração é feita sem comando explícito do usuário.

### Declaração obrigatória antes de qualquer alteração

Antes de modificar qualquer arquivo, declarar obrigatoriamente:

1. **Arquivos que serão alterados** — lista exata, sem omissões
2. **Impacto esperado** — o que muda no comportamento ou na interface
3. **Risco** — classificado como: `baixo` / `médio` / `alto`

Se qualquer um desses três pontos não puder ser determinado com certeza, NÃO executar a alteração e informar ao usuário antes de prosseguir.

### Operações terminantemente proibidas sem autorização explícita

| Operação proibida | Motivo |
|---|---|
| "cleanup geral" / "limpeza automática" | Pode impactar silenciosamente dezenas de arquivos |
| "refactor completo" / "reestruturação" | Quebra compatibilidade com fluxos validados |
| "melhorias automáticas globais" | Escopo indefinido e não autorizado |
| "padronização automática" | Altera arquivos fora do escopo solicitado |
| "substituição ampla de componentes" | Remove comportamento aprovado |
| Alterar arquivos não citados na solicitação | Efeito colateral não autorizado |
| Otimizar código "de passagem" | Qualquer alteração não solicitada é proibida |
| Adicionar dependências sem autorização | Impacto em toda a build |
| Alterar `index.css`, `tailwind.config`, `vite.config` | Estilos globais congelados |
| Alterar rotas sem autorização explícita | Estrutura de navegação congelada |

### Escopo de cada tarefa

- Uma tarefa = um problema = arquivo(s) diretamente relacionados
- Arquivos não citados → NÃO tocar, mesmo que pareça "óbvio melhorar"
- Lógica não citada → NÃO tocar, mesmo que exista um bug aparente
- Se um bug colateral for encontrado → INFORMAR ao usuário, NÃO corrigir silenciosamente

### Áreas permanentemente congeladas (requer autorização nominal explícita)

- Layout visual, cores, tipografia, espaçamento
- Identidade visual: logo, ícones, splash, loading screen
- Autenticação: Clerk, providers, sessão, tokens
- Módulos AI já validados: prompts, parâmetros de modelo, estrutura de resposta
- Créditos: FEATURE_COSTS, PLAN_CREDITS, lógica de cobrança aprovada
- Stripe: planos, preços, webhook, checkout
- PWA: manifest, service worker, ícones
- Painel administrativo (congelado conforme seção anterior)
- Sidebar, navbar, CommandPalette, UpgradeNudge, PlanComparisonModal

## BLINDAGEM ESTRUTURAL — ARQUITETURA VALIDADA (checkpoint 7be9308)

### Princípios de arquitetura

1. **USER opera.** O painel do usuário é operacional: status, botões funcionais, métricas, produtos/vendas/eventos, campanha com contexto de plataforma.
2. **ADMIN monitora.** O painel ADM é somente leitura: status global, contas conectadas, KPIs, logs, webhooks. Sem operação manual na conta do usuário.
3. **Plataformas são hubs de integração** — não duplicam módulos centrais.
4. **Módulos centrais executam a inteligência:** Criar Campanha, Criar Imagem, Scripts de Vídeo, Criar Conteúdo. Botões de plataforma devem navegar para esses módulos com contexto da plataforma via `sessionStorage`.
5. **Nunca misturar dados ADMIN com dados USER.** Dados de plataforma no USER devem ser isolados por usuário (não puxar conta, token, produto ou log do ADMIN).

### Modelo de referência ADMIN

O `TikTok ADMIN` é o modelo canônico para todos os painéis administrativos: somente monitoramento, KPIs e logs — sem formulários de operação.

### Módulos USER validados e congelados

| Módulo | Rota | Status |
|---|---|---|
| Shopee USER | `/dashboard/shopee` | Validado |
| TikTok USER | `/dashboard/tiktok` | Validado |
| Hotmart USER | `/dashboard/hotmart` | Validado |
| Kiwify USER | `/dashboard/kiwify` | Validado |
| Meta USER | `/dashboard/meta` | Validado |
| WhatsApp USER | `/dashboard/whatsapp` | Validado |
| Criar Campanha | `/dashboard/create-campaign` | Validado |
| Criar Conteúdo | `/dashboard/create-content` | Validado |
| Criar Imagem (Gerador Criativo) | `/dashboard/creative-generator` | Validado |
| Scripts de Vídeo | `/dashboard/video-scripts` | Validado |
| Dashboard principal | `/dashboard` | Validado |
| Sidebar/Navegação | `SidebarLayout.tsx` | Validado |

### Padrão obrigatório USER

- Status da integração
- Botões funcionais (onClick definido — nenhum botão morto)
- Cards de métricas
- Produtos/vendas/eventos/logs quando aplicável
- Estados vazios profissionais
- Botão "Criar Campanha" com prefill via `sessionStorage`
- Webhook/endpoint quando aplicável
- Se API ainda não existir: modal ou toast informativo ("Função preparada para próxima etapa.")
- Toda ação assíncrona com estado de loading

### Padrão obrigatório ADMIN

- Status global + badges de configuração
- Contas/produtos/eventos sincronizados (somente leitura)
- KPIs e logs
- Webhooks (exibição + copy)
- Sem formulários de operação na conta do usuário

### Regras de execução críticas

1. Todo botão novo deve ter onClick funcional.
2. Nenhum botão pode ficar morto (catch vazio sem toast = botão morto).
3. Toda operação assíncrona deve ter loading + feedback visual.
4. Não misturar dados ADMIN com dados USER.
5. Não criar módulos duplicados para funções que já existem nos módulos centrais.
6. Não alterar módulos já aprovados sem necessidade direta e autorização explícita.
7. Antes de alterar arquivo compartilhado, verificar impacto nas telas validadas.

### Pendências registradas (ajuste futuro — NÃO executar sem autorização)

- Mercado Livre USER: isolar dados por usuário (atualmente puxa dados de nível admin)
- Kiwify ADMIN: validação final dos botões de credenciais
- Login: reduzir solicitações de confirmação de código (MFA flow)
- Padronizar todos os ADMINs no modelo TikTok (somente monitoramento)
- Renomear "Gerador Criativo" para "Criar Imagem" na UI
- Criar biblioteca/pasta para salvar campanhas, imagens, scripts e conteúdos
- Criar botão/fluxo "Criar Anúncio"
- Implementar OAuth real: Facebook, Instagram, WhatsApp, Hotmart, Kiwify, Shopee, Mercado Livre, TikTok
- Melhorar geração visual para nível premium máximo

## User preferences

- Dark premium design with gold accents (#C9A84C range)
- No emojis in UI
- Real AI via Replit-managed OpenAI integration (AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY); model: gpt-5-mini

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always re-run codegen AND fix `lib/api-zod/src/index.ts` (must only have `export * from "./generated/api"`)
- Never use `console.log` in server code — use `req.log` in handlers or `logger` singleton
- Wildcard routes in Express 5 must use `/{*splat}` syntax; `req.params.id` is `string | string[]` — cast with `as string`
- Clerk `<SignIn path>` and `<SignUp path>` must use **full** window paths including base path
- Routes must use `/*?` optional wildcard for Clerk multi-step OAuth sub-paths to work
- Tailwind v4: `tailwindcss({ optimize: false })` in vite.config.ts — prevents Clerk themes CSS reordering in prod
- `@layer theme, base, clerk, components, utilities;` must come before `@import "tailwindcss"` in index.css
- After changing schema files, run `pnpm run typecheck:libs` to rebuild composite lib declarations before API server typecheck
- `useGetMe` hook requires explicit `queryKey: getGetMeQueryKey()` in its options object
- Generated query hooks require `queryKey` using `getGet*QueryKey()` helpers
- Stripe webhook MUST be registered before `express.json()` in app.ts — `express.raw({ type: 'application/json' })` is applied only to that route
- Stripe products need `metadata: { plan: 'pro' }` etc. — run seed-products once after connecting Stripe
- Referral/feedback/waitlist/admin-growth routes use direct fetch (not generated hooks) — no codegen needed
- `credits.ts`: percentage is `Math.min(100, ...)` — referral bonuses can push balance above plan limit, capped at 100% display
- **Stripe key resolution** (`stripeClient.ts`): uses `STRIPE_SECRET_KEY` env secret only — no Replit connector proxy at all. Set `STRIPE_SECRET_KEY=sk_test_...` to enable billing. Leave unset for graceful billing-disabled mode.
- **Stripe is fully optional at startup**: DB migrations always run; if `STRIPE_SECRET_KEY` is not set, server starts cleanly, billing routes return 503, billing page shows "not configured for beta" — health check always passes
- `stripeService.ts` `BASE_PATH` uses `process.env.BASE_PATH` (server env), not `VITE_BASE_PATH` — these are different vars
- **`STRIPE_USE_LIVE_KEYS=true`** activates live Stripe connector environment — do NOT set until ready for live payments
- `VITE_BETA_MODE=true` is set as a shared env var AND baked into the frontend production build via `[services.production.build.env]` in artifact.toml

## Pointers

- See the `clerk-auth` skill for auth setup and customization details
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `react-vite` skill for frontend conventions
