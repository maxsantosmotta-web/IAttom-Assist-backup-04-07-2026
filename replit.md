# IAttom Assist

A premium dark-themed AI business assistant SaaS platform for product discovery, validation, campaign creation, content generation, creative generation, video scripts, and marketing automation. Full Clerk authentication, private user workspaces, and a full admin dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/iattom-assist run dev` — run the frontend (port 25638)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (always fix `lib/api-zod/src/index.ts` after — must only export `./generated/api`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-products` — create Stripe products/prices in Stripe dashboard (run once after connecting Stripe integration)
- Required env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
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

- Logo mark: `artifacts/iattom-assist/public/logo.svg` — "iA" lettermark (A with dot above), gold gradient, dark background. Same design as favicon.svg (32px version).
- React logo component: `artifacts/iattom-assist/src/components/ui/Logo.tsx` — exports `<LogoMark size>` and `<Logo size showWordmark>`. Use in all layouts instead of Sparkles icon.
- Loading screen: `artifacts/iattom-assist/src/components/LoadingScreen.tsx` — animated brand splash. Rendered via `AnimatePresence` in App.tsx, auto-dismisses after 1.6s.

## Where things live

- `artifacts/iattom-assist/src/App.tsx` — ClerkProvider, routing, sign-in/sign-up, admin routes
- `artifacts/iattom-assist/src/pages/` — dashboard pages + admin pages (admin/)
- `artifacts/iattom-assist/src/components/layout/SidebarLayout.tsx` — user dashboard shell (syncs user on mount, shows Admin Panel link for admins)
- `artifacts/iattom-assist/src/components/layout/AdminLayout.tsx` — admin dashboard shell
- `artifacts/iattom-assist/src/pages/admin/AdminGuard.tsx` — admin role guard + first-admin bootstrap flow
- `artifacts/iattom-assist/src/lib/credits.ts` — FEATURE_COSTS, PLAN_CREDITS, PLAN_PRICES, getCreditColor/getCreditBarColor
- `artifacts/iattom-assist/src/components/CreditsGate.tsx` — wraps AI action buttons; deducts credits, shows 402 upgrade modal
- `artifacts/iattom-assist/src/pages/dashboard/Credits.tsx` — credits balance + transaction history page
- `artifacts/api-server/src/lib/credits.ts` — deductCredits, adjustCredits, getTransactionCount helpers
- `artifacts/api-server/src/routes/credits.ts` — GET /credits/balance, GET /credits/transactions, POST /credits/use
- `lib/db/src/schema/creditsTransactions.ts` — credits_transactions table (clerkUserId, amount, balanceAfter, type, feature, description)
- `artifacts/iattom-assist/src/index.css` — dark theme, gold accent CSS variables, Clerk layer ordering
- `artifacts/iattom-assist/public/logo.svg` — branded SVG logo
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/users.ts` — users table (clerkId, role, plan, credits, stripeCustomerId, stripeSubscriptionId, stripeSubscriptionStatus)
- `artifacts/api-server/src/lib/stripeClient.ts` — getUncachableStripeClient(), getStripeSync() via Replit connector
- `artifacts/api-server/src/lib/stripeService.ts` — ensureStripeCustomer(), createCheckoutSession(), createBillingPortalSession()
- `artifacts/api-server/src/lib/stripeStorage.ts` — queries against stripe.* schema (subscriptions, products, prices)
- `artifacts/api-server/src/lib/webhookHandlers.ts` — webhook: stripe-replit-sync sync + business logic (plan+credits update)
- `artifacts/api-server/src/routes/stripe.ts` — GET /stripe/plans, GET /stripe/subscription, POST /stripe/checkout, POST /stripe/portal
- `artifacts/iattom-assist/src/pages/dashboard/Billing.tsx` — Billing page: plan grid, current sub status, checkout/portal
- `scripts/src/seed-products.ts` — create Pro/Business/Agency products in Stripe with plan metadata
- `lib/db/src/schema/projects.ts` — projects table (clerkUserId scoping)
- `lib/db/src/schema/history.ts` — history/activity table (clerkUserId scoping)
- `artifacts/api-server/src/middlewares/requireAuth.ts` — Clerk auth guard middleware
- `artifacts/api-server/src/middlewares/requireAdmin.ts` — admin role guard (checks users table)
- `artifacts/api-server/src/lib/userSync.ts` — getOrSyncUser(), getAdminCount() helpers
- `artifacts/api-server/src/routes/authRoutes.ts` — POST /auth/sync, GET /auth/me, POST /admin/bootstrap
- `artifacts/api-server/src/routes/admin.ts` — all admin API routes
- `artifacts/api-server/src/routes/ai.ts` — 6 AI SSE endpoints (POST /ai/find-products, /ai/validate-product, /ai/create-campaign, /ai/create-content, /ai/creative-ideas, /ai/video-script)
- `artifacts/api-server/src/lib/ai/` — AI module files (findProducts, validateProduct, createCampaign, createContent, creativeIdeas, videoScript, stream, logger)
- `artifacts/iattom-assist/src/hooks/useAiStream.ts` — SSE streaming hook (fetch-based, handles chunk/result/done/error events)
- `artifacts/iattom-assist/src/types/ai.ts` — shared TypeScript interfaces for all AI result shapes
- `lib/integrations-openai-ai-server/` — OpenAI client wrapper (uses AI_INTEGRATIONS_OPENAI_BASE_URL + API_KEY)

## Architecture decisions

- App is always dark mode; "dark" class applied globally to `<html>` — no theme toggle needed
- `lib/api-zod/src/index.ts` only exports from `./generated/api` (not `./generated/types`) to avoid naming conflicts from Orval split mode
- AI SSE protocol: `{type:"start"}` → `{type:"chunk",content:"..."}` → `{type:"result",data:{...}}` → `{type:"done"}` (or `{type:"error",message:"..."}`)
- AI modules use `response_format:{type:"json_object"}` with `gpt-5-mini`; JSON is accumulated from stream chunks, parsed at end, sent as "result" event
- Credits flow: CreditsGate deducts credits first (POST /api/credits/use), then onSuccess fires the AI fetch — AI routes do NOT deduct credits, only log to history
- Auth: Clerk (Replit-managed). Routes: `/sign-in/*?` and `/sign-up/*?` with `routing="path"` + full `path` props
- Dashboard routes protected with `<Show when="signed-in">` + `requireAuth` middleware on all API routes
- Admin routes protected with `AdminGuard` (frontend role check via `GET /api/auth/me`) + `requireAdmin` middleware (backend DB check)
- User sync: `SidebarLayout` calls `POST /api/auth/sync` on mount to upsert the Clerk user into the users table
- First admin setup: `AdminGuard` shows a "Claim Admin Access" button when no admins exist → calls `POST /admin/bootstrap`
- All projects and history records are scoped by `clerkUserId` — full private workspace per user
- Users table has `role` (user/admin), `plan` (free/pro/business/agency), `credits`, `stripeCustomerId`, `stripeSubscriptionId`, `stripeSubscriptionStatus`
- Stripe webhook at `POST /api/stripe/webhook` registered BEFORE `express.json()` in app.ts (needs raw Buffer)
- Webhook flow: stripe-replit-sync processes → then business logic updates users.plan + users.credits + credits_transactions
- Subscription activated → plan set from product metadata.plan, credits reset to plan limit; canceled → reverted to free
- stripe-replit-sync syncs Stripe data to `stripe.*` schema tables; plans queried from there (with fallback hardcoded amounts)
- Checkout success/cancel URLs redirect back to `/dashboard/billing?payment=success|canceled`

## Product

- Landing page with hero, features, CTA
- Clerk sign-in/sign-up pages with dark gold branded appearance
- User dashboard with sidebar (12 sections): Home, Find Products, Validate Products, Create Campaign, Create Content, Creative Generator, Video Scripts, Projects, History, Credits, Billing, Settings
- Sidebar shows Admin Panel link for users with admin role; credits widget with balance bar + low-credit indicator
- Credits system: per-user balance, automatic deduction on AI use (product_discovery=5, product_validation=5, campaign=10, content=8, creative=15, video_script=10)
- Plans: Free(50), Pro(500), Business(2000), Agency(10000) credits/month
- `CreditsGate` component wraps every AI action button — shows credit cost badge, calls POST /api/credits/use, shows upgrade modal on 402
- Credits page (`/dashboard/credits`): balance card with progress bar, feature cost table, full transaction history
- Billing page (`/dashboard/billing`): current plan status, plan grid (Free/Pro/Business/Agency), Stripe Checkout redirect, Billing Portal redirect; success/canceled URL param toasts
- Admin dashboard at `/admin/*` — Overview (stats + charts), Users (CRUD table), Analytics (Recharts area/bar/pie), Activity (platform feed)
- Admin Overview: stat cards (users, projects, AI actions, MRR), area chart (growth), bar chart (plan distribution), recent activity
- Admin Users: searchable/filterable table, inline edit dialog (role/plan/credits), separate credit adjustment dialog (amount + reason) with `useAdminAdjustCredits`; agency plan color added
- Admin Analytics: user growth area chart, feature usage bar chart, plan revenue pie chart + adoption progress bars
- Admin Activity: full platform activity feed with search, module badges, user info
- All 6 AI feature modules use real OpenAI GPT-5-mini via SSE streaming with structured JSON output, animated "generating" state, result reveal, and retry on error

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
- Generated query hooks (useGetStripePlans, etc.) require `queryKey` in their query options — use `getGet*QueryKey()` helpers
- Stripe webhook MUST be registered before `express.json()` in app.ts — `express.raw({ type: 'application/json' })` is applied only to that route
- `runMigrations` from stripe-replit-sync only accepts `{ databaseUrl, ssl?, logger? }` — no `schema` field
- `stripe-replit-sync` is excluded from `minimumReleaseAge` in pnpm-workspace.yaml
- Stripe products need `metadata: { plan: 'pro' }` etc. — run `pnpm --filter @workspace/scripts run seed-products` once after connecting Stripe

## Pointers

- See the `clerk-auth` skill for auth setup and customization details
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `react-vite` skill for frontend conventions
