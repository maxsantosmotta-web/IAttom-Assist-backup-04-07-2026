# IAttom Assist

A premium dark-themed AI business assistant SaaS platform for product discovery, validation, campaign creation, content generation, creative generation, video scripts, and marketing automation. Full Clerk authentication, private user workspaces, a full admin dashboard, private beta mode with waitlist, and feedback collection.

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

- Logo mark: `artifacts/iattom-assist/public/logo.svg` — "iA" lettermark (A with dot above), gold gradient, dark background. Same design as favicon.svg (32px version).
- React logo component: `artifacts/iattom-assist/src/components/ui/Logo.tsx` — exports `<LogoMark size>` and `<Logo size showWordmark>`. Use in all layouts instead of Sparkles icon.
- Loading screen: `artifacts/iattom-assist/src/components/LoadingScreen.tsx` — animated brand splash. Rendered via `AnimatePresence` in App.tsx, auto-dismisses after 1.6s.

## Where things live

- `artifacts/iattom-assist/src/App.tsx` — ClerkProvider, routing (lazy-loaded AI + admin pages), BetaGate wrapper, PageLoader fallback
- `artifacts/iattom-assist/src/pages/` — dashboard pages + admin pages (admin/)
- `artifacts/iattom-assist/src/components/layout/SidebarLayout.tsx` — user dashboard shell (Cmd+K palette, NotificationsPanel, Beta badge, FeedbackModal)
- `artifacts/iattom-assist/src/components/layout/AdminLayout.tsx` — admin dashboard shell (7 nav items incl. Waitlist, Feedback, Launch Checklist)
- `artifacts/iattom-assist/src/components/BetaGate.tsx` — invite-only access gate (reads betaAccess from useGetMe; bypassed for admins; activated by VITE_BETA_MODE=true)
- `artifacts/iattom-assist/src/components/CommandPalette.tsx` — global Cmd+K palette (fuzzy search, keyboard navigation, all 14 pages)
- `artifacts/iattom-assist/src/components/NotificationsPanel.tsx` — bell icon + dropdown (DB-backed, mark read/all, auto-poll 60s)
- `artifacts/iattom-assist/src/components/FeedbackModal.tsx` — floating feedback button + modal (bottom-right, all dashboard pages)
- `artifacts/iattom-assist/src/pages/dashboard/Analytics.tsx` — user usage analytics (module charts, credits over time, day picker)
- `artifacts/iattom-assist/src/pages/dashboard/SavedPrompts.tsx` — prompt library (save/copy/delete, filter by module)
- `artifacts/iattom-assist/src/pages/admin/AdminWaitlist.tsx` — waitlist management (approve/deny, grant direct access, stats)
- `artifacts/iattom-assist/src/pages/admin/AdminFeedback.tsx` — feedback management (filter by status/category, update status)
- `artifacts/iattom-assist/src/pages/admin/AdminLaunchChecklist.tsx` — 12-check system status + 8-step guided test flow
- `lib/db/src/schema/users.ts` — users table (+betaAccess boolean)
- `lib/db/src/schema/waitlist.ts` — waitlist table (email, name, message, status, adminNotes, reviewedAt)
- `lib/db/src/schema/feedback.ts` — feedback table (clerkUserId, message, category, rating, status, adminNotes)
- `artifacts/api-server/src/routes/waitlist.ts` — POST /waitlist (public), GET /waitlist/check
- `artifacts/api-server/src/routes/feedback.ts` — POST /feedback (auth), GET /feedback/mine (auth)
- `artifacts/api-server/src/routes/notifications.ts` — GET/PATCH/DELETE /notifications, POST /notifications/read-all
- `artifacts/api-server/src/routes/prompts.ts` — GET/POST/DELETE /prompts (auth, filter by module)
- `artifacts/api-server/src/routes/userAnalytics.ts` — GET /analytics/user?days=N (module usage, credits chart, project stats)
- `lib/db/src/schema/notifications.ts` — notifications table (clerkUserId, type, title, message, read, link)
- `lib/db/src/schema/savedPrompts.ts` — saved_prompts table (clerkUserId, title, prompt, module)
- `artifacts/api-server/src/routes/admin.ts` — all admin API routes (incl. waitlist + feedback CRUD + launch-status)
- `artifacts/iattom-assist/src/lib/credits.ts` — FEATURE_COSTS, PLAN_CREDITS, PLAN_PRICES
- `artifacts/iattom-assist/src/components/CreditsGate.tsx` — wraps AI action buttons; deducts credits, shows 402 upgrade modal
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth); UserProfile now includes betaAccess
- `artifacts/api-server/src/lib/stripeClient.ts` — getUncachableStripeClient(), getStripeSync() via Replit connector
- `artifacts/api-server/src/lib/stripeStorage.ts` — queries against stripe.* schema (subscriptions, products, prices)
- `artifacts/api-server/src/lib/webhookHandlers.ts` — webhook: stripe-replit-sync sync + business logic (plan+credits update)
- `artifacts/api-server/src/routes/stripe.ts` — GET /stripe/plans, GET /stripe/subscription, POST /stripe/checkout, POST /stripe/portal

## Architecture decisions

- App is always dark mode; "dark" class applied globally to `<html>` — no theme toggle needed
- `lib/api-zod/src/index.ts` only exports from `./generated/api` (not `./generated/types`) to avoid naming conflicts from Orval split mode
- AI SSE protocol: `{type:"start"}` → `{type:"chunk",content:"..."}` → `{type:"result",data:{...}}` → `{type:"done"}` (or `{type:"error",message:"..."}`)
- AI modules use `response_format:{type:"json_object"}` with `gpt-5-mini`; JSON is accumulated from stream chunks, parsed at end, sent as "result" event
- Credits flow: CreditsGate deducts credits first (POST /api/credits/use), then onSuccess fires the AI fetch — AI routes do NOT deduct credits, only log to history
- Auth: Clerk (Replit-managed). Routes: `/sign-in/*?` and `/sign-up/*?` with `routing="path"` + full `path` props
- Beta gate: `BetaGate` component wraps `SidebarLayout`; checks `me.betaAccess === true`; bypassed when `VITE_BETA_MODE !== 'true'` or user is admin; waitlist entry status is synced to user.betaAccess on approve/deny
- Admin waitlist approve also sets `users.betaAccess = true`; deny sets it to false
- Feedback/waitlist routes use direct fetch (not codegen) since they're utility endpoints not in the OpenAPI spec
- All projects and history records are scoped by `clerkUserId` — full private workspace per user
- Stripe webhook at `POST /api/stripe/webhook` registered BEFORE `express.json()` in app.ts (needs raw Buffer)

## Product

- Landing page: hero, features, pricing, FAQ, **waitlist section** (email + name + message form → POST /api/waitlist), final CTA
- Private beta mode: set `VITE_BETA_MODE=true` to gate dashboard access; signed-in users without betaAccess see a "You're on the waitlist" holding page
- User dashboard with sidebar (14 sections + **Beta badge** + **Cmd+K search bar** in sidebar header)
- **Command Palette** (Cmd+K / Ctrl+K): global fuzzy search across all 14 pages, keyboard nav (↑↓↵), instant navigation
- **Notifications center**: bell icon in topbar with unread dot badge, dropdown panel (read/dismiss/mark-all-read), DB-backed, polls every 60s
- **Analytics page** (`/dashboard/analytics`): bar chart (module usage), area chart (credits spent over time), day-range picker (7/14/30/90d)
- **Saved Prompts** (`/dashboard/prompts`): save/copy/delete prompts, filter by module, full-page library view
- **Dashboard Home** enhancements: Recently Used Tools (from history), Quick Resume (last in-progress project), Achievement badges (6 milestone badges from summary stats), footer shortcut links
- **Onboarding checklist**: shown to beta users on first login (5 steps, localStorage-persisted, dismissible)
- **Feedback button**: floating bottom-right button on all dashboard pages; modal with category selector, message textarea, star rating
- Admin dashboard at `/admin/*` — 7 nav items: Overview, Users, Analytics, Activity, **Waitlist**, **Feedback**, Launch Checklist
- **Admin Waitlist** (`/admin/waitlist`): stat cards, approve/deny buttons, "Grant Direct Access" form by email, search/filter
- **Admin Feedback** (`/admin/feedback`): filter by status + category, expand entries, update review status
- All 6 AI feature modules use real OpenAI GPT-5-mini via SSE streaming with structured JSON output
- Lazy loading: all 6 AI module pages + all 7 admin pages loaded via React.lazy + Suspense (PageLoader fallback)

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
- `stripe-replit-sync` is excluded from `minimumReleaseAge` in pnpm-workspace.yaml
- Stripe products need `metadata: { plan: 'pro' }` etc. — run seed-products once after connecting Stripe
- Waitlist/feedback admin routes use direct fetch (not generated hooks) — no codegen needed for these

## Pointers

- See the `clerk-auth` skill for auth setup and customization details
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `react-vite` skill for frontend conventions
