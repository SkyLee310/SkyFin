import { test, expect, type Page } from "@playwright/test";
import { createSignedInUser, setBudget } from "./support/session";

// M3 demo (TASKS.md) through the D30 fake model: AI_FAKE=1 in playwright.config.ts returns canned
// Gemini output, and the real validation, mapping, cap and save paths run on it.

type User = Awaited<ReturnType<typeof createSignedInUser>>;
let user: User;

test.beforeEach(async ({ context, baseURL }) => {
  user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);
  await setBudget(user.supabase, user.userId, 80000);
});

async function say(page: Page, text: string) {
  await page.locator("#chat-input").fill(text);
  await page.locator("#btn-chat-send").click();
}

async function savedRows() {
  const { data, error } = await user.supabase
    .from("transactions")
    .select("amount, payment_method, is_essential, item_label, date, type, categories(name)")
    .order("amount");
  if (error) throw error;
  return data;
}

function yesterdayMYT() {
  const now = new Date(Date.now() + 8 * 3600_000);
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0, 10);
}

test("a Malay sentence becomes one pre-filled draft that saves", async ({ page }) => {
  await page.goto("/chat");
  await say(page, "Makan nasi lemak RM8.50 pakai eWallet");

  const row = page.getByTestId("draft-row");
  await expect(row).toHaveCount(1);
  await expect(row.getByTestId("draft-amount")).toHaveText("RM 8.50");
  await expect(row.getByText("Food & Drinks")).toBeVisible();
  await expect(row.getByText("Needs")).toBeVisible();
  await expect(row.getByRole("button", { name: "eWallet" })).toHaveAttribute("aria-pressed", "true");

  // Nothing is written before Save (F5-1).
  expect(await savedRows()).toHaveLength(0);
  await row.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Transaction recorded successfully!")).toBeVisible();
  await expect(page.getByTestId("draft-row")).toHaveCount(0);

  const rows = await savedRows();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ amount: 8.5, payment_method: "eWallet", is_essential: true, item_label: "nasi lemak" });

  const { data: profile } = await user.supabase.from("profiles").select("preferred_language").single();
  expect(profile?.preferred_language).toBe("ms");
});

test("two items stack, a correction updates boba, and Save all waits for payment", async ({ page }) => {
  await page.goto("/chat");
  await say(page, "nasi lemak 8.50, boba 12");

  const rows = page.getByTestId("draft-row");
  await expect(rows).toHaveCount(2);
  const boba = rows.filter({ hasText: "boba" });
  await expect(boba.getByText("Wants")).toBeVisible();
  await expect(boba.getByTestId("draft-amount")).toHaveText("RM 12.00");

  await say(page, "actually boba RM13");
  await expect(boba.getByTestId("draft-amount")).toHaveText("RM 13.00");
  await expect(rows).toHaveCount(2);

  const saveAll = page.locator("#btn-save-all-drafts");
  await expect(saveAll).toBeDisabled();
  await rows.nth(0).getByRole("button", { name: "Cash" }).click();
  await expect(saveAll).toBeDisabled();
  await boba.getByRole("button", { name: "Cash" }).click();
  await expect(saveAll).toBeEnabled();
  await saveAll.click();
  await expect(page.getByText("2 transactions saved!")).toBeVisible();

  const saved = await savedRows();
  expect(saved.map((r) => [r.amount, r.is_essential])).toEqual([
    [8.5, true],
    [13, false],
  ]);
});

test("'semalam' dates the draft yesterday and leaves payment for the user to tap", async ({ page }) => {
  await page.goto("/chat");
  await say(page, "semalam grab RM15");

  const row = page.getByTestId("draft-row");
  await expect(row.getByText(yesterdayMYT())).toBeVisible();
  await expect(row.getByText("Tap how you paid to save.")).toBeVisible();
  const save = row.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeDisabled();
  await row.getByRole("button", { name: "eWallet" }).click();
  await save.click();
  await expect(page.getByText("Transaction recorded successfully!")).toBeVisible();

  const [saved] = await savedRows();
  expect(saved).toMatchObject({ date: yesterdayMYT(), payment_method: "eWallet" });
});

test("a Chinese message gets a Chinese reply; income is detected", async ({ page }) => {
  await page.goto("/chat");
  await say(page, "今天午餐 RM10 现金");
  await expect(page.getByText("好的，午餐 RM10，现金。")).toBeVisible();

  await say(page, "dapat elaun RM500");
  const income = page.getByTestId("draft-row").filter({ hasText: "Allowance / PTPTN" });
  await expect(income.getByText("Income")).toBeVisible();
  await expect(income.getByTestId("draft-amount")).toHaveText("+RM 500.00");
});

test("a question gets a pointer and no draft", async ({ page }) => {
  await page.goto("/chat");
  await say(page, "how much on food this week?");
  await expect(page.getByText("Check the Dashboard or History tab for your spending.")).toBeVisible();
  await expect(page.getByTestId("draft-row")).toHaveCount(0);
});

test("the daily cap stops parsing and points to manual entry", async ({ page }) => {
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const { error } = await user.supabase.from("ai_usage").insert({ user_id: user.userId, day: today, calls: 100 });
  if (error) throw error;

  await page.goto("/chat");
  await say(page, "Makan nasi lemak RM8.50 pakai eWallet");
  await expect(page.getByText("Daily AI limit reached — use + to add manually")).toBeVisible();
  await expect(page.getByTestId("draft-row")).toHaveCount(0);
});

test("leaving the tab clears the session drafts", async ({ page }) => {
  await page.goto("/chat");
  await say(page, "nasi lemak 8.50, boba 12");
  await expect(page.getByTestId("draft-row")).toHaveCount(2);
  await page.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\/history/);
  await page.getByRole("link", { name: "Log & Chat" }).click();
  await expect(page.locator("#chat-input")).toBeVisible();
  await expect(page.getByTestId("draft-row")).toHaveCount(0);
});
