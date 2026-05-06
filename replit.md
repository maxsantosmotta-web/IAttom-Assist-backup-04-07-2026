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
- **Stripe env selector**: `stripeClient.ts` always uses `"development"` (test/sandbox) connector unless `STRIPE_USE_LIVE_KEYS=true` is set — do NOT set this until ready for live payments
- `stripeService.ts` `BASE_PATH` uses `process.env.BASE_PATH` (server env), not `VITE_BASE_PATH` — these are different vars
- `VITE_BETA_MODE=true` is set as a shared env var AND baked into the frontend production build via `[services.production.build.env]` in artifact.toml

## Pointers

- See the `clerk-auth` skill for auth setup and customization details
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `react-vite` skill for frontend conventions
