import { expect, test, type Page } from "@playwright/test";
import { evaluatePace, warningMessage } from "../../src/lib/agents/accounting";
import { monthRangeMYT, todayMYT } from "../../src/lib/dates";
import { createSignedInUser, insertRows, setBudget } from "./support/session";

// M5 demo (TASKS.md). The in-app check runs against the real date, so expectations for the
// date-dependent parts (pace, projection) come from the same pure evaluatePace the unit tests pin
// (tests/unit/accounting.test.ts); the fixed-date demo numbers run through the cron in m6/m7.

type User = Awaited<ReturnType<typeof createSignedInUser>>;
let user: User;

test.beforeEach(async ({ context, baseURL }) => {
  user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);
  await setBudget(user.supabase, user.userId, 80000);
});

const today = () => todayMYT();

/** RM 400 spread over categories, payment methods and Needs/Wants, dated today. */
async function seedFourHundred() {
  await insertRows(user, [
    { amountSen: 15000, category: "Groceries", payment: "Cash", essential: true },
    { amountSen: 12050, category: "Food & Drinks", payment: "eWallet", essential: true },
    { amountSen: 4950, category: "Food & Drinks", payment: "eWallet", essential: false, itemLabel: "boba" },
    { amountSen: 8000, category: "Transport", payment: "Card", essential: true, merchant: "Grab" },
  ]);
}

async function logExpense(page: Page, { amount, category, merchant, payment, wants, zeroBudget }: {
  amount: string; category: string; merchant: string; payment: "cash" | "ewallet" | "card"; wants?: boolean;
  zeroBudget?: boolean;
}) {
  await page.goto("/chat");
  if (zeroBudget) {
    // A zero budget opens the onboarding sheet on every page; close it to reach the card.
    await expect(page.locator("#budget-input")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#budget-input")).not.toBeVisible();
  }
  await page.locator("#btn-add-manual-plus").click();
  await page.locator("#confirmation-amount-input").fill(amount);
  await page.locator("#category-selector-dropdown").selectOption({ label: category });
  await page.locator(`#payment-method-${payment}`).click();
  if (wants) await page.locator("#toggle-wants").click();
  await page.locator("#confirmation-merchant-input").fill(merchant);
  await page.locator("#btn-confirm-save").click();
  await expect(page.getByText("New Transaction")).not.toBeVisible();
}

function projectionText(spentSen: number, excludedSen: number) {
  const r = evaluatePace({ budgetSen: 80000, spentSen, spentExcludedSen: excludedSen, today: today() });
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    Number(today().slice(5, 7)) - 1
  ];
  if (r.exceeded) return "Budget used up";
  return r.outOfCashDay === null ? "On track" : `At this pace you run out on ${r.outOfCashDay} ${month}`;
}

test("a big expense asks 'one-off?'; Yes takes it out of the pace and the projection improves", async ({ page }) => {
  await seedFourHundred();
  await page.goto("/");
  await expect(page.locator("#budget-projection")).toHaveText(projectionText(40000, 0));
  // Rows inserted straight into the table haven't run the check, so there's no banner yet.
  await expect(page.locator("#warning-banner")).toHaveCount(0);

  await logExpense(page, { amount: "180", category: "Shopping", merchant: "Shopee", payment: "card", wants: true });

  // The banner shows on the Chat tab, where the save happened (layout banner slot).
  const banner = page.locator("#warning-banner");
  await expect(banner).toHaveAttribute("data-level", "spike");
  await expect(page.locator("#warning-banner-message")).toHaveText(
    "RM 180.00 at Shopee is 23% of this month's budget. Is this a one-off purchase?",
  );

  await page.goto("/");
  await expect(page.locator("#budget-projection")).toHaveText(projectionText(58000, 0));
  await page.locator("#btn-spike-yes").click();
  await expect(banner).not.toHaveAttribute("data-level", "spike");
  await expect(page.locator("#budget-projection")).toHaveText(projectionText(58000, 18000));

  const { data: row } = await user.supabase.from("transactions").select("exclude_from_pace").eq("merchant", "Shopee").single();
  expect(row!.exclude_from_pace).toBe(true);

  // The spike was answered; what's left is the 50% threshold (plus a pace warning if today's pace
  // is high), all from the same save.
  const { data: stored } = await user.supabase.from("audit_reports").select("dedup_key, read_at").eq("type", "budget_warning");
  const month = today().slice(0, 7);
  expect(stored!.map((r) => r.dedup_key)).toEqual(expect.arrayContaining([`threshold:50:${month}`]));
  expect(stored!.find((r) => r.dedup_key.startsWith("spike:"))!.read_at).not.toBeNull();
});

test("the banner shows the most severe warning in the user's language; Dismiss clears it for good", async ({ page }) => {
  await user.supabase.from("profiles").update({ preferred_language: "zh" }).eq("id", user.userId);
  await insertRows(user, [{ amountSen: 70000, category: "Rent & Utilities" }]);
  await logExpense(page, { amount: "20", category: "Groceries", merchant: "99 Speedmart", payment: "cash" });

  // S = RM 720 of RM 800: 80% crossed (and 50%); the pace level depends on today's date.
  const input = { budgetSen: 80000, spentSen: 72000, spentExcludedSen: 0, today: today() };
  const result = evaluatePace(input);
  const top = result.warnings[0]!;
  await expect(page.locator("#warning-banner")).toHaveAttribute("data-level", top.level);
  await expect(page.locator("#warning-banner-message")).toHaveText(warningMessage(top, result, input, "zh"));

  await page.getByRole("button", { name: "Dismiss warning" }).click();
  await expect(page.locator("#warning-banner")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#warning-banner")).toHaveCount(0);

  // Crossings are once a month: another save doesn't bring the 80% warning back.
  await logExpense(page, { amount: "1", category: "Groceries", merchant: "Kedai", payment: "cash" });
  const { data: again } = await user.supabase
    .from("audit_reports")
    .select("dedup_key")
    .like("dedup_key", "threshold:80:%");
  expect(again).toHaveLength(1);
});

test("with budget RM 0 no warning fires (F2-2)", async ({ page }) => {
  await setBudget(user.supabase, user.userId, 0);
  await logExpense(page, { amount: "500", category: "Shopping", merchant: "Shopee", payment: "card", zeroBudget: true });
  await expect(page.locator("#warning-banner")).toHaveCount(0);
  const { count } = await user.supabase.from("audit_reports").select("id", { count: "exact", head: true });
  expect(count).toBe(0);
});

test("donut, payment bar and Needs vs Wants match History; tapping a slice filters History", async ({ page }) => {
  await seedFourHundred();
  await insertRows(user, [{ amountSen: 50000, category: "Allowance / PTPTN", type: "income" }]);
  await page.goto("/");

  await expect(page.locator("#donut-total")).toHaveText("RM 400.00");
  const legend = page.getByTestId("donut-legend-row");
  await expect(legend).toHaveText([
    /Food & Drinks\s*43%\s*RM 170\.00/,
    /Groceries\s*38%\s*RM 150\.00/,
    /Transport\s*20%\s*RM 80\.00/,
  ]);
  await expect(page.getByTestId("payment-row")).toHaveText([
    /Cash\s*38%\s*RM 150\.00/,
    /eWallet\s*43%\s*RM 170\.00/,
    /Card\s*20%\s*RM 80\.00/,
  ]);
  await expect(page.getByTestId("needs-wants-row")).toHaveText([/Needs\s*88%\s*RM 350\.50/, /Wants\s*12%\s*RM 49\.50/]);
  // Net cash flow is separate from the budget (F9-2).
  await expect(page.locator("#dashboard-net-cash-flow")).toHaveText("RM 100.00");
  await expect(page.locator("#dashboard-remaining-rm")).toHaveText("RM 400.00");

  // History's day total for the same rows.
  await page.goto("/history");
  await expect(page.getByText("-RM 400.00")).toBeVisible();

  // Tap the Groceries slice.
  await page.goto("/");
  // A finger lands on the ring itself; the sector's bounding-box centre can fall in the hole, so
  // the test dispatches the tap on the path.
  await page.locator(".recharts-pie-sector path").nth(1).dispatchEvent("click");
  await expect(page).toHaveURL(/\/history\?month=\d{4}-\d{2}&categoryId=/);
  await expect(page.getByTestId("history-row")).toHaveCount(1);
  await expect(page.getByTestId("history-row")).toContainText("Groceries");
});

test("History: toggle 'one-off purchase' on a row and back (F8-4)", async ({ page }) => {
  await insertRows(user, [{ amountSen: 18000, category: "Shopping", merchant: "Shopee", essential: false }]);
  await page.goto("/history");
  const toggle = page.getByRole("button", { name: "Mark as one-off purchase" });
  await toggle.click();
  await expect(page.getByTestId("one-off-badge")).toBeVisible();
  await page.getByRole("button", { name: "Count in pace again" }).click();
  await expect(page.getByTestId("one-off-badge")).toHaveCount(0);
});

test("editing an expense re-runs the check (F8-3)", async ({ page }) => {
  await insertRows(user, [{ amountSen: 1000, category: "Shopping", merchant: "Shopee" }]);
  await page.goto("/history");
  await page.getByTestId("history-row").getByText("Shopee").click();
  await page.locator("#confirmation-amount-input").fill("200");
  await page.getByRole("button", { name: "Update Transaction" }).click();
  await expect(page.locator("#warning-banner")).toHaveAttribute("data-level", "spike");
  await expect(page.locator("#warning-banner-message")).toContainText("RM 200.00 at Shopee is 25%");
  expect(monthRangeMYT(today()).daysInMonth).toBeGreaterThan(27);
});
