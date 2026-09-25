# SkyFin

SkyFin is a single-user iPhone PWA that lets a Malaysian student log RM spending from one chat line or one receipt photo, warns before the monthly budget runs out, and writes a weekly AI audit of spending habits.

## Before you start: read docs/

Read `docs/` before starting any task. It is the source of truth for scope, design and plan; this file holds only what every task needs.

- `docs/PRD.md` — what and why: features and acceptance criteria (§4), decision log (§6), agent rules (§8), UX (§9).
- `docs/TECH_SPEC.md` — how: schema and RLS (§4), Server Action and Gemini contracts (§5), folder layout (§7), security checklist (§8).
- `docs/TASKS.md` — milestones M1–M7 as vertical slices; work resumes at the first unticked task.

If a request conflicts with the docs, or the spec proves wrong (say, a library API has changed), raise it and ask. Once Sky decides, update the doc in the same change.

## Stack

- Next.js App Router, React, TypeScript (strict); Tailwind CSS, shadcn/ui, Lucide, Recharts
- Supabase: Postgres with RLS, Auth (Google sign-in), Storage, via `@supabase/ssr`
- Gemini through `@google/genai`, server-side only
- Zod at every boundary; `date-fns` + `@date-fns/tz` for `Asia/Kuala_Lumpur`
- PWA: `@serwist/next` service worker; `web-push` (VAPID) for iOS 16.4+ Home Screen push
- Vitest and Playwright; hosted on Vercel Hobby with one daily cron

## Commands

npm is the package manager. `package.json` is created in M1.1: define these script names there, and update this list if they change.

```bash
npm run dev             # dev server on http://localhost:3000
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit
npm test                # Vitest unit tests (tests/unit)
npm run test:e2e        # Playwright, iPhone 15 viewport (tests/e2e)
npm run build           # production build; postbuild fails it if a secret reached the client bundle
npx supabase start      # local Supabase stack (needs Docker)
npx supabase test db    # SQL tests in supabase/tests: RLS isolation, composite FK, dedup keys
npm run test:ai-eval    # paid Gemini calls: run only when changing a model or prompt, or when asked
npm run check:gemini    # one paid call: confirms GEMINI_MODEL answers on Vertex AI (reads .env.local)
```

A task is done when `lint`, `typecheck` and `npm test` pass (plus `test:e2e` when it changes a UI flow) and its box in `docs/TASKS.md` is ticked. A milestone is done only when Sky confirms its demo passed on a real iPhone; start the next milestone after that.

## Coding conventions

- **Layout** follows TECH_SPEC §7; file names are kebab-case (`warning-banner.tsx`).
- **Reads** run in Server Components through `src/lib/queries/*`. **Writes** are Server Actions in `src/actions/*`: authenticate with `supabase.auth.getUser()` (it verifies the JWT; `getSession()` does not), validate with the Zod schemas in `src/lib/validation/schemas.ts`, and return `ActionResult<T>` instead of throwing.
- **Money** is integer sen in TypeScript (`amountSen`) and `numeric(10,2)` in Postgres. Convert only in `src/lib/money.ts`; display with `formatRM` (`RM 1,234.50`).
- **Dates**: business dates are MYT `YYYY-MM-DD` strings from `src/lib/dates.ts` (`todayMYT()`, `monthRangeMYT()`). Vercel runs in UTC, so dates derived from `new Date()` are off by one between 00:00 and 08:00 MYT.
- **Gemini** is called only from Server Actions and the cron route, through `src/lib/ai/*`, with the model ID from `GEMINI_MODEL`. Call `consume_ai_call()` before every user-triggered call; handle output per TECH_SPEC §5.4.
- **Accounting Agent** (`evaluatePace`) is pure arithmetic — no I/O, no Gemini — with a table test for each rule in PRD §8.1.
- **Scheduled jobs** are date-based and idempotent: they write `audit_reports` rows with a `dedup_key`, and a unique violation means "already done".
- **Schema changes** go in the next numbered file in `supabase/migrations/`; applied migrations stay as they are. The cloud history records the same numbers (`0001`, `0002`, …), so `npx supabase db push` lines up. The Supabase MCP's `apply_migration` records a timestamp version instead: after using it, re-key that row in `supabase_migrations.schema_migrations` to the file's number.
- **Receipts** live at `{user_id}/{uuid}.jpg` in the private `receipts` bucket; delete them through the Storage API, since a SQL delete leaves the file behind.
- **UI**: chrome is English. AI replies use the language of the user's message, saved as `preferred_language` for scheduled warnings and audits; warning text comes from `src/lib/i18n/{en,zh,ms}.ts`. Tap targets ≥ 44 px, charts tap-to-show, safe-area insets respected, dark mode follows the system.
- **Commits** start with the task ID (`M2.3: add saveTransactions`).

## Never do

- **Expose a secret to the browser.** Only `NEXT_PUBLIC_*` values may reach the client; every other env var (Gemini, service role, VAPID private key, `CRON_SECRET`) is server-only, and any module reading one starts with `import "server-only"`. Commit `.env.example` with names only — never a real `.env*` file.
- **Bypass RLS.** Every table keeps RLS with `user_id = auth.uid()` policies, and user-facing code uses the session client; the service-role client belongs to `src/app/api/cron/daily/route.ts` alone.
- **Show a number the model wrote.** Compute every RM figure in SQL before calling Gemini; the model writes words only.
- **Write a transaction the user hasn't confirmed.** Text and receipt parses return drafts; rows are inserted only by Confirm & Save on the Confirmation Card.
- **Build outside v1.** PRD §4 "Won't (v1)" and §5 non-goals (e.g. chat Q&A, recurring entries, bank/eWallet sync, investment or loan advice) need Sky's go-ahead first.
- **Touch production unasked.** Get Sky's OK before pushing to `main` (Vercel deploys it to production from M1.3 on), running `supabase db push` or any SQL against the remote project, or changing Supabase, Vercel or Google Cloud settings.
