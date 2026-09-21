# TASKS — SkyFin

| | |
|---|---|
| Last updated | 2026-09-21 |
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

**Demo:** On the iPhone, open the Vercel URL in Safari → Add to Home Screen → open from the icon → Sign in with Google → set budget RM 800 → Dashboard shows "RM 800.00 left of RM 800.00". Close and reopen from the icon: still signed in.

**Spike first (day 1, time-box 4 h):** Google OAuth round-trip inside the standalone iOS app (risk R1). If the session does not come back to the Home Screen app, switch to email OTP (D14) and continue.

**Setup**
- [x] M1.1 Create Next.js app (TypeScript strict, Tailwind, ESLint), add shadcn/ui, Lucide.
- [x] M1.2 Create Supabase project; add `.env.example` and Vercel env vars.
- [ ] M1.3 Connect repo to Vercel; production deploy on push to `main`.

**DB**
- [x] M1.4 Migration `0001_init.sql` (all tables, RLS, functions, new-user trigger) — full file from TECH_SPEC §4.2.
- [ ] M1.5 Enable Google provider in Supabase Auth; register OAuth client in Google Cloud.

**Server**
- [ ] M1.6 `lib/supabase/{server,browser,proxy}.ts` + `src/proxy.ts` session refresh (Next 16 renamed `middleware.ts` to `proxy.ts`).
- [ ] M1.7 `actions/auth.ts` `signInWithGoogle`; `app/auth/callback/route.ts`.
- [ ] M1.8 `actions/profile.ts` `updateBudget` (sen in, Zod, `getUser()` check).
- [x] M1.9 `lib/money.ts` (sen ⇄ RM, `formatRM`) and `lib/dates.ts` (`todayMYT`, `monthRangeMYT`).

**UI**
- [ ] M1.10 `app/manifest.ts`, icons, `apple-touch-icon`, standalone display, theme colour, safe-area CSS.
- [ ] M1.11 `login/page.tsx` with Google button.
- [ ] M1.12 `(app)/layout.tsx` with bottom nav (4 tabs; Chat/History/Audit show "Coming soon").
- [ ] M1.13 Onboarding step 1: set monthly budget (sheet shown when budget = 0).
- [ ] M1.14 Dashboard budget card: remaining, budget, days left (no projection yet).

**Test**
- [x] M1.15 `supabase/tests/rls.test.sql`: second user reads zero rows from `profiles`.
- [x] M1.16 Unit tests for `money.ts` and `dates.ts` (23:59 / 00:01 MYT, month ends, February).

**Done when:** demo passes on a real iPhone; F1 criteria 1–2 and F2 criteria pass.

---

## M2 — Log an expense by hand and see it everywhere (Owner: Antigravity)

> **Status:** Implemented and tested in isolated git worktree `.worktrees/m2` on branch `m2`. Awaiting M1 device demo completion before merging to integrate.

**Demo:** Chat tab → "+" → Confirmation Card: RM 12.50, Food & Drinks, Wants, eWallet → Save → History shows it under today → Dashboard shows RM 787.50 left. Edit it to RM 15.00 → both update. Add a custom category "Printing" → use it → archive it → old row still shows "Printing".

**DB**
- [ ] M2.1 Verify composite FK: inserting another user's `category_id` fails (add to `rls.test.sql`).

**Server**
- [ ] M2.2 `lib/validation/schemas.ts`: `Draft`, `SaveInput`, `ActionResult`.
- [ ] M2.3 `actions/transactions.ts`: `saveTransactions`, `updateTransaction`, `deleteTransaction` (no image handling yet).
- [ ] M2.4 `actions/categories.ts`: list, create, rename, archive.
- [ ] M2.5 `lib/queries/history.ts` (filters: month, category, payment method, Needs/Wants) and `lib/queries/dashboard.ts` (budget remaining, net cash flow).

**UI**
- [ ] M2.6 `components/confirmation-card/` sheet: amount (sen-based input), merchant, date (max today), category selector + "Add new", Needs/Wants toggle (hidden for income), payment toggle, note; Save disabled until valid.
- [ ] M2.7 Chat tab: "+" opens an empty card (chat input comes in M3).
- [ ] M2.8 History page: day groups, filters, tap → edit card, delete with confirm.
- [ ] M2.9 Dashboard: net cash flow card.
- [ ] M2.10 Category management list in Audit tab settings.

**Test**
- [ ] M2.11 E2E: add → edit → delete; totals on Dashboard match.
- [ ] M2.12 Unit: `Draft` schema rejects future dates, zero amounts, missing payment method on save.

**Done when:** demo passes; F5 criteria 1, 2, 4; F7 criteria 1–2; F8 criteria 1, 3 (check re-runs in M5).

---

## M3 — Log by chatting

**Demo:** Chat: "Makan nasi lemak RM8.50 pakai eWallet" → card pre-filled (RM 8.50, Food & Drinks, eWallet, Needs) → Save. Then "nasi lemak 8.50, boba 12" → two stacked drafts, boba = Wants → "actually boba RM13" → draft updates → Save both. Then "semalam grab RM15" → date = yesterday, payment method unset → must tap one. Then "今天午餐 RM10 现金" → reply in Chinese.

**Server**
- [ ] M3.1 `lib/ai/client.ts` (`server-only`; Vertex AI via `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_SERVICE_ACCOUNT_KEY`; `GEMINI_MODEL`). First confirm the model ID answers in that location (D22).
- [ ] M3.2 `lib/ai/prompts/parse-text.ts` + `lib/ai/parse-text.ts`: JSON schema output, category names in prompt, map unknown category → Others, amounts → sen, Zod re-validate, one retry.
- [ ] M3.3 `actions/ai.ts` `parseTextEntry`: `consume_ai_call()` first; returns `{reply, language, drafts}`; writes `preferred_language`.
- [ ] M3.4 Non-logging messages (questions, small talk) → one-line reply pointing to Dashboard/History, no drafts (D20).

**UI**
- [ ] M3.5 `components/chat/`: message list (session state only), composer, typing indicator.
- [ ] M3.6 Multiple drafts → stacked card with per-draft Save/Discard and "Save all".
- [ ] M3.7 Session drafts sent with each message so corrections work; cleared on leaving the tab.
- [ ] M3.8 Error states: `AI_LIMIT` ("Daily AI limit reached — use + to add manually"), `AI_FAILED` (retry button).

**Test**
- [ ] M3.9 `tests/ai-eval/chat-phrases.json`: 30 phrases in EN / ZH / MS / Rojak with expected drafts; ≥ 27 pass.
- [ ] M3.10 Unit: `consume_ai_call` returns false on call 101.

**Done when:** demo passes; all F3 criteria pass.

---

## M4 — Log by snapping a receipt

**Demo:** Chat → camera → photo of a 99 Speedmart receipt (RM 42.30) → card pre-filled with total, merchant, date → Split → RM 30.00 Groceries (Needs) + RM 12.30 Food & Drinks (Wants) → Save disabled until remainder = RM 0.00 → Save → History shows one expandable group with the photo. Then photo of a cat → "This doesn't look like a receipt". Then snap a receipt and Discard → object gone from Storage.

**DB**
- [ ] M4.1 Migration `0002_storage.sql` (private bucket, JPEG only, 2 MB, per-user folder policies).

**Server**
- [ ] M4.2 `lib/ai/prompts/parse-receipt.ts` + `lib/ai/parse-receipt.ts`: download bytes via session client, send as `inlineData`, schema output incl. `confidence`, `currency_is_rm`, `item_label`.
- [ ] M4.3 `actions/ai.ts` `parseReceipt` (delete object on `NOT_RECEIPT`) and `discardReceipt`.
- [ ] M4.4 `saveTransactions`: set shared `receipt_url` and `receipt_group_id` for split rows.
- [ ] M4.5 `deleteTransaction`: remove image via Storage API when no other row references it.

**UI**
- [ ] M4.6 `lib/image.ts`: `createImageBitmap` → canvas → JPEG, max 1600 px, target < 1 MB.
- [ ] M4.7 Receipt button: camera + gallery (`<input type="file" accept="image/*" capture="environment">` and a gallery variant), upload progress.
- [ ] M4.8 Card: receipt thumbnail (signed URL), amber highlight when `confidence < 0.7`, "Currency may not be RM" flag.
- [ ] M4.9 `split-editor.tsx`: add/remove rows, remainder in sen, Save gated on 0.
- [ ] M4.10 History: receipt groups collapsed by default; tap to expand; thumbnail.

**Test**
- [ ] M4.11 Collect 20 real receipts into `tests/ai-eval/receipts/` with expected totals; ≥ 18 exact.
- [ ] M4.12 E2E: split save; discard deletes object; RLS blocks reading another user's object.

**Done when:** demo passes; all F4 and F6 criteria pass; F5 criterion 3 passes.

---

## M5 — Get warned in the app and see where money went

**Demo:** Seed test data: budget RM 800, RM 400 spent by day 10 of a 30-day month → Dashboard banner "warning", out-of-cash date = day 20. Add a RM 180 expense → `spike` banner asks "Is this a one-off purchase?" → Yes → projection improves. Donut, payment-method bar and Needs vs Wants bar all match History totals; tap the Food slice → History filtered to Food.

**Server**
- [ ] M5.1 `lib/agents/accounting.ts` `evaluatePace` (pure) per PRD §8.1, including S′ for excluded rows.
- [ ] M5.2 `runAccountingCheck`: insert `budget_warning` with `dedup_key` (`pace:<level>:<date>`, `threshold:<50|80|100>:<yyyy-mm>`, `spike:<txn id>`); ignore unique violations.
- [ ] M5.3 Call the check from `saveTransactions`, `updateTransaction`, `deleteTransaction`, `updateBudget`, `setExcludeFromPace`; return the new warning to the client.
- [ ] M5.4 `setExcludeFromPace` action.
- [ ] M5.5 `lib/i18n/{en,zh,ms}.ts` warning templates.
- [ ] M5.6 `lib/queries/stats.ts`: by category, by payment method, Needs vs Wants, last month's Wants %.

**UI**
- [ ] M5.7 `warning-banner.tsx`: level colours, dismiss, spike Yes/No buttons.
- [ ] M5.8 Budget card: projected out-of-cash date / "On track".
- [ ] M5.9 `category-donut.tsx` (tap → History filter), `payment-bar.tsx`, `needs-wants-bar.tsx`.
- [ ] M5.10 History row action: toggle "one-off purchase".

**Test**
- [ ] M5.11 `evaluatePace` table tests: S = 0, B = 0, days 1–2 suppression, pace 1.15/1.30 boundaries, 50/80/100% crossings, spike 20%, excluded rows.
- [ ] M5.12 Unit: dashboard figures equal SQL sums on a fixture month.

**Done when:** demo passes; all F9 and F10 criteria pass; F8 criteria 3–4 pass.

---

## M6 — Get warned with the app closed

**Demo:** Fresh install from Safari shows Add-to-Home-Screen steps (no notification prompt). Open from the icon → onboarding asks to enable notifications → allow. Log expenses that cross 80% → close the app → run the cron manually (`curl` with the bearer token) → push arrives on the lock screen → tap → app opens on Dashboard with the banner.

**Server**
- [ ] M6.1 Generate VAPID keys; env vars in Vercel.
- [ ] M6.2 `lib/push.ts` `sendPush(userId, payload)`; delete subscriptions on 404/410.
- [ ] M6.3 `api/push/subscribe/route.ts` POST/DELETE.
- [ ] M6.4 `lib/supabase/admin.ts` (service role, `server-only`).
- [ ] M6.5 `api/cron/daily/route.ts`: bearer check; for each profile run `runAccountingCheck` and push new warnings; call `receipts_to_purge()` and delete via Storage API; set `receipt_url = null` on rows whose image was purged.
- [ ] M6.6 `vercel.json` cron `0 14 * * *`.

**UI**
- [ ] M6.7 `app/sw.ts` (Serwist): precache shell, `/offline` fallback, `push` → `showNotification`, `notificationclick` → open target URL.
- [ ] M6.8 Onboarding: detect standalone (`navigator.standalone` / display-mode); install guide vs notify step; permission prompt only after a tap.
- [ ] M6.9 Re-subscribe on app open if permission granted but no subscription stored.
- [ ] M6.10 Audit tab badge for unread `audit_reports`.
- [ ] M6.11 History: "Image expired" placeholder when `receipt_url` is null on a receipt group.

**Test**
- [ ] M6.12 Cron route returns 401 without the token.
- [ ] M6.13 Running the cron twice in a row sends one push, not two.
- [ ] M6.14 Real iPhone: push received with the app closed.

**Done when:** demo passes; F11 and F15 criteria pass.

---

## M7 — Weekly and monthly audits

**Demo:** Seed a week with 4 text-logged boba entries (RM 8–9.50, no merchant) → trigger the cron with a Sunday date override → push "Your weekly audit is ready" → AI Audit tab shows headline, Needs vs Wants, top 3 categories, boba as a micro-expense with monthly projection, exactly 3 tips in `preferred_language`. Run again → no duplicate. Trigger with a last-day-of-month date → monthly report with suggested budget → trigger with the 1st → budget changes, push offers undo → tap undo → previous budget restored.

**Server**
- [ ] M7.1 `lib/queries/stats.ts`: period stats + `micro_expenses` query on `coalesce(merchant, item_label)`.
- [ ] M7.2 `lib/ai/prompts/audit.ts` + `lib/ai/audit.ts`: persona prompt, stats + rows in, `{headline, tips[3]}` out, Zod, one retry, stats-only fallback.
- [ ] M7.3 `lib/agents/audit.ts` `generateAudit`: weekly `dedup_key = weekly:<mon>`, monthly `monthly:<yyyy-mm>` with `suggested_budget_sen` and `previous_budget_sen`.
- [ ] M7.4 Cron: Sunday (MYT) → weekly; tomorrow is the 1st → monthly; today is the 1st → apply last month's suggested budget + push. Add a `?date=YYYY-MM-DD` override accepted only outside production for testing.
- [ ] M7.5 `actions/audits.ts`: `markReportRead`, `restorePreviousBudget`.

**UI**
- [ ] M7.6 `audit/page.tsx`: latest report on top, past reports list.
- [ ] M7.7 `audit/[id]/page.tsx`: report view (headline, bars, micro-expenses, tips with RM savings).
- [ ] M7.8 Budget-applied banner with one-tap undo.

**Test**
- [ ] M7.9 Every RM figure in the rendered report matches the stats JSON (automated string check).
- [ ] M7.10 Month-end detection for Feb (28/29), 30- and 31-day months.
- [ ] M7.11 Real iPhone: Sunday push → report opens.

**Done when:** demo passes; all F12 and F13 criteria pass. v1 complete.

---

## Backlog (not scheduled)

- Line-item receipt extraction
- Recurring transactions
- CSV export
- Chat Q&A over data (F14, cut by D20)
