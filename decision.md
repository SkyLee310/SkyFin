# Decisions — SkyFin

See full decision details in [docs/decision.md](./docs/decision.md) and [docs/PRD.md §6](./docs/PRD.md).

### Summary of Latest Decisions
- **D21 (2026-09-21): Milestone Ownership & Parallel Agent Worktrees**
  - **M1 Owner:** Claude (working in root repository on branch `m1`).
  - **M2 Owner:** Antigravity (working in isolated worktree `.worktrees/m2` on branch `m2`).
  - Integration will be performed by merging `m1` into `m2` once M1 passes the real iPhone demo.
- **D22 (2026-09-21): Gemini through Vertex AI**
  - Service-account key (Vertex AI User role only), stored base64-encoded in the server-only env var `GOOGLE_SERVICE_ACCOUNT_KEY`; replaces the AI Studio `GEMINI_API_KEY`.
- **D23 (2026-09-21): Next.js 16**
  - `src/proxy.ts` instead of `middleware.ts`; `eslint .` instead of the removed `next lint`; `agentRules: false`, so `next dev` leaves CLAUDE.md and AGENTS.md alone.
- **D24 (2026-09-21): New Supabase API keys**
  - `sb_publishable_…` / `sb_secret_…` in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`.
- **D25 (2026-09-21): Explicit grants**
  - Every migration grants table and function access explicitly; `anon` gets nothing; pgTAP asserts the exact privileges.
- **D26 (2026-09-21): Sign-up lock**
  - Sign-ups off after Sky's first production sign-in, before M3.
- **D27 (2026-09-21): Local test database**
  - pgTAP and E2E run on the local Supabase stack, never the cloud project.
- **D28 (2026-09-21): Function region**
  - Vercel functions in `sin1` (Singapore), next to Supabase.
