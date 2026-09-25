# PRD — SkyFin: Student Expense Tracker & AI Financial Auditor

| | |
|---|---|
| Owner | Sky |
| Status | Approved for build (all open questions resolved) |
| Last updated | 2026-09-25 |
| Related | [TECH_SPEC.md](./TECH_SPEC.md) · [TASKS.md](./TASKS.md) |

SkyFin is a personal iPhone PWA that puts cash, eWallet and card spending in one place, logs an expense from one chat line or one receipt photo, and warns before the monthly budget runs out. Everything is in RM.

---

## 1. Background & goals

**Problem.** A Malaysian student's money is split across cash, several eWallets (TNG, GrabPay, DuitNow QR) and a card. Each app shows only its own history, and cash leaves no trace. Manual trackers get abandoned because entry takes too long, so overspending is noticed at month end, when it is too late.

**Why AI.** Gemini removes the two biggest frictions: typing structured fields (a Rojak sentence becomes a transaction) and reading receipts (a photo becomes a draft). It also turns raw rows into an audit that names specific habits.

**Goals (measured over the first 2 months of use)**

| Goal | Measure | Target |
|---|---|---|
| Fast logging | Open → saved, text entry | ≤ 10 s median |
| Fast receipt logging | Photo → saved | ≤ 20 s median |
| Accurate extraction | Receipts whose total needs no edit | ≥ 18 of a fixed 20-receipt test set |
| Habit | Days per week with ≥ 1 entry | ≥ 5 |
| Early warning | First warning arrives ≥ 5 days before budget is exhausted | Every overspent month |
| Behaviour change | Wants share of spend, month 2 vs month 1 | Lower |

---

## 2. User persona

One user: Sky, a UTM undergraduate who wants to see spending clearly without spending time on bookkeeping.

| Attribute | Detail |
|---|---|
| Who | University student, Faculty of AI, UTM; also works on fintech products |
| Device | iPhone; app installed to Home Screen |
| Languages | Switches between English, Chinese, Malay and Rojak mid-sentence |
| Money in | Allowance / PTPTN, possibly scholarship or part-time pay (assumption: varies month to month) |
| Money out | Food, transport, groceries, study costs; mix of Cash, eWallet and Card |
| Budget style | One monthly figure, reset on the 1st |
| Tech comfort | High; comfortable editing AI output |

**Pain points**
- Small cash and eWallet purchases (boba, mamak, Grab) are forgotten by evening.
- No single view across eWallets, cash and card.
- Budget overruns are discovered after the fact.
- Generic budgeting advice doesn't fit student life in Malaysia.

**What success feels like:** "I log in two taps, I get nudged before it's too late, and on Sunday I learn one thing I didn't know about my spending."

---

## 3. User stories

| ID | As a student, I want to… | So that… | Feature |
|---|---|---|---|
| US-1 | sign in on my Home Screen app | only I can see my money data | F1 |
| US-2 | set one monthly budget in RM | everything is measured against it | F2 |
| US-3 | type "Makan nasi lemak RM8.50 pakai eWallet" | logging takes seconds, in my own words | F3 |
| US-4 | log several items in one message | I can catch up on a whole meal or day at once | F3 |
| US-5 | snap a receipt | I never type amounts from paper | F4 |
| US-6 | review and edit what the AI understood before saving | wrong AI guesses never pollute my data | F5 |
| US-7 | split one receipt into Needs and Wants | groceries and snacks are counted correctly | F6 |
| US-8 | add my own categories | the list fits how I actually spend | F7 |
| US-9 | browse, filter, edit and delete past entries | I can fix mistakes and find things | F8 |
| US-10 | see budget left, projected out-of-cash date and breakdowns | I know where I stand at a glance | F9 |
| US-11 | be warned the moment I start spending too fast | I can slow down while it still matters | F10, F11 |
| US-12 | get a Sunday audit naming my money leaks with 3 tips | I change one habit each week | F12 |
| US-13 | get a month-end review that sets next month's budget | next month's budget is realistic | F13 |

---

## 4. Feature list & acceptance criteria

| ID | Feature | Priority | Milestone |
|---|---|---|---|
| F1 | Sign-in & data isolation | Must | M1 |
| F2 | Monthly budget setting | Must | M1 |
| F3 | Chat text logging | Must | M3 |
| F4 | Receipt scan | Must | M4 |
| F5 | Confirmation Card | Must | M2 |
| F6 | Receipt splitting | Must | M4 |
| F7 | Preset + custom categories | Must | M2 |
| F8 | History, edit & delete | Must | M2 |
| F9 | Dashboard | Must | M5 |
| F10 | Accounting Agent, in-app warnings | Must | M5 |
| F11 | Daily cron warnings via Web Push | Should | M6 |
| F12 | Weekly audit | Should | M7 |
| F13 | Monthly audit + budget auto-apply | Should | M7 |
| F15 | iOS install & notification onboarding | Should | M6 |

Milestones are vertical slices; see [TASKS.md](./TASKS.md).

### Must

**F1 Sign-in & data isolation**
- [ ] Google sign-in completes from the Home Screen app and the session survives closing and reopening it. If the iOS spike fails, email OTP replaces it (D14).
- [ ] A request with another user's JWT returns zero rows from every table and every Storage path.
- [ ] Inserting a transaction with another user's `category_id` is rejected.
- [ ] No Google service-account key or Supabase secret key appears in the client bundle.

**F2 Monthly budget setting**
- [ ] Budget can be set and edited in RM with 2 decimals, minimum RM 0.
- [ ] With budget RM 0, Dashboard shows "Set your monthly budget" and no warnings fire.
- [ ] Editing mid-month applies to the whole current month immediately.

**F3 Chat text logging**
- [ ] "Makan nasi lemak RM8.50 pakai eWallet" → card with RM 8.50, Food & Drinks, eWallet, Needs.
- [ ] "nasi lemak 8.50, boba 12" → two drafts; boba suggested as Wants.
- [ ] "dapat elaun RM500" → income draft in Allowance / PTPTN.
- [ ] "semalam grab RM15" → date is yesterday in MYT.
- [ ] "actually RM9" in the same session updates the last draft.
- [ ] No payment method stated → Save disabled until one is tapped.
- [ ] A Chinese message gets a Chinese reply.
- [ ] A question such as "how much on food this week?" gets a one-line pointer to Dashboard/History and creates no draft.

**F4 Receipt scan**
- [ ] On the fixed 20-receipt test set, ≥ 18 totals need no edit.
- [ ] Photo → open card ≤ 8 s at the 90th percentile on campus Wi-Fi.
- [ ] A non-receipt photo gets "This doesn't look like a receipt" and its upload is deleted.
- [ ] `confidence < 0.7` highlights the amount field.

**F5 Confirmation Card**
- [ ] Nothing is written to `transactions` before Confirm & Save.
- [ ] Every field in §8.3 is editable.
- [ ] Discard deletes the uploaded image.
- [ ] Dates after today (MYT) cannot be selected.

**F6 Receipt splitting**
- [ ] RM 42.30 receipt splits into RM 30.00 Groceries (Needs) + RM 12.30 Food & Drinks (Wants), saved as 2 rows with one `receipt_group_id`.
- [ ] Save stays disabled while the remainder ≠ RM 0.00, and no phantom RM 0.01 remainder appears.
- [ ] Both rows share merchant, date, payment method and image.

**F7 Preset + custom categories**
- [ ] A new account has the 11 expense and 5 income presets.
- [ ] A custom category can be added, renamed and archived; archived ones leave the selector but keep old rows intact.
- [ ] Gemini only suggests existing category names.

**F8 History, edit & delete**
- [ ] Filters by month, category, payment method and Needs/Wants combine correctly.
- [ ] Split rows show as one expandable group.
- [ ] Editing or deleting re-runs the burn-rate check.
- [ ] The "one-off purchase" flag can be toggled from a row.

**F9 Dashboard**
- [ ] Every figure equals the matching SQL sum for the current month to the sen.
- [ ] Net cash flow shows Income − Expense and does not change Budget remaining.
- [ ] Tapping a donut slice opens History filtered to that category.
- [ ] With S = 0 the projection reads "On track".

**F10 Accounting Agent, in-app warnings**
- [ ] Budget RM 800, RM 400 spent by day 10 of a 30-day month → `critical` (pace 1.50 ≥ 1.30, D32) with out-of-cash day 20.
- [ ] A level fires at most once per day; each threshold crossing (50 / 80 / 100%) fires once per month.
- [ ] No pace warning on days 1–2 while spend < 30% of budget.
- [ ] A single expense ≥ 20% of budget fires `spike` and asks "Is this a one-off purchase?"; Yes removes it from the pace average (D16).

### Should

**F11 Daily cron warnings via Web Push**
- [ ] With the app closed, a threshold crossed during the day produces one push that evening.
- [ ] A 404/410 response removes the dead subscription.

**F12 Weekly audit**
- [ ] A week with 4 boba purchases (text-logged, no merchant) lists boba as a micro-expense with a monthly projection.
- [ ] Exactly 3 tips; every RM figure in the text matches the pre-computed stats.
- [ ] Re-running the cron on the same Sunday creates no duplicate.

**F13 Monthly audit + budget auto-apply**
- [ ] Runs on the last day of the month, including February and 31-day months.
- [ ] Includes `suggested_budget` and a month-over-month comparison.
- [ ] On the 1st the suggested budget is applied automatically, a push says so, and one tap restores the previous budget (D19).

**F15 iOS install & notification onboarding**
- [ ] In Safari (not standalone), the app shows Add-to-Home-Screen steps instead of a notification prompt.
- [ ] In standalone mode, the permission prompt appears only after a tap.

### Won't (v1)

| Feature | Why deferred |
|---|---|
| Chat Q&A over my data (F14) | Cut to keep v1 small; Dashboard and History answer the same questions (D20) |
| Recurring transactions | Needs its own scheduling and edit rules |
| CSV / PDF export | Not needed for a single user yet |
| Savings goals | Separate product loop from budgeting |
| Line-item receipt extraction | Manual split covers the need at lower risk |
| Offline entry queue | iOS background sync is limited; adds conflict handling |
| Persistent chat history | Decided against (D11) |

---

## 5. Non-goals

- **Multi-user or social:** no sharing, family accounts, leaderboards or group expense splitting.
- **Bank or eWallet sync:** no Open Banking, TNG, GrabPay or bank-feed integrations; every entry comes from the user.
- **Multi-currency:** everything is RM; foreign receipts are flagged, not converted.
- **Regulated financial advice:** no investment, loan, PTPTN-repayment or insurance recommendations; tips stay at spending-habit level.
- **Accounting-grade records:** no double-entry, tax reports or audit trail beyond row edits.
- **Android or desktop optimisation:** should work there, but only iPhone Safari is tested.

---

## 6. Decision log

| # | Topic | Decision |
|---|---|---|
| D1 | Scope | Personal tool, single user; RLS still enforced |
| D2 | Budget period | Calendar month, resets on the 1st, no rollover |
| D3 | Warning trigger | After every save AND a daily cron |
| D4 | Device | iPhone; Web Push needs iOS 16.4+ and Home Screen install; banner fallback |
| D5 | Needs vs Wants | AI suggests `is_essential`; user can flip it on the card |
| D6 | Mixed receipts | User can split one receipt into several rows |
| D7 | Language | AI replies in the input's language; UI chrome in English; scheduled reports use `preferred_language`, updated on every chat message |
| D8 | Categories | Preset list + user can add custom |
| D9 | Audit schedule | Weekly (Sunday night) + monthly (last day) |
| D10 | Income | Net cash flow only; budget is independent |
| D11 | Chat history | Not persisted; fresh chat on each open (current-session drafts kept in memory) |
| D12 | Auth | Google sign-in |
| D13 | Gemini tier | Paid Gemini API tier |
| D14 | Auth fallback | Email OTP if the iOS Google sign-in spike fails |
| D15 | Warning thresholds | Pace 1.15 (warning) / 1.30 (critical) |
| D16 | Spikes in pace | Ask the user each time a `spike` fires |
| D17 | Receipt retention | Delete images after 1 month; rows are kept |
| D18 | Hosting plan | Vercel Hobby (free); cron timing approximate |
| D19 | Suggested budget | Auto-applied on the 1st, one-tap undo |
| D20 | Chat Q&A | Cut from v1 |
| D21 | Team & worktree ownership | M1 Owner: Claude (branch `m1`), M2 Owner: Antigravity (worktree `.worktrees/m2`, branch `m2`) |
| D22 | Gemini access | Through Vertex AI with a service-account key (Vertex AI User role only), stored base64-encoded in the server-only env var `GOOGLE_SERVICE_ACCOUNT_KEY`; still a paid tier (D13) |
| D23 | Next.js version | Next.js 16: `src/proxy.ts` instead of `middleware.ts`, `eslint .` instead of the removed `next lint`, `agentRules: false` |
| D24 | Supabase keys | `sb_publishable_…` / `sb_secret_…` in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` |
| D25 | Table grants | Every migration grants table and function access explicitly; `anon` gets nothing; pgTAP asserts it (Supabase stopped granting new tables automatically) |
| D26 | Sign-up lock | Sign-ups off after Sky's first sign-in, before M3; Email provider off unless D14 |
| D27 | Test database | pgTAP and E2E run on the local Supabase stack, never the cloud project |
| D28 | Function region | Vercel functions in `sin1` (Singapore), next to Supabase |
| D30 | Fake AI in E2E | With `AI_FAKE=1` outside production, the AI parsers use canned model output (`src/lib/ai/fake.ts`) so E2E runs without Gemini; accuracy is measured by `test:ai-eval` |
| D31 | Receipt upload | Server picks `{uid}/{uuid}.jpg` and returns a signed upload URL; the browser uploads straight to Storage, with no browser Supabase client |
| D32 | Warning levels in practice | Every rule that fires is stored (each with its own dedup key); the banner and the push show the most severe (spike > critical > warning > info). F10-1's example is `critical`, since its pace is 1.50 |
| D33 | Push and cron in tests | `PUSH_FAKE=1` outside production posts pushes as plain JSON to the endpoint; the cron takes `?date=` and `?user=` only when `VERCEL_ENV` isn't `production` |
| D34 | Audit figures | The agent pre-computes saving options (with RM savings); the model picks one per tip and writes words only; any RM amount in its text must be a pre-computed figure, else the stats-only text is used |
| D35 | Cron back-fill | A missed weekly or monthly audit runs up to 2 days late; last month's suggested budget is applied by the 3rd at the latest |
| D36 | Receipt group id | Every receipt entry gets a `receipt_group_id`, split or not, so History can show "Image expired" after the sweep |
| D37 | Service worker build | `@serwist/turbopack` (Next 16 builds with Turbopack), served at `/serwist/sw.js` with scope `/`; caches static assets only, never pages or data |
| D38 | Audit tab badge | Counts unread weekly and monthly reports; budget warnings are read and dismissed in the banner |

---

## 7. Functional requirements (detail)

Every entry, text or receipt, ends in the same Confirmation Card; nothing is written without an explicit Confirm & Save.

### 7.1 Text logging (Chat/Log tab)
- FR-1: Accept free text in English, Chinese, Malay or Rojak.
- FR-2: One message may contain several entries → one draft per entry, shown as a stacked card.
- FR-3: Detect `type`: income phrases ("dapat elaun RM500", "part-time pay") → `income`.
- FR-4: Resolve relative dates ("semalam", "yesterday", "昨天") against Asia/Kuala_Lumpur; default is today; future dates are not allowed.
- FR-5: Payment method maps only to `Cash` / `eWallet` / `Card` (TNG, GrabPay, Boost, DuitNow QR → eWallet; debit/credit/Visa → Card). If not stated, leave unset and require a tap.
- FR-6: Questions or small talk get a one-line reply pointing to Dashboard or History; they never create a draft (D20).
- FR-7: Reply text uses the language of the user's message; that language is saved as `preferred_language`.
- FR-8: Corrections ("actually RM9", "tukar jadi Card") apply to drafts from the current session only.
- FR-9: Each draft carries a short normalised `item_label` (e.g. "boba", "mamak", "grab ride") used for micro-expense detection.

### 7.2 Receipt logging
- FR-10: Camera or gallery; image is resized to max 1600 px long edge and re-encoded as JPEG before upload.
- FR-11: Extraction returns `total_amount`, `merchant`, `date`, `suggested_category`, `suggested_is_essential`, `suggested_payment_method` (nullable), `item_label`, `confidence` (0–1), `is_receipt`.
- FR-12: `is_receipt = false` → "This doesn't look like a receipt"; the upload is deleted.
- FR-13: `confidence < 0.7` → amount highlighted amber with "Please double-check".
- FR-14: Non-RM receipts → number still extracted, flagged "Currency may not be RM", user must confirm.

### 7.3 Confirmation Card (bottom sheet)

| Field | Control | Source | Required |
|---|---|---|---|
| Amount (RM) | Numeric input, 2 decimals | AI | Yes |
| Merchant | Text | AI | No |
| Date | Date picker, max today | AI, default today | Yes |
| Category | Selector + "Add new" | AI suggestion | Yes |
| Needs / Wants | Toggle (expenses only) | AI suggestion | Yes (expense) |
| Payment method | 3-way segmented control | AI or unset | Yes |
| Note | Text | AI summary | No |
| Receipt | Thumbnail, tap to enlarge | Upload | No |

Actions: **Confirm & Save**, **Split**, **Discard**. Manual entry (no AI) opens the same card empty.

### 7.4 Splitting a receipt
- FR-15: **Split** adds rows; each row has its own amount, category and Needs/Wants toggle.
- FR-16: Merchant, date, payment method and image are shared by all rows.
- FR-17: The card shows "Remaining: RM x.xx"; Save is disabled until it reads RM 0.00.
- FR-18: All rows are saved in one insert with the same `receipt_group_id`.

### 7.5 Categories
- FR-19: Preset expense: Food & Drinks, Groceries, Transport, Education, Rent & Utilities, Phone & Internet, Health, Shopping, Entertainment, Subscriptions, Others.
- FR-20: Preset income: Allowance / PTPTN, Scholarship, Part-time, Family, Others.
- FR-21: Add, rename and archive custom categories; archived ones stay on old rows but leave the selector.
- FR-22: The active category list is sent with every AI request.

### 7.6 History
- FR-23: Reverse-chronological list grouped by day; filters for month, category, payment method, Needs/Wants.
- FR-24: Rows sharing a `receipt_group_id` show as one expandable group.
- FR-25: Tap a row to edit, delete, or toggle "one-off purchase"; changes re-run the burn-rate check.
- FR-26: Receipts older than 1 month show "Image expired" in place of the thumbnail (D17).

---

## 8. Agents (product behaviour)

The Accounting Agent is deterministic arithmetic, so warnings are instant and never hallucinated. Only the Audit Agent calls Gemini.

### 8.1 Accounting Agent (burn-rate monitor)

**Runs:** after every save, edit or delete (in-app banner) and in the daily evening cron (Web Push).

With d = today's day of month (MYT), D = days in month, B = budget, S = expenses so far this month, and S′ = S minus rows marked one-off:

- pace = S′ ÷ (B × d ÷ D)
- projected month spend = S′ ÷ d × D + (S − S′)
- out-of-cash day = the first day on which projected cumulative spend ≥ B

| Level | Trigger | Example message |
|---|---|---|
| `info` | S crosses 50% of B | "Half your RM800 budget is used, 17 days left." |
| `warning` | pace ≥ 1.15, or S crosses 80% of B | "You're spending 22% faster than planned. At this pace you run out on the 24th." |
| `critical` | pace ≥ 1.30, or S ≥ B | "Budget exceeded by RM45. Consider a no-spend weekend." |
| `spike` | Single expense ≥ 20% of B | "RM180 at Shopee is 23% of this month's budget. Is this a one-off purchase?" |

Rules:
- Pace warnings are suppressed while d < 3 and S < 30% of B.
- Each pace level fires at most once per day; each threshold crossing (50 / 80 / 100%) at most once per month, even if an edit drops S below it and it is crossed again.
- B = 0 → no warnings; Dashboard shows "Set your monthly budget".
- S = 0 → projection shows "On track".
- Income rows never affect any of the above.
- Messages come from templates in EN / ZH / MS chosen by `preferred_language`.

### 8.2 Audit Agent (financial advisor)

**Runs:** Sunday evening for the Mon–Sun week; last day of the month evening for the whole month. Stored, then pushed: "Your weekly audit is ready".

Content:
- One-sentence headline verdict.
- Needs vs Wants totals; top 3 categories with RM and %.
- Micro-expenses: any `coalesce(merchant, item_label)` with ≥ 3 expenses in the window, each ≤ RM 15 (larger buys under the same name aren't counted), with count, total and monthly projection = total × 30 ÷ days in the window (e.g. boba 4× = RM34, ≈ RM146/month).
- Exactly 3 tips, each with an estimated monthly saving in RM. The savings are computed before the model runs (half a micro-expense, 30% of a Wants category, 10% of a top category, a no-spend day at 5% of spend, pausing before paying at 3%); the model picks which one each tip is about (D34).
- Change vs previous period (total and Wants %).
- Monthly report only: `suggested_budget` = Needs + 90% of Wants for the month, rounded up to RM 10 and kept within 80–120% of the current budget; auto-applied on the 1st with a push "Your budget for {month} is RM X — tap to change" and a one-tap restore.

All numbers are computed before the model is called; the model writes words, not figures. **Persona:** a friendly senior who has been a broke student in Malaysia; tips are concrete and local (mamak vs café, campus bus, student data plans), never shaming; written in `preferred_language`.

---

## 9. UX

Four tabs in a bottom nav, one-thumb use on iPhone, safe-area insets respected.

| Tab | Contents |
|---|---|
| Dashboard | Warning banner, budget card, net cash flow, category donut, payment-method bar, Needs vs Wants bar |
| Chat/Log | Chat thread (session only), text input, camera and gallery buttons, "+" for manual entry |
| History | Filterable list, grouped receipts, edit/delete/one-off toggle |
| AI Audit | Latest report on top, past reports, budget and category settings |

**Dashboard, top to bottom**
1. Warning banner, dismissible, colour by level.
2. Budget card: RM remaining of RM budget, progress bar, days left, projected out-of-cash date ("On track" if after month end).
3. Net cash flow: Income − Expense this month, shown separately.
4. Expense category donut; tap a slice to filter History.
5. Payment method breakdown: Cash vs eWallet vs Card, stacked bar with RM and %.
6. Needs vs Wants bar with last month's Wants % as a marker.

**Rules:** tap targets ≥ 44 px; charts are tap-to-show, never hover; the Confirmation Card is a bottom sheet with Save pinned above the keyboard; amounts display as `RM 1,234.50`; dark mode follows the system.

**First run on iPhone:** sign in → set monthly budget → "Add to Home Screen" guide → enable notifications (only shown when launched standalone).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Google OAuth may not return to the standalone iOS app | Spike in M1; email OTP fallback (D14) |
| iOS push dropped when the app is removed or permission revoked | Badge + banner fallback; re-subscribe on open |
| Faded thermal receipts misread | Confidence flag + editable amount; user always confirms |
| Gemini model retired or superseded | Model ID in an env var |
| Cron runs late or misses a day (Hobby plan) | Jobs are date-based and idempotent; next run back-fills |
| 1-month image retention removes evidence before the monthly audit reads it | Audit uses rows, not images; accepted trade-off (D17) |

## 11. Open questions

None. All eight resolved on 2026-09-21 and recorded as D13–D20.
