# M2 — Log an expense by hand and see it everywhere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement manual expense & income logging via the Confirmation Card bottom sheet, category management (preset + custom + archive), History browsing with day groups & filters, edit & delete flows, and Dashboard net cash flow card, all verified with integer sen precision and RLS data isolation.

**Architecture:** Next.js App Router (Server Components for data queries in `src/lib/queries/`, Server Actions for authenticated writes in `src/actions/`), Supabase Postgres with RLS and composite foreign key `(user_id, category_id)`, Zod schema validation at all boundaries, and mobile-first Tailwind/shadcn UI with iOS safe-area support.

**Tech Stack:** Next.js 14+ App Router, React, TypeScript (strict), Tailwind CSS, shadcn/ui (`Drawer`, `Button`, `Input`, `Select`, `ToggleGroup`), `@supabase/ssr`, Zod, `date-fns` + `@date-fns/tz`, Vitest, Playwright.

## Global Constraints

- Layout follows TECH_SPEC §7; file names are kebab-case (`warning-banner.tsx`).
- Reads run in Server Components through `src/lib/queries/*`. Writes are Server Actions in `src/actions/*`: authenticate with `supabase.auth.getUser()`, validate with Zod in `src/lib/validation/schemas.ts`, and return `ActionResult<T>` instead of throwing.
- Money is integer sen in TypeScript (`amountSen`) and `numeric(10,2)` in Postgres. Convert only in `src/lib/money.ts`; display with `formatRM` (`RM 1,234.50`).
- Dates: business dates are MYT `YYYY-MM-DD` strings from `src/lib/dates.ts` (`todayMYT()`, `monthRangeMYT()`). Never derive business dates from `new Date()` without MYT timezone conversion.
- Tap targets ≥ 44 px, safe-area insets respected, dark mode follows system.

---

## 1. Context & Prerequisite Status (M1 vs M2)

**Workspace Status Check:**
The current workspace repository is at commit `bc113d5` on branch `m1`, containing only `docs/`, `AGENTS.md`, `.env.example`, and `.env.local`. There is no `package.json`, no Next.js scaffolding, and no applied Supabase migrations yet.

According to `AGENTS.md` and `docs/TASKS.md`:
1. *"work resumes at the first unticked task."*
2. *"No milestone starts until the previous demo passes on a real device."*

M2 requires foundations from M1 (`0001_init.sql`, `@supabase/ssr` session client, `lib/money.ts`, `lib/dates.ts`, auth session, app bottom nav layout).
In this plan:
- We clearly enumerate the files to modify, the Supabase schema changes, and the technical risks.
- We outline the prerequisite scaffolding needed so M2 can execute cleanly.

---

## 2. Supabase Schema Changes

### Does M2 introduce new migrations?
**No new migration file is needed for M2.**
The database schema for M2 (`categories`, `transactions`, `profiles`, RLS policies, and the `handle_new_user()` preset categories trigger) was already completely designed in `docs/TECH_SPEC.md §4.2` as part of `supabase/migrations/0001_init.sql`.

### Schema Elements Utilized in M2:
1. **`public.categories`**:
   - `id uuid primary key default gen_random_uuid()`
   - `user_id uuid not null references auth.users on delete cascade`
   - `name text not null check (length(name) between 1 and 40)`
   - `kind text not null check (kind in ('expense','income'))`
   - `default_essential boolean not null default true`
   - `is_preset boolean not null default false`
   - `archived boolean not null default false`
   - `unique (user_id, kind, name)`, `unique (user_id, id)`
2. **`public.transactions`**:
   - `id uuid primary key default gen_random_uuid()`
   - `user_id uuid not null references auth.users on delete cascade`
   - `amount numeric(10,2) not null check (amount > 0)`
   - `category_id uuid not null`
   - `type text not null check (type in ('expense','income'))`
   - `payment_method text not null check (payment_method in ('Cash','eWallet','Card'))`
   - `merchant text`, `item_label text`, `receipt_url text`, `receipt_group_id uuid`, `note text`
   - `date date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date`
   - `is_essential boolean not null default true`
   - `exclude_from_pace boolean not null default false`
   - Constraints:
     - `foreign key (user_id, category_id) references public.categories (user_id, id)` (Composite FK prevents cross-user category tampering)
     - `check (date <= (now() at time zone 'Asia/Kuala_Lumpur')::date + 1)`
3. **RLS & Triggers**:
   - RLS on `categories` and `transactions` ensuring `user_id = auth.uid()`.
   - `handle_new_user()` populates the 11 expense presets and 5 income presets on user creation.

### Database Task for M2:
- `supabase/tests/rls.test.sql`: Verify composite FK: attempting to insert a transaction with User A's `user_id` and User B's `category_id` must fail.

---

## 3. Files to Create and Modify

```
src/
├── lib/
│   ├── validation/
│   │   └── schemas.ts                     # [NEW] Draft, SaveInput, Category schemas, ActionResult
│   ├── money.ts                           # [NEW] toSen, toRM, formatRM (integer sen <-> RM)
│   ├── dates.ts                           # [NEW] todayMYT, monthRangeMYT, parseMYT
│   └── queries/
│       ├── history.ts                     # [NEW] getTransactionsHistory (day groups, filters)
│       └── dashboard.ts                   # [NEW] getDashboardBudget, getNetCashFlow
├── actions/
│   ├── transactions.ts                    # [NEW] saveTransactions, updateTransaction, deleteTransaction
│   └── categories.ts                      # [NEW] listCategories, createCategory, renameCategory, archiveCategory
├── components/
│   ├── confirmation-card/
│   │   ├── confirmation-card.tsx          # [NEW] Bottom sheet drawer with form controls
│   │   ├── amount-input.tsx               # [NEW] Numeric sen-based input formatting
│   │   ├── category-selector.tsx          # [NEW] Preset/custom selector + "Add new" inline
│   │   ├── payment-toggle.tsx             # [NEW] 3-way segmented control (Cash, eWallet, Card)
│   │   └── needs-wants-toggle.tsx         # [NEW] Toggle switch (hidden for income)
│   ├── history/
│   │   ├── history-filters.tsx            # [NEW] Month picker, Category, Payment, Needs/Wants pills
│   │   ├── day-group.tsx                  # [NEW] Date header + list of transaction rows
│   │   ├── transaction-row.tsx            # [NEW] Tap to edit, action to delete
│   │   └── delete-dialog.tsx              # [NEW] Confirmation modal for deletion
│   └── dashboard/
│       └── net-flow-card.tsx              # [NEW] Income - Expense card
├── app/
│   └── (app)/
│       ├── chat/
│       │   └── page.tsx                   # [MODIFY] Add "+" button opening empty Confirmation Card
│       ├── history/
│       │   └── page.tsx                   # [MODIFY] Replace placeholder with full History UI
│       ├── audit/
│       │   └── page.tsx                   # [MODIFY] Add Category Management list & modal
│       └── page.tsx                       # [MODIFY] Dashboard: include net cash flow card
tests/
├── unit/
│   ├── schemas.test.ts                    # [NEW] Draft validation, date bounds, zero amount
│   ├── money.test.ts                      # [NEW] Sen/RM conversion rounding
│   └── dates.test.ts                      # [NEW] MYT boundaries & month ranges
├── e2e/
│   └── m2-manual-logging.spec.ts          # [NEW] Full flow: add -> edit -> delete -> totals match
└── supabase/
    └── tests/
        └── rls.test.sql                   # [NEW] Test composite FK & user isolation
```

---

## 4. Key Technical Risks & Mitigation

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| **R1** | **Missing M1 Scaffolding** | Cannot build or test M2 without base project structure, auth setup, and layout. | Fold M1 prerequisites (Next.js app setup, Supabase client setup, layout, `0001_init.sql`) into Step 0 before executing M2 code. |
| **R2** | **Floating point rounding errors in Money** | Discrepancy between UI input and DB `numeric(10,2)`; phantom 1-sen errors. | Strict integer `amountSen` in TypeScript. Conversion to/from RM string or decimal happens only in `src/lib/money.ts` (`toSen('12.50') === 1250`, `formatRM(1250) === 'RM 12.50'`). |
| **R3** | **Timezone mismatches (UTC vs MYT)** | Vercel runs on UTC (+0). Defaulting `new Date()` results in yesterday's date between 00:00 and 08:00 MYT. | All business date derivations must use `todayMYT()` and `@date-fns/tz` with `Asia/Kuala_Lumpur`. Transactions table check rejects dates beyond MYT today + 1. |
| **R4** | **Composite FK Bypass & RLS leaks** | User A could assign User B's category ID if only simple FK `category_id -> categories.id` was used. | Verified by composite FK `(user_id, category_id) references categories(user_id, id)`. In Server Actions, `user_id` is always extracted from verified JWT via `supabase.auth.getUser()`. |
| **R5** | **Archived Category Integrity** | Archiving a category could break old transaction displays if joined with `archived = false`. | Queries for active selector filter `archived = false`; history list joins all categories regardless of `archived` status. Archiving does NOT cascade or delete. |
| **R6** | **Mobile PWA Sheet & Keyboard Occlusion** | On iOS Safari, virtual keyboard covers the "Save" button in the bottom sheet. | Use shadcn/vaul `Drawer` with keyboard avoidance, sticky footer for `Save` button, tap targets ≥ 44px, and safe-area inset padding (`pb-safe`). |

---

## 5. Execution Tasks Breakdown

### Task 0: Foundation Scaffolding (Prerequisites from M1)
- Scaffold Next.js 14+ app (TypeScript strict, Tailwind CSS, shadcn/ui, Lucide).
- Set up `0001_init.sql` in `supabase/migrations/`.
- Implement `src/lib/money.ts`, `src/lib/dates.ts`, `src/lib/supabase/{server,browser,middleware}.ts`.
- Set up App Router authenticated shell `src/app/(app)/layout.tsx` with bottom navigation.

### Task 1: Validation Schemas (`src/lib/validation/schemas.ts`)
- Implement `PaymentMethod = z.enum(["Cash", "eWallet", "Card"])`.
- Implement `Draft` schema with integer sen, MYT date format regex, max today validation.
- Implement `SaveInput` schema.
- Implement `ActionResult<T>` type helper.
- Implement category schemas (`CreateCategorySchema`, `RenameCategorySchema`, `ArchiveCategorySchema`).
- Add tests in `tests/unit/schemas.test.ts`.

### Task 2: Database RLS & Composite FK Verification (`supabase/tests/rls.test.sql`)
- Add test case verifying composite FK: User A cannot insert transaction with User B's category ID.
- Verify RLS: User cannot read or modify another user's transactions or categories.

### Task 3: Category Server Actions (`src/actions/categories.ts`)
- Implement `listCategories({ kind?, includeArchived? })`.
- Implement `createCategory({ name, kind, defaultEssential })`.
- Implement `renameCategory({ id, name })`.
- Implement `archiveCategory({ id })`.

### Task 4: Transaction Server Actions (`src/actions/transactions.ts`)
- Implement `saveTransactions(input: SaveInput)` (single insert of 1..n rows).
- Implement `updateTransaction({ id, patch })`.
- Implement `deleteTransaction({ id })`.

### Task 5: Read Queries (`src/lib/queries/history.ts`, `src/lib/queries/dashboard.ts`)
- `getTransactionsHistory`: query with month, category, payment method, is_essential filters; group by day string `YYYY-MM-DD`.
- `getDashboardBudget` & `getNetCashFlow`: sum expenses and income for the current month in integer sen.

### Task 6: Confirmation Card Bottom Sheet (`src/components/confirmation-card/`)
- Create `ConfirmationCard` drawer with header, amount input, merchant input, date picker, category dropdown with "Add new", Needs/Wants switch, payment method 3-way toggle, note input, and pinned Save button.

### Task 7: Chat Tab "+" Trigger (`src/app/(app)/chat/page.tsx`)
- Render "+" button in header / main view to trigger empty Confirmation Card for manual entry.

### Task 8: History Page (`src/app/(app)/history/page.tsx`)
- Render month selector + filter pills.
- Render day groups with dates and daily sub-totals.
- Render transaction rows; tap opens Confirmation Card for editing; action opens delete confirmation.

### Task 9: Dashboard Net Cash Flow Card (`src/app/(app)/page.tsx`)
- Render Net Cash Flow card (Income − Expense for current month).

### Task 10: Category Management UI (`src/app/(app)/audit/page.tsx`)
- Add categories section to manage preset and custom categories (add, rename, archive).

### Task 11: End-to-End & Automated Verification
- Run `npm run lint` and `npm run typecheck`.
- Run `npm test` (unit tests).
- Run `npm run test:e2e` (Playwright iPhone 15 viewport flow: add RM 12.50 -> edit to RM 15.00 -> check Dashboard -> add custom category "Printing" -> archive -> delete).
