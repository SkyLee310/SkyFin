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

---

## Detailed Decision Records

### D21: Parallel Multi-Agent Team Execution (M1 & M2)

- **Context:** Milestone 1 (Foundation & Google Sign-in) and Milestone 2 (Manual Logging & History) need fast delivery while avoiding git workspace collisions.
- **Decision:**
  - **M1 Owner: Claude**. Operating in the main repository on branch `m1`. Owns `M1.1`–`M1.16` (Next.js app initialization, Supabase auth integration, initial budget onboarding, and M1 device demo).
  - **M2 Owner: Antigravity**. Operating in isolated Git worktree `.worktrees/m2` on branch `m2`. Owns `M2.1`–`M2.12` (Confirmation Card bottom sheet, category management, History page with day groups & filters, Dashboard Net Cash Flow card, schemas, server actions, and unit/e2e tests).
  - **Integration Strategy:** Antigravity maintains clean worktree isolation. Once Claude finishes M1 and confirms the real device demo, branch `m1` will be merged into `m2` (or vice-versa), running combined test suites (`npm test`, `npm run typecheck`, `npm run test:e2e`).
