import { expect, test } from "@playwright/test";
import { createSignedInUser, insertExpense, setBudget } from "./support/session";

test("a new user sets their first budget and sees it on the dashboard", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);

  await page.goto("/");

  // A zero budget auto-opens the onboarding sheet; no click needed to reach it.
  await expect(page.getByRole("heading", { name: "Set your monthly budget" })).toBeVisible();

  await page.locator("#budget-input").fill("800");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.locator("#dashboard-remaining-rm")).toHaveText("RM 800.00");
  await expect(page.getByText("Spent RM 0.00 of RM 800.00")).toBeVisible();
});

test("RM 0 is accepted as a budget", async ({ page, context, baseURL }) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);

  await page.goto("/");
  await page.locator("#budget-input").fill("0");
  await page.getByRole("button", { name: "Save" }).click();

  // Success closes the sheet; a validation error would have kept it open instead.
  await expect(page.locator("#budget-input")).not.toBeVisible();
});

test("editing the budget updates the dashboard at once and still deducts an existing expense", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);
  await insertExpense(user.supabase, user.userId, 5000); // RM 50.00, dated today
  await setBudget(user.supabase, user.userId, 80000); // RM 800.00

  await page.goto("/");
  await expect(page.locator("#dashboard-remaining-rm")).toHaveText("RM 750.00");
  await expect(page.getByText("Spent RM 50.00 of RM 800.00")).toBeVisible();

  await page.locator("#dashboard-remaining-rm").click();
  await expect(page.getByRole("heading", { name: "Edit monthly budget" })).toBeVisible();

  await page.locator("#budget-input").fill("850.50");
  await page.getByRole("button", { name: "Save" }).click();

  // 850.50 - 50.00 (the expense inserted above, untouched by the edit) = 800.50.
  await expect(page.locator("#dashboard-remaining-rm")).toHaveText("RM 800.50");
  await expect(page.getByText("Spent RM 50.00 of RM 850.50")).toBeVisible();
});

test("a negative amount is rejected with an inline error", async ({ page, context, baseURL }) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);

  await page.goto("/");
  await page.locator("#budget-input").fill("-5");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Enter a valid amount" })).toBeVisible();
  await expect(page.locator("#budget-input")).toBeVisible();
});

test("an amount with 3 decimal places is rejected with an inline error", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);

  await page.goto("/");
  await page.locator("#budget-input").fill("800.555");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Enter a valid amount" })).toBeVisible();
  await expect(page.locator("#budget-input")).toBeVisible();
});

test("reopening the sheet from the card shows the budget that was just saved", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);

  await page.goto("/");
  await page.locator("#budget-input").fill("800");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#dashboard-remaining-rm")).toHaveText("RM 800.00");

  // The layout's sheet and the card's sheet are separate instances; the card's must not
  // still hold the empty value it was mounted with.
  await page.locator("#dashboard-remaining-rm").click();
  await expect(page.locator("#budget-input")).toHaveValue("800.00");
});

test("dismissing the onboarding sheet leaves a zero-budget card that reopens it", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Set your monthly budget" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // F2-2: with no budget the card itself invites the user to set one.
  const card = page.getByText("Set your monthly budget", { exact: true });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole("heading", { name: "Set your monthly budget" })).toBeVisible();
});
