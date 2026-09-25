import { test, expect, type Page } from "@playwright/test";
import { createSignedInUser, setBudget } from "./support/session";

// M4 demo (TASKS.md) through the D30 fake model, which reads the photo's shape: portrait is a
// 99 Speedmart receipt for RM 42.30, square a faded non-RM receipt, landscape "a cat".
// Upload, Storage RLS, deletes and saving are all real, on the local stack.

type User = Awaited<ReturnType<typeof createSignedInUser>>;
let user: User;

test.beforeEach(async ({ context, baseURL }) => {
  user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);
  await setBudget(user.supabase, user.userId, 80000);
});

/** A plain JPEG of the given size, drawn in the page, as a "photo" to pick. */
async function photo(page: Page, width: number, height: number) {
  const base64 = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#f4f1ea";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#222";
      context.font = "32px sans-serif";
      context.fillText("TOTAL RM 42.30", 40, 80);
      return canvas.toDataURL("image/jpeg", 0.9).split(",")[1]!;
    },
    { width, height },
  );
  return { name: "receipt.jpg", mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

async function storedReceipts(u: User = user) {
  const { data, error } = await u.supabase.storage.from("receipts").list(u.userId);
  if (error) throw error;
  return data.map((o) => `${u.userId}/${o.name}`);
}

async function snap(page: Page, width: number, height: number) {
  await page.goto("/chat");
  await page.locator("#receipt-gallery-input").setInputFiles(await photo(page, width, height));
}

test("a receipt pre-fills the card, splits into two rows and saves with one photo", async ({ page }) => {
  await snap(page, 600, 1000);

  await expect(page.getByText("New Transaction")).toBeVisible();
  await expect(page.locator("#confirmation-amount-input")).toHaveValue("42.30");
  await expect(page.locator("#confirmation-merchant-input")).toHaveValue("99 Speedmart");
  await expect(page.locator("#receipt-thumbnail")).toBeVisible();
  // The composer's receipt buttons once pushed the page (and the sheet) wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  const [uploaded] = await storedReceipts();
  expect(uploaded).toBeDefined();

  await page.locator("#btn-split").click();
  const save = page.locator("#btn-confirm-save");
  await page.locator("#split-amount-0").fill("30.00");
  await expect(page.locator("#split-remaining")).toHaveText("Remaining: RM 12.30");
  await expect(save).toBeDisabled();

  await page.locator("#split-amount-1").fill("12.3");
  await page.locator("#split-category-1").selectOption({ label: "Food & Drinks" });
  await page.getByRole("group", { name: "Row 2 needs or wants" }).getByRole("button", { name: "Wants" }).click();
  await expect(page.locator("#split-remaining")).toHaveText("Remaining: RM 0.00");
  await expect(save).toBeEnabled();

  await page.locator("#split-amount-1").fill("12.29");
  await expect(page.locator("#split-remaining")).toHaveText("Remaining: RM 0.01");
  await expect(save).toBeDisabled();
  await page.locator("#split-amount-1").fill("12.30");
  await save.click();
  await expect(page.getByText("Transaction recorded successfully!")).toBeVisible();

  const { data: rows, error } = await user.supabase
    .from("transactions")
    .select("amount, is_essential, merchant, date, payment_method, receipt_url, receipt_group_id, categories(name)")
    .order("amount", { ascending: false });
  if (error) throw error;
  expect(rows).toHaveLength(2);
  expect(rows.map((r) => [r.amount, (r.categories as unknown as { name: string }).name, r.is_essential])).toEqual([
    [30, "Groceries", true],
    [12.3, "Food & Drinks", false],
  ]);
  // F6-3: both rows share merchant, date, payment method and the photo, under one group.
  const [a, b] = rows;
  expect(a!.receipt_group_id).toBeTruthy();
  for (const field of ["receipt_group_id", "receipt_url", "merchant", "date", "payment_method"] as const) {
    expect(b![field]).toBe(a![field]);
  }
  expect(a!.receipt_url).toBe(uploaded);
  expect(await storedReceipts()).toEqual([uploaded]);
});

test("a photo that isn't a receipt is refused and its upload deleted", async ({ page }) => {
  await snap(page, 1000, 600);
  await expect(page.getByText("This doesn't look like a receipt")).toBeVisible();
  await expect(page.getByText("New Transaction")).toBeHidden();
  expect(await storedReceipts()).toEqual([]);
});

test("Discard deletes the upload and saves nothing", async ({ page }) => {
  await snap(page, 600, 1000);
  await expect(page.locator("#confirmation-amount-input")).toHaveValue("42.30");
  expect(await storedReceipts()).toHaveLength(1);

  await page.locator("#btn-discard-receipt").click();
  await expect(page.getByText("New Transaction")).toBeHidden();
  await expect.poll(storedReceipts).toEqual([]);
  const { count } = await user.supabase.from("transactions").select("id", { count: "exact", head: true });
  expect(count).toBe(0);
});

test("closing the card with X also deletes the upload", async ({ page }) => {
  await snap(page, 600, 1000);
  await expect(page.locator("#confirmation-amount-input")).toHaveValue("42.30");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("New Transaction")).toBeHidden();
  await expect.poll(storedReceipts).toEqual([]);
});

test("a low-confidence, non-RM receipt is highlighted and needs a currency check", async ({ page }) => {
  await snap(page, 800, 800);
  const amount = page.locator("#confirmation-amount-input");
  await expect(amount).toHaveValue("12.00");
  await expect(amount).toHaveAttribute("data-highlight", "low-confidence");
  await expect(page.getByText("Please double-check")).toBeVisible();
  await expect(page.getByText("Currency may not be RM")).toBeVisible();

  await page.locator("#payment-method-card").click();
  const save = page.locator("#btn-confirm-save");
  await expect(save).toBeDisabled();
  await page.locator("#confirm-currency-rm").check();
  await expect(save).toBeEnabled();

  await amount.fill("12.50");
  await expect(amount).not.toHaveAttribute("data-highlight", "low-confidence");
});

test("Storage RLS: another user can't read, list or delete my receipt", async ({ page, baseURL }) => {
  await snap(page, 600, 1000);
  await expect(page.locator("#confirmation-amount-input")).toHaveValue("42.30");
  const [mine] = await storedReceipts();

  const attacker = await createSignedInUser(baseURL!);
  const bucket = attacker.supabase.storage.from("receipts");
  const { data: downloaded } = await bucket.download(mine!);
  expect(downloaded).toBeNull();
  const { data: listed } = await bucket.list(user.userId);
  expect(listed ?? []).toEqual([]);
  const { data: signed } = await bucket.createSignedUrl(mine!, 60);
  expect(signed).toBeNull();
  await bucket.remove([mine!]);
  const { error: uploadError } = await bucket.upload(`${user.userId}/planted.jpg`, new Blob(["x"], { type: "image/jpeg" }));
  expect(uploadError).not.toBeNull();

  expect(await storedReceipts()).toEqual([mine]);
});

test("History shows the split as one collapsed group with its photo; deleting both rows removes the image", async ({ page }) => {
  await snap(page, 600, 1000);
  await expect(page.locator("#confirmation-amount-input")).toHaveValue("42.30");
  await page.locator("#btn-split").click();
  await page.locator("#split-amount-0").fill("30.00");
  await page.locator("#split-amount-1").fill("12.30");
  await page.locator("#btn-confirm-save").click();
  await expect(page.getByText("Transaction recorded successfully!")).toBeVisible();
  const [path] = await storedReceipts();

  await page.goto("/history");
  const group = page.getByTestId("receipt-group");
  await expect(group).toHaveCount(1);
  await expect(group.getByText("99 Speedmart")).toBeVisible();
  await expect(group.getByText("-RM 42.30")).toBeVisible();
  await expect(group.getByRole("img", { name: "Receipt" })).toHaveJSProperty("complete", true);
  expect(await group.getByRole("img", { name: "Receipt" }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(group.getByTestId("history-row")).toHaveCount(0);

  const header = group.getByRole("button", { expanded: false });
  await header.click();
  await expect(group.getByTestId("history-row")).toHaveCount(2);

  // Deleting one row keeps the photo for the other; deleting the last row removes it (M4.5).
  await group.getByTestId("history-row").first().getByRole("button", { name: "Delete transaction" }).click();
  await page.locator("#btn-confirm-delete").click();
  await expect(page.getByTestId("history-row")).toHaveCount(1);
  expect(await storedReceipts()).toEqual([path]);

  await page.getByTestId("history-row").getByRole("button", { name: "Delete transaction" }).click();
  await page.locator("#btn-confirm-delete").click();
  await expect(page.getByText("No transactions found")).toBeVisible();
  await expect.poll(storedReceipts).toEqual([]);
});

test("at the daily AI cap the photo is kept and the card opens empty to fill by hand", async ({ page }) => {
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const { error } = await user.supabase.from("ai_usage").insert({ user_id: user.userId, day: today, calls: 100 });
  if (error) throw error;

  await snap(page, 600, 1000);
  await expect(page.getByText("Daily AI limit reached. Fill in the card by hand; the photo is attached.")).toBeVisible();
  await expect(page.getByText("New Transaction")).toBeVisible();
  await expect(page.locator("#receipt-thumbnail")).toBeVisible();
  await expect(page.locator("#confirmation-amount-input")).toHaveValue("");
  expect(await storedReceipts()).toHaveLength(1);

  await page.locator("#confirmation-amount-input").fill("42.30");
  await page.locator("#category-selector-dropdown").selectOption({ label: "Groceries" });
  await page.locator("#payment-method-cash").click();
  await page.locator("#btn-confirm-save").click();
  await expect(page.getByText("Transaction recorded successfully!")).toBeVisible();
  const { data: rows } = await user.supabase.from("transactions").select("amount, receipt_url, receipt_group_id");
  expect(rows).toEqual([{ amount: 42.3, receipt_url: (await storedReceipts())[0], receipt_group_id: null }]);
});
