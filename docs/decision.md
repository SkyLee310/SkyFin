# Decisions Log — SkyFin

This document records architectural, operational, and organizational decisions for SkyFin.

| # | Topic | Decision | Date | Status |
|---|---|---|---|---|
| D1 | Scope | Personal tool, single user; RLS still enforced | 2026-09-21 | Approved |
| D2 | Budget period | Calendar month, resets on the 1st, no rollover | 2026-09-21 | Approved |
| D3 | Warning trigger | After every save AND a daily cron | 2026-09-21 | Approved |
| D4 | Device | iPhone; Web Push needs iOS 16.4+ and Home Screen install; banner fallback | 2026-09-21 | Approved |
| D5 | Needs vs Wants | AI suggests `is_essential`; user can flip it on the card | 2026-09-21 | Approved |
| D6 | Mixed receipts | User can split one receipt into several rows | 2026-09-21 | Approved |
| D7 | Language | AI replies in the input's language; UI chrome in English; scheduled reports use `preferred_language` | 2026-09-21 | Approved |
| D8 | Categories | Preset list + user can add custom | 2026-09-21 | Approved |
| D9 | Audit schedule | Weekly (Sunday night) + monthly (last day) | 2026-09-21 | Approved |
| D10 | Income | Net cash flow only; budget is independent | 2026-09-21 | Approved |
| D11 | Chat history | Not persisted; fresh chat on each open (current-session drafts kept in memory) | 2026-09-21 | Approved |
| D12 | Auth | Google sign-in | 2026-09-21 | Approved |
| D13 | Gemini tier | Paid Gemini API tier | 2026-09-21 | Approved |
| D14 | Auth fallback | Email OTP if the iOS Google sign-in spike fails | 2026-09-21 | Approved |
| D15 | Warning thresholds | Pace 1.15 (warning) / 1.30 (critical) | 2026-09-21 | Approved |
| D16 | Spikes in pace | Ask the user each time a `spike` fires | 2026-09-21 | Approved |
| D17 | Receipt retention | Delete images after 1 month; rows are kept | 2026-09-21 | Approved |
| D18 | Hosting plan | Vercel Hobby (free); cron timing approximate | 2026-09-21 | Approved |
| D19 | Suggested budget | Auto-applied on the 1st, one-tap undo | 2026-09-21 | Approved |
| D20 | Chat Q&A | Cut from v1 | 2026-09-21 | Approved |
| **D21** | **Milestone Ownership & Git Worktree Isolation** | **M1 Owner: Claude** (branch `m1`, root repo: auth, Next.js foundation, budget onboarding).<br/>**M2 Owner: Antigravity** (branch `m2`, worktree `.worktrees/m2`: Confirmation Card, manual logging, categories, history, net cash flow).<br/>Integration via git merge once M1 passes real device demo. | 2026-09-21 | Approved |
| D22 | Gemini access | Through Vertex AI with a service-account key that has only the Vertex AI User role. The key JSON is stored base64-encoded in the server-only env var `GOOGLE_SERVICE_ACCOUNT_KEY` (Sensitive in Vercel), replacing the AI Studio `GEMINI_API_KEY`. Still a paid tier, so D13 holds. | 2026-09-21 | Approved |
| D23 | Next.js version | Next.js 16: `src/proxy.ts` replaces `middleware.ts`; `npm run lint` runs `eslint .` because `next lint` was removed; `agentRules: false` in `next.config.ts` stops `next dev` from rewriting CLAUDE.md and AGENTS.md. Not taken: pinning Next 15 to keep `middleware.ts`. | 2026-09-21 | Approved |
| D24 | Supabase API keys | The new `sb_publishable_…` / `sb_secret_…` keys, in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`, replacing `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. The app needs only the URL and the publishable key; the secret key is for the cron route alone. | 2026-09-21 | Approved |
| D25 | Table and function grants | `0001_init.sql` ends with an explicit GRANTS block, and every later migration grants explicitly; `anon` gets nothing; pgTAP asserts the exact privileges. Supabase stopped granting new tables to the Data API roles. See the record below. | 2026-09-21 | Approved |
| D26 | Sign-up lock | After Sky's first production sign-in, turn off new sign-ups in Supabase Auth; the Email provider stays off unless D14 is used. Must be done before M3. See the record below. | 2026-09-21 | Approved |
| D27 | Test database | pgTAP and E2E run on the local Supabase Docker stack, never the cloud project (Branching needs a paid plan). E2E signs up fresh email/password users, and runs a PKCE email-link sign-in through Mailpit to exercise `/auth/callback`, since Google sign-in can't run in a test. | 2026-09-21 | Approved |
| D28 | Function region | Vercel functions run in `sin1` (Singapore), next to the Supabase project; the Hobby default `iad1` would add a US–Singapore round trip to every query. | 2026-09-21 | Approved |
| D30 | Fake AI in E2E | `AI_FAKE=1` (set only by Playwright's web server) makes the parsers use canned model output instead of Gemini; `NODE_ENV=production` always turns it off. See the record below. | 2026-09-24 | Approved |

---

## Detailed Decision Records

### D21: Parallel Multi-Agent Team Execution (M1 & M2)

- **Context:** Milestone 1 (Foundation & Google Sign-in) and Milestone 2 (Manual Logging & History) need fast delivery while avoiding git workspace collisions.
- **Decision:**
  - **M1 Owner: Claude**. Operating in the main repository on branch `m1`. Owns `M1.1`–`M1.18` (Next.js app initialization, Supabase auth integration, initial budget onboarding, and M1 device demo).
  - **M2 Owner: Antigravity**. Operating in isolated Git worktree `.worktrees/m2` on branch `m2`. Owns `M2.1`–`M2.12` (Confirmation Card bottom sheet, category management, History page with day groups & filters, Dashboard Net Cash Flow card, schemas, server actions, and unit/e2e tests).
  - **Integration Strategy:** Antigravity maintains clean worktree isolation. Once Claude finishes M1 and confirms the real device demo, branch `m1` will be merged into `m2` (or vice-versa), running combined test suites (`npm test`, `npm run typecheck`, `npm run test:e2e`).
  - **Outcome (2026-09-24):** Sky merged `m2` into `main` first (PR #1, PR #2), so the M1 budget slice (`M1.8`, `M1.12`–`M1.14`, `M1.17`) was reconciled onto `main` file by file via branch `m1-budget` instead of a branch merge; `m1` is retired.

### D22: Gemini through Vertex AI

- **Context:** The docs assumed an AI Studio API key (`GEMINI_API_KEY`). Sky created a Vertex AI service-account key instead.
- **Decision:**
  - Gemini is called through Vertex AI: `new GoogleGenAI({ vertexai: true, project, location, googleAuthOptions: { credentials } })`. The SDK stays `@google/genai`; only the client setup changes.
  - The service account has only the Vertex AI User role (`roles/aiplatform.user`).
  - The key JSON is stored as one base64 line in `GOOGLE_SERVICE_ACCOUNT_KEY`: in `.env.local` locally, and as a Sensitive env var in Vercel. Only `src/lib/ai/client.ts` (`import "server-only"`) decodes it, so local and production share one code path.
  - `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` (default `global`) sit alongside it; `GEMINI_MODEL` is unchanged. M3.1 first confirms that the model ID answers in that location.
- **Alternative not taken:** Vercel OIDC with GCP Workload Identity Federation keeps no long-lived key in production, but needs extra GCP setup and a different local code path.
- **Risk:** the key is long-lived. Mitigations: the least-privilege role above, a GCP budget alert, `skyfin-*.json` gitignored and the key file kept outside the project, and delete-and-replace in GCP if it ever leaks.
- **D13 holds:** Vertex AI is still a paid tier.

### D25: Explicit grants on every table and function

- **Context:** Supabase no longer grants the Data API roles (`anon`, `authenticated`, `service_role`) access to new tables: from 2026-05-30 for new projects, and from 2026-10-30 for existing ones. TECH_SPEC §4.2 as first written had no GRANT statements, so every query on a new project would fail with `42501 permission denied`.
- **Decision:**
  - `0001_init.sql` ends with a GRANTS block. It revokes everything, then grants `select, insert, update, delete` on the six tables to `authenticated` and `service_role`, and nothing to `anon`.
  - Functions: `consume_ai_call` is executable by `authenticated` only, `receipts_to_purge` by `service_role` only, and `handle_new_user` by nobody (it runs as a trigger).
  - Every later migration that creates a table or function grants explicitly, and `supabase/tests/rls.test.sql` asserts the exact privilege set with `table_privs_are` and `function_privs_are`.
  - The local `supabase/config.toml` sets `auto_expose_new_tables = false`, so the local stack starts from the same default as the cloud project.
- **Why revoke first:** tables created under the old default get every privilege; under the new default they still keep `truncate`, `references` and `trigger`; and Postgres grants `execute` on new functions to `public`. Revoking first leaves the same set under both defaults.
- **RLS is unchanged:** grants decide whether a role may touch a table at all; RLS still decides which rows it sees.

### D26: Lock sign-ups after Sky's first sign-in

- **Context:** While sign-ups are open, anyone with the public publishable key can create an account. From M3 on, each account can spend up to 100 Gemini calls a day on Sky's bill.
- **Decision:** after Sky's first production Google sign-in (M1.5), turn off "Allow new users to sign up" in Supabase Auth. The Email provider stays off unless the D14 OTP fallback is used; then Email stays on, with sign-ups still off. This must be done before M3.
- **Alternative not taken:** a before-user-created Auth hook that admits only Sky's Gmail. It needs code and a migration; the dashboard switch gets the same result with neither.
- **Risk:** if Sky's auth user is ever deleted, sign-ups must be turned on briefly to sign in again. `db push` must come before the first sign-in, because the new-user trigger creates the profile and preset categories only when the auth user is inserted.

### D29: Server Component / Client Component split for History page and server queries

- **Context:** `src/lib/queries/history.ts` and `src/lib/queries/dashboard.ts` use `@/lib/supabase/server` which imports `cookies` from `next/headers`. Importing server queries directly inside a Client Component (`"use client"`) triggers Next.js Turbopack build failure: `"You're importing a module that depends on 'next/headers'. This API is only available in Server Components in the App Router"`.
- **Decision:**
  - Adhere strictly to the AGENTS.md rule: "Reads run in Server Components through `src/lib/queries/*`".
  - `src/app/(app)/history/page.tsx` is an async Server Component that reads URL `searchParams` and runs `getTransactionsHistory()` and `listCategories()`.
  - Client interactivity (filter dropdowns, bottom sheet drawer, delete confirmation dialog) is encapsulated in `src/app/(app)/history/history-view.tsx` (`"use client"`), which only imports types from queries and executes mutations via Server Actions (`deleteTransaction`, `revalidatePath`).
  - Add `import "server-only"` to `src/lib/queries/history.ts` and `src/lib/queries/dashboard.ts` to prevent accidental bundling into client bundles at build time.

### D30: Fake AI output in E2E tests

- **Context:** The M3 and M4 demos are AI flows, but E2E runs on the local stack with no Vertex AI credentials, and real calls would cost money and vary run to run.
- **Decision:**
  - `isFakeAiEnabled()` in `src/lib/ai/generate.ts` is true only when `AI_FAKE=1` and `NODE_ENV !== "production"`. Only the Playwright web server sets `AI_FAKE`; Vercel builds always run with `NODE_ENV=production`.
  - When on, `parseText` (and, from M4, `parseReceipt`) take the model's JSON from `src/lib/ai/fake.ts` instead of Gemini. The fake returns what Gemini would, so the Zod checks, category mapping, sen conversion, `consume_ai_call` cap and save paths all run for real.
  - Model accuracy is measured separately by the paid `npm run test:ai-eval` suites (M3.9, M4.11).
- **Alternative not taken:** intercepting Server Action requests in Playwright. The RSC wire format is internal to Next.js and would break on upgrades.
- **Risk:** the fake drifts from the real model's output shape. Mitigation: the fake goes through the same `ModelTextOutput` schema, so a shape change fails E2E.

