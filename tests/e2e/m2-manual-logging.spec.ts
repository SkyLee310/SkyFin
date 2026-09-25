import { test, expect } from "@playwright/test";
import { createSignedInUser, setBudget } from "./support/session";

test.describe("M2: Manual Logging Flow (iPhone 15)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const user = await createSignedInUser(baseURL!);
    await context.addCookies(user.cookies);
    // A zero-budget user gets the onboarding sheet, which would cover the page under test.
    await setBudget(user.supabase, user.userId, 80000);
  });

  test("Confirmation Card UI elements and validation behavior", async ({ page }) => {
    // Navigate to Chat tab
    await page.goto("/chat");

    // Click "+" button to open Confirmation Card
    const plusBtn = page.locator("#btn-add-manual-plus");
    await expect(plusBtn).toBeVisible();
    await plusBtn.click();

    // Verify Drawer title and elements
    await expect(page.getByText("New Transaction")).toBeVisible();
    const saveBtn = page.locator("#btn-confirm-save");

    // Save should be disabled initially (amount is 0, payment method is null)
    await expect(saveBtn).toBeDisabled();

    // Fill in amount: 12.50
    const amountInput = page.locator("#confirmation-amount-input");
    await amountInput.fill("12.50");

    // Still disabled because payment method is not selected
    await expect(saveBtn).toBeDisabled();

    // Select payment method: eWallet
    const eWalletBtn = page.locator("#payment-method-ewallet");
    await eWalletBtn.click();

    // Select category: Food & Drinks
    const catSelect = page.locator("#category-selector-dropdown");
    if (await catSelect.isVisible()) {
      const options = await catSelect.locator("option").all();
      if (options.length > 1) {
        await catSelect.selectOption({ index: 1 });
      }
    }

    // Toggle Wants
    const wantsBtn = page.locator("#toggle-wants");
    if (await wantsBtn.isVisible()) {
      await wantsBtn.click();
    }

    // Now save button should be enabled
    await expect(saveBtn).toBeEnabled();
  });

  test("the amount can be typed one key at a time, as on a phone keyboard", async ({ page }) => {
    await page.goto("/chat");
    await page.locator("#btn-add-manual-plus").click();
    const amount = page.locator("#confirmation-amount-input");

    // fill() pastes the whole value; a phone keyboard sends one key at a time.
    await amount.pressSequentially("12.50");
    await expect(amount).toHaveValue("12.50");

    await amount.press("Backspace");
    await amount.press("Backspace");
    await amount.press("Backspace");
    await expect(amount).toHaveValue("12");
    await amount.pressSequentially(".3");
    await expect(amount).toHaveValue("12.3");

    // Anything that isn't a ringgit amount with up to 2 decimals is refused as typed.
    await amount.pressSequentially("45");
    await expect(amount).toHaveValue("12.34");

    await page.locator("#category-selector-dropdown").selectOption({ index: 1 });
    await page.locator("#payment-method-cash").click();
    await page.locator("#btn-confirm-save").click();
    await expect(page.getByText("Transaction recorded successfully!")).toBeVisible();
  });

  test("Category management in Audit settings", async ({ page }) => {
    await page.goto("/audit");

    // Open add custom category form
    const addBtn = page.locator("#btn-add-category-settings");
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Input category name
    const nameInput = page.locator("#input-category-name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Printing");

    const saveBtn = page.locator("#btn-save-category");
    await expect(saveBtn).toBeEnabled();
  });

  test("History page renders filters and day groups", async ({ page }) => {
    await page.goto("/history");

    // Check filter controls
    await expect(page.locator("#history-month-picker")).toBeVisible();
    await expect(page.locator("#filter-category-select")).toBeVisible();
    await expect(page.locator("#filter-payment-select")).toBeVisible();
    await expect(page.locator("#filter-essential-select")).toBeVisible();
  });

  test("Dashboard renders Budget Card and Net Cash Flow Card", async ({ page }) => {
    await page.goto("/");

    // Verify Dashboard sections
    await expect(page.getByText("SkyFin")).toBeVisible();
    await expect(page.getByText("Monthly Budget", { exact: true })).toBeVisible();
    await expect(page.getByText("Net Cash Flow")).toBeVisible();
  });
});
