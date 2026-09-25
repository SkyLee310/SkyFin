# TASKS — SkyFin

| | |
|---|---|
| Last updated | 2026-09-25 |
| Related | [PRD.md](./PRD.md) · [TECH_SPEC.md](./TECH_SPEC.md) |

Seven milestones. Each one is a **vertical slice**: it touches DB → server → UI, is deployed to Vercel, and ends with a demo you can do on the iPhone. No milestone starts until the previous demo passes on a real device.

| # | Slice (demo in one line) | Features | Size | Owner |
|---|---|---|---|---|
| M1 | Install to Home Screen → sign in → set budget → see "RM 800 left" | F1, F2 | M | Claude |
| M2 | Tap "+" → fill card → save → see it in History → Dashboard number drops | F5, F7, F8 | M | Antigravity |
| M3 | Type "nasi lemak 8.50 pakai eWallet" → card pre-filled → save | F3 | M | — |
| M4 | Snap receipt → card pre-filled → split → saved with photo | F4, F6 | L | — |
| M5 | Overspend → banner appears → charts show where it went | F9, F10 | M | — |
| M6 | Close the app → evening push arrives → tap opens the warning | F11, F15 | M | — |
| M7 | Sunday push → weekly audit with boba leak + 3 tips; month end → new budget applied | F12, F13 | M | — |

Sizes: S ≈ half a day, M ≈ 1–3 days, L ≈ 3–5 days (single developer, rough).

Conventions: `[ ]` open, `[x]` done. Task IDs are `M<milestone>.<n>`. Each milestone lists **DB**, **Server**, **UI**, **Test** tasks, then **Done when**.

---

## M1 — Sign in and see my budget (Owner: Claude)

> **Status (2026-09-22):** `m1` is pushed to `main` (Sky approved) and live at `https://skyfin-ai.vercel.app`. Google OAuth is confirmed working in production, including from the iOS Home Screen icon — this fixed an initial `Unsupported provider: provider is not enabled` error, which turned out to be a real Google Cloud OAuth client never having been created (Supabase's "Client IDs" field needs the actual Google-issued client ID, not a free-text name). 3 of the 4 Phase C spike checks have passed on Sky's iPhone: initial Home Screen sign-in, force-quit/reopen persistence, and delete/re-add-icon fresh sign-in. The 4th — reopening after over an hour to confirm silent token refresh — is still pending; it needs real elapsed time so it'll be confirmed whenever Sky next opens the app after a long gap. D26 (turn off new sign-ups) is now actionable since Sky's first production sign-in has happened. M2 reached `main` first (PR #1, PR #2), so the rest of the M1 budget slice (M1.8, M1.12–M1.14, M1.17) was reconciled onto M2's Dashboard through branch `m1-budget` (2026-09-24) instead of merging `m1`. Remaining M1 work: M1.18 (bundle check), then the real-device M1 demo. **2026-09-25:** M1.18 is done, and every screen now follows the system dark mode (M1.10): the M2–M4 screens used to show near-black titles on the dark page. Only the real-device demo remains.

**Demo:** On the iPhone, open the Vercel URL in Safari → Add to Home Screen → open from the icon → Sign in with Google → set budget RM 800 → Dashboard shows "RM 800.00" with "left" beside it and "Spent RM 0.00 of RM 800.00" below. Close and reopen from the icon: still signed in.

**Spike first (day 1, time-box 4 h):** Google OAuth round-trip inside the standalone iOS app (risk R1). If the session does not come back to the Home Screen app, switch to email OTP (D14) and continue.

**Setup**
- [x] M1.1 Create Next.js app (TypeScript strict, Tailwind, ESLint), add shadcn/ui, Lucide.
- [x] M1.2 Create Supabase project; add `.env.example` and Vercel env vars. `.env.example` is done (names per D22, D24). Project created and migration 0001 pushed via the Supabase MCP (2026-09-22): ref `xhtuoanhtssydvwfkfbz`, region `ap-southeast-1`; all 6 tables have RLS on, grants match D25, and `get_advisors` reports zero security lints. `.env.local` updated with the real project URL and publishable key. Vercel env vars added by Sky during M1.3 (2026-09-22).
- [x] M1.3 Connect repo to Vercel; production deploy on push to `main`. Function region `sin1` (D28). In Supabase Auth, set the Site URL to the production URL and add `<production URL>/auth/callback` and `http://localhost:3000/auth/callback` to the redirect URLs.
  - **Progress (2026-09-22):** GitHub App access fixed by Sky; repo imports into Vercel correctly now. Sky created and deployed the project (`skyfin-ai`, team `skylee310s-projects`, production URL `https://skyfin-ai.vercel.app`) through the Vercel dashboard, since the Vercel MCP's `create_git_project` kept failing. The Vercel MCP's single-project calls (`get_project`, `update_project`, `create_project_env`) still 404 on this project even though `list_projects` sees it intermittently — looks like a bug/lag between Vercel's list and single-resource endpoints. Worked around by having Sky set Function Region (`sin1`) and the two `NEXT_PUBLIC_SUPABASE_*` env vars (Production + Preview) directly in the dashboard, and set the Supabase Auth Site URL to `https://skyfin-ai.vercel.app` with `http://localhost:3000/auth/callback` and `https://skyfin-ai.vercel.app/auth/callback` in the redirect URLs.
  - **Spike result (2026-09-22):** Sky approved the push; `main` now matches `m1`. Google sign-in confirmed working in production from both Safari and the iOS Home Screen icon, clearing the core R1 risk. 3 of the spike's 4 pass criteria are confirmed on Sky's real iPhone: (1) sign in from the Home Screen icon, land back in the app signed in; (2) force-quit and reopen, still signed in; (4) delete/re-add the Home Screen icon, fresh sign-in from a clean storage container. (3) reopening after over an hour to confirm silent token refresh is still open — it needs real elapsed time.

**DB**
- [x] M1.4 Migration `0001_init.sql` (all tables, RLS, functions, new-user trigger) — full file from TECH_SPEC §4.2.
- [x] M1.5 Enable Google provider in Supabase Auth; register OAuth client in Google Cloud (2026-09-22, done by Sky). The provider wasn't actually saved on the first pass — production returned `Unsupported provider: provider is not enabled` because no real Google Cloud OAuth client had been created yet. Fixed 2026-09-22: Sky created a Web application OAuth client in Google Cloud Console and entered its Client ID + Secret into Supabase's Google provider config. D26 (turn off new sign-ups) is now actionable — Sky's first production sign-in happened 2026-09-22.

**Server**
- [x] M1.6 `lib/supabase/{server,browser,proxy}.ts` + `src/proxy.ts` session refresh (Next 16 renamed `middleware.ts` to `proxy.ts`).
- [x] M1.7 `actions/auth.ts` `signInWithGoogle`; `app/auth/callback/route.ts`.
- [x] M1.8 `actions/profile.ts` `updateBudget` (sen in, Zod, `getUser()` check).
- [x] M1.9 `lib/money.ts` (sen ⇄ RM, `formatRM`) and `lib/dates.ts` (`todayMYT`, `monthRangeMYT`).

**UI**
- [x] M1.10 `app/manifest.ts`, icons, `apple-touch-icon`, standalone display, theme colour, safe-area CSS.
- [x] M1.11 `login/page.tsx` with Google button.
- [x] M1.12 `(app)/layout.tsx` with bottom nav (4 tabs) and the onboarding gate. The "Coming soon" placeholder pages were never merged: M2's real Chat, History and AI Audit pages fill those tabs.
- [x] M1.13 Onboarding step 1: set monthly budget (sheet shown when budget = 0).
- [x] M1.14 Dashboard budget card: remaining, budget, days left (no projection yet).

**Test**
- [x] M1.15 `supabase/tests/rls.test.sql`: second user reads zero rows from every table; exact grants asserted (D25).
- [x] M1.16 Unit tests for `money.ts` and `dates.ts` (23:59 / 00:01 MYT, month ends, February).
- [x] M1.17 E2E `tests/e2e/onboarding.spec.ts` (F2): a new user sees "Set your monthly budget" and the sheet; set RM 800 → the card shows "RM 800.00" left and "Spent RM 0.00 of RM 800.00"; with an expense dated this month, edit to RM 850.50 → the card updates at once and still deducts that expense; RM 0 is accepted; negative amounts and 3 decimals are rejected; reopening the sheet from the card shows the saved budget; dismissing the onboarding sheet leaves a zero-budget card that reopens it (F2-2). All 19 e2e tests pass locally (auth 6, m2-manual-logging 4, pwa 2, onboarding 7) against a local Supabase stack (2026-09-24).
- [x] M1.18 `scripts/check-client-bundle.mjs` as the `postbuild` script (F1 criterion 4): `npm run build` fails, locally and on Vercel, if `.next/static` contains any TECH_SPEC §8 pattern. It also fails on the values of `GOOGLE_SERVICE_ACCOUNT_KEY`, `SUPABASE_SECRET_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET` when the build has them set (as on Vercel), and prints only the variable's name. Unit tests cover the scanner; a planted `sb_secret_` string fails the build (2026-09-25).

**Done when:** demo passes on a real iPhone; F1 criteria 1, 2 (tables; Storage paths in M4.12) and 4 pass; all F2 criteria pass. F1 criterion 3 is tested in M2.1.

---

## M2 — Log an expense by hand and see it everywhere (Owner: Antigravity)

> **Status:** Implemented and verified against latest main. PR raised for review and merge.
>
> **Fixes (2026-09-25):** the Confirmation Card's amount field swallowed the second digit when typed key by key, so amounts could only be pasted; it now keeps what is typed (M2.6). All form fields are 16px so iOS Safari no longer zooms into them, and every tap target is at least 44 px (M2.6, M2.8, M2.10). E2E covers both (`m2-manual-logging.spec.ts`, `touch.spec.ts`).

**Demo:** Chat tab → "+" → Confirmation Card: RM 12.50, Food & Drinks, Wants, eWallet → Save → History shows it under today → Dashboard shows RM 787.50 left. Edit it to RM 15.00 → both update. Add a custom category "Printing" → use it → archive it → old row still shows "Printing".

**DB**
- [x] M2.1 Verify composite FK: inserting another user's `category_id` fails (add to `rls.test.sql`).

**Server**
- [x] M2.2 `lib/validation/schemas.ts`: `Draft`, `SaveInput`, `ActionResult`.
- [x] M2.3 `actions/transactions.ts`: `saveTransactions`, `updateTransaction`, `deleteTransaction` (no image handling yet).
- [x] M2.4 `actions/categories.ts`: list, create, rename, archive.
- [x] M2.5 `lib/queries/history.ts` (filters: month, category, payment method, Needs/Wants) and `lib/queries/dashboard.ts` (budget remaining, net cash flow).

**UI**
- [x] M2.6 `components/confirmation-card/` sheet: amount (sen-based input), merchant, date (max today), category selector + "Add new", Needs/Wants toggle (hidden for income), payment toggle, note; Save disabled until valid.
- [x] M2.7 Chat tab: "+" opens an empty card (chat input comes in M3).
- [x] M2.8 History page: day groups, filters, tap → edit card, delete with confirm.
- [x] M2.9 Dashboard: net cash flow card.
- [x] M2.10 Category management list in Audit tab settings.

**Test**
- [x] M2.11 E2E: add → edit → delete; totals on Dashboard match.
- [x] M2.12 Unit: `Draft` schema rejects future dates, zero amounts, missing payment method on save.

**Done when:** demo passes; F5 criteria 1, 2, 4; F7 criteria 1–2; F8 criteria 1, 3 (check re-runs in M5).

---

## M3 — Log by chatting

> **Status (2026-09-25):** Merged to `main` with M4 (PR #4), which deploys to production. Sky chose to build M3 before M4 even though the M1 device demo is still open. E2E covers the demo through the D30 fake model. Two tasks wait on a live Vertex AI call, which the build container can't make: M3.1 (`npm run check:gemini` confirms the model answers in `GOOGLE_CLOUD_LOCATION`) and M3.9 (`npm run test:ai-eval`, ≥ 27 of 30). Not yet confirmed: the Vertex AI env vars are set for Production in Vercel (the Vercel MCP still 404s on this project, see M1.3; env changes need a redeploy), and D26 sign-ups are off (the Auth setting isn't reachable from the build container). As of 2026-09-25, `auth.users` holds only Sky's Google account.

**Demo:** Chat: "Makan nasi lemak RM8.50 pakai eWallet" → card pre-filled (RM 8.50, Food & Drinks, eWallet, Needs) → Save. Then "nasi lemak 8.50, boba 12" → two stacked drafts, boba = Wants → "actually boba RM13" → draft updates → Save both. Then "semalam grab RM15" → date = yesterday, payment method unset → must tap one. Then "今天午餐 RM10 现金" → reply in Chinese.

**Server**
- [ ] M3.1 `lib/ai/client.ts` (`server-only`; Vertex AI via `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_SERVICE_ACCOUNT_KEY`; `GEMINI_MODEL`). First confirm the model ID answers in that location (D22).
  - **Progress (2026-09-24):** `src/lib/ai/client.ts` and `scripts/check-gemini.mjs` are in. Open until `npm run check:gemini` passes with the real key in `.env.local`.
- [x] M3.2 `lib/ai/prompts/parse-text.ts` + `lib/ai/parse-text.ts`: JSON schema output, category names in prompt, map unknown category → Others, amounts → sen, Zod re-validate, one retry.
- [x] M3.3 `actions/ai.ts` `parseTextEntry`: `consume_ai_call()` first; returns `{reply, language, drafts}`; writes `preferred_language`.
- [x] M3.4 Non-logging messages (questions, small talk) → one-line reply pointing to Dashboard/History, no drafts (D20).

**UI**
- [x] M3.5 `components/chat/`: message list (session state only), composer, typing indicator.
- [x] M3.6 Multiple drafts → stacked card with per-draft Save/Discard and "Save all".
- [x] M3.7 Session drafts sent with each message so corrections work; cleared on leaving the tab.
- [x] M3.8 Error states: `AI_LIMIT` ("Daily AI limit reached — use + to add manually"), `AI_FAILED` (retry button).

**Test**
- [ ] M3.9 `tests/ai-eval/chat-phrases.json`: 30 phrases in EN / ZH / MS / Rojak with expected drafts; ≥ 27 pass.
  - **Progress (2026-09-24):** phrases and runner (`tests/ai-eval/chat-phrases.test.ts`) are in; the paid run is still to do.
- [x] M3.10 Unit: `consume_ai_call` returns false on call 101. Written as pgTAP in `rls.test.sql`, since it's a database function.
- [x] M3.11 E2E `tests/e2e/m3-chat-logging.spec.ts` (D30 fake model): the demo phrases, correction, Save all gated on payment, Chinese reply, question → no draft, the daily cap, and drafts cleared on leaving the tab.

**Done when:** demo passes; all F3 criteria pass.

---

## M4 — Log by snapping a receipt

> **Status (2026-09-25):** Merged to `main` with M3 (PR #4), which deploys to production. Unit, pgTAP (`storage.test.sql`) and E2E (`m4-receipts.spec.ts`, D30 fake model with real uploads) all pass on the local stack. Migration `0002_storage.sql` was applied to the cloud project on 2026-09-25 with Sky's OK, via the Supabase MCP like 0001. The `receipts` bucket (private, JPEG, 2 MB) and its three `authenticated`-only policies were checked afterwards, and the security advisor reports nothing on Storage or RLS. Still open: M4.11 needs Sky's 20 receipt photos and Vertex AI credentials; the Vertex AI env vars and D26 are unconfirmed (see M3). D31 (receipts upload through a server-issued signed URL; no browser Supabase client) was approved 2026-09-25.
>
> **Migration history (repaired 2026-09-25):** `apply_migration` had recorded both cloud migrations under timestamps (`20260922041552`, `20260925064632`). They were re-keyed to `0001 init` and `0002 storage`, matching the repo files and the local stack, so `npx supabase db push` lines up. AGENTS.md has the rule for the next MCP-applied migration.

**Demo:** Chat → camera → photo of a 99 Speedmart receipt (RM 42.30) → card pre-filled with total, merchant, date → Split → RM 30.00 Groceries (Needs) + RM 12.30 Food & Drinks (Wants) → Save disabled until remainder = RM 0.00 → Save → History shows one expandable group with the photo. Then photo of a cat → "This doesn't look like a receipt". Then snap a receipt and Discard → object gone from Storage.

**DB**
- [x] M4.1 Migration `0002_storage.sql` (private bucket, JPEG only, 2 MB, per-user folder policies).

**Server**
- [x] M4.2 `lib/ai/prompts/parse-receipt.ts` + `lib/ai/parse-receipt.ts`: download bytes via session client, send as `inlineData`, schema output incl. `confidence`, `currency_is_rm`, `item_label`.
- [x] M4.3 `actions/ai.ts` `parseReceipt` (delete object on `NOT_RECEIPT`) and `discardReceipt`. Also `createReceiptUpload`, which returns a signed upload URL for a server-chosen path (D31).
- [x] M4.4 `saveTransactions`: set shared `receipt_url` and `receipt_group_id` for split rows.
- [x] M4.5 `deleteTransaction`: remove image via Storage API when no other row references it.

**UI**
- [x] M4.6 `lib/image.ts`: `createImageBitmap` → canvas → JPEG, max 1600 px, target < 1 MB.
- [x] M4.7 Receipt button: camera + gallery (`<input type="file" accept="image/*" capture="environment">` and a gallery variant), upload progress.
- [x] M4.8 Card: receipt thumbnail (signed URL), amber highlight when `confidence < 0.7`, "Currency may not be RM" flag. The card shows the local copy of a fresh upload, so it doesn't wait for a signed URL. A possible non-RM total needs an "I've checked the amount is in RM" tick before Save (FR-14). Discard, X and swipe-down all delete the upload (F5-3). At the AI cap, or when the read fails, the photo is kept and the card opens empty.
- [x] M4.9 `split-editor.tsx`: add/remove rows, remainder in sen, Save gated on 0.
- [x] M4.10 History: receipt groups collapsed by default; tap to expand; thumbnail.

**Test**
- [ ] M4.11 Collect 20 real receipts into `tests/ai-eval/receipts/` with expected totals; ≥ 18 exact.
  - **Progress (2026-09-24):** runner (`tests/ai-eval/receipts.test.ts`), `expected.json` and a README on adding photos are in. Waiting on Sky's 20 photos and credentials.
- [x] M4.12 E2E: split save; discard deletes object; RLS blocks reading another user's object. `tests/e2e/m4-receipts.spec.ts` also covers X-close, not-a-receipt, low confidence, non-RM, the AI cap, and History's collapsed group with its image removed when the last row is deleted; `supabase/tests/storage.test.sql` pins the bucket and its policies.

**Done when:** demo passes; all F4 and F6 criteria pass; F5 criterion 3 passes.

---

## M5 — Get warned in the app and see where money went

> **Status (2026-09-25):** Built on branch `claude/modest-cerf-r5i6uy` together with M6 and M7, at Sky's request to finish v1 in one go. Unit (`accounting`, `stats`), pgTAP (dedup key) and E2E (`m5-warnings-charts.spec.ts`) pass on the local stack. No migration was needed. The demo's "RM 400 by day 10" case gives pace 1.50, which D15 makes `critical`, not `warning`; the criterion was corrected (D32). The in-app check runs on the real date, so the E2E derives date-dependent expectations from `evaluatePace`; the fixed-date numbers are pinned in `tests/unit/accounting.test.ts`.

**Demo:** Seed test data: budget RM 800, RM 400 spent by day 10 of a 30-day month → Dashboard banner "critical" (pace 1.50 ≥ 1.30, D32), out-of-cash date = day 20. Add a RM 180 expense → `spike` banner asks "Is this a one-off purchase?" → Yes → projection improves. Donut, payment-method bar and Needs vs Wants bar all match History totals; tap the Food slice → History filtered to Food.

**Server**
- [x] M5.1 `lib/agents/accounting.ts` `evaluatePace` (pure) per PRD §8.1, including S′ for excluded rows.
- [x] M5.2 `runAccountingCheck`: insert `budget_warning` with `dedup_key` (`pace:<level>:<date>`, `threshold:<50|80|100>:<yyyy-mm>`, `spike:<txn id>`); ignore unique violations.
- [x] M5.3 Call the check from `saveTransactions`, `updateTransaction`, `deleteTransaction`, `updateBudget`, `setExcludeFromPace`; return the new warning to the client.
- [x] M5.4 `setExcludeFromPace` action.
- [x] M5.5 `lib/i18n/{en,zh,ms}.ts` warning templates.
- [x] M5.6 `lib/queries/stats.ts`: by category, by payment method, Needs vs Wants, last month's Wants %.

**UI**
- [x] M5.7 `warning-banner.tsx`: level colours, dismiss, spike Yes/No buttons.
- [x] M5.8 Budget card: projected out-of-cash date / "On track".
- [x] M5.9 `category-donut.tsx` (tap → History filter), `payment-bar.tsx`, `needs-wants-bar.tsx`.
- [x] M5.10 History row action: toggle "one-off purchase".

**Test**
- [x] M5.11 `evaluatePace` table tests: S = 0, B = 0, days 1–2 suppression, pace 1.15/1.30 boundaries, 50/80/100% crossings, spike 20%, excluded rows.
- [x] M5.12 Unit: dashboard figures equal SQL sums on a fixture month. `tests/unit/stats.test.ts` sums a hand-worked fixture month (including 0.10 + 0.20); `m5-warnings-charts.spec.ts` checks donut, payment and Needs vs Wants against History on the page.

**Done when:** demo passes; all F9 and F10 criteria pass; F8 criteria 3–4 pass.

---

## M6 — Get warned with the app closed

> **Status (2026-09-25):** Built with M5 and M7. E2E (`m6-push-cron.spec.ts`) runs the cron the way Vercel does and counts pushes on a local stand-in push service (`PUSH_FAKE`, D33); a production build registers the service worker at scope `/` and serves `/offline` when the network is gone. The service worker is built with `@serwist/turbopack`, since Next 16 builds with Turbopack and `@serwist/next` is a webpack plugin (D37). Open: M6.1 needs Sky to generate VAPID keys and add them, and `CRON_SECRET`, to Vercel; M6.14 needs the real iPhone. Before production: Sky's OK to push to `main`.

**Demo:** Fresh install from Safari shows Add-to-Home-Screen steps (no notification prompt). Open from the icon → onboarding asks to enable notifications → allow. Log expenses that cross 80% → close the app → run the cron manually (`curl` with the bearer token) → push arrives on the lock screen → tap → app opens on Dashboard with the banner.

**Server**
- [ ] M6.1 Generate VAPID keys; env vars in Vercel.
  - **Progress (2026-09-25):** code reads `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (already in `.env.example`). Sky: run `npx web-push generate-vapid-keys`, add the three (private key Sensitive) plus `CRON_SECRET` and `SUPABASE_SECRET_KEY` to Vercel Production and Preview.
- [x] M6.2 `lib/push.ts` `sendPush(userId, payload)`; delete subscriptions on 404/410.
- [x] M6.3 `api/push/subscribe/route.ts` POST/DELETE.
- [x] M6.4 `lib/supabase/admin.ts` (service role, `server-only`).
- [x] M6.5 `api/cron/daily/route.ts`: bearer check; for each profile run `runAccountingCheck` and push new warnings; call `receipts_to_purge()` and delete via Storage API; set `receipt_url = null` on rows whose image was purged.
- [x] M6.6 `vercel.json` cron `0 14 * * *`.

**UI**
- [x] M6.7 `app/sw.ts` (Serwist): precache shell, `/offline` fallback, `push` → `showNotification`, `notificationclick` → open target URL.
- [x] M6.8 Onboarding: detect standalone (`navigator.standalone` / display-mode); install guide vs notify step; permission prompt only after a tap.
- [x] M6.9 Re-subscribe on app open if permission granted but no subscription stored.
- [x] M6.10 Audit tab badge for unread `audit_reports` (weekly and monthly reports; budget warnings live in the banner, D38).
- [x] M6.11 History: "Image expired" placeholder when `receipt_url` is null on a receipt group. Every receipt entry now gets a `receipt_group_id`, split or not, so a single receipt row can show it too (D36).

**Test**
- [x] M6.12 Cron route returns 401 without the token.
- [x] M6.13 Running the cron twice in a row sends one push, not two.
- [ ] M6.14 Real iPhone: push received with the app closed.

**Done when:** demo passes; F11 and F15 criteria pass.

---

## M7 — Weekly and monthly audits

> **Status (2026-09-25):** Built with M5 and M6. Unit (`audit`, `report-view`, `schedule`) and E2E (`m7-audits.spec.ts`, D30 fake model) pass. The model no longer writes `est_monthly_saving_rm`: the agent pre-computes saving options and the model picks one per tip, and any RM amount in its words must be a pre-computed figure (D34). Open: M7.11 on the real iPhone, and a first paid run of the audit prompt once Vertex AI credentials are in (`npm run check:gemini`, M3.1).

**Demo:** Seed a week with 4 text-logged boba entries (RM 8–9.50, no merchant) → trigger the cron with a Sunday date override → push "Your weekly audit is ready" → AI Audit tab shows headline, Needs vs Wants, top 3 categories, boba as a micro-expense with monthly projection, exactly 3 tips in `preferred_language`. Run again → no duplicate. Trigger with a last-day-of-month date → monthly report with suggested budget → trigger with the 1st → budget changes, push offers undo → tap undo → previous budget restored.

**Server**
- [x] M7.1 `lib/queries/stats.ts`: period stats + `micro_expenses` query on `coalesce(merchant, item_label)`.
- [x] M7.2 `lib/ai/prompts/audit.ts` + `lib/ai/audit.ts`: persona prompt, stats + rows in, `{headline, tips[3]}` out, Zod, one retry, stats-only fallback.
- [x] M7.3 `lib/agents/audit.ts` `generateAudit`: weekly `dedup_key = weekly:<mon>`, monthly `monthly:<yyyy-mm>` with `suggested_budget_sen` and `previous_budget_sen`.
- [x] M7.4 Cron: Sunday (MYT) → weekly; tomorrow is the 1st → monthly; today is the 1st → apply last month's suggested budget + push. Add a `?date=YYYY-MM-DD` override accepted only outside production for testing. Also `?user=<uuid>` (same rule), and a 2-day back-fill window for missed runs (D35).
- [x] M7.5 `actions/audits.ts`: `markReportRead`, `restorePreviousBudget`.

**UI**
- [x] M7.6 `audit/page.tsx`: latest report on top, past reports list.
- [x] M7.7 `audit/[id]/page.tsx`: report view (headline, bars, micro-expenses, tips with RM savings).
- [x] M7.8 Budget-applied banner with one-tap undo.

**Test**
- [x] M7.9 Every RM figure in the rendered report matches the stats JSON (automated string check).
- [x] M7.10 Month-end detection for Feb (28/29), 30- and 31-day months.
- [ ] M7.11 Real iPhone: Sunday push → report opens.

**Done when:** demo passes; all F12 and F13 criteria pass. v1 complete.

---

## Backlog (not scheduled)

- Line-item receipt extraction
- Recurring transactions
- CSV export
- Chat Q&A over data (F14, cut by D20)
