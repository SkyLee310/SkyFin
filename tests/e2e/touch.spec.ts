import { test, expect, type Page } from "@playwright/test";
import { createSignedInUser, setBudget, insertExpense } from "./support/session";

// iPhone ergonomics (AGENTS.md UI rules): iOS Safari zooms the page into any field under 16px,
// and every tap target is at least 44 px.

async function problems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null && !el.closest("nextjs-portal");
    const name = (el: Element) =>
      (el.getAttribute("aria-label") || el.id || el.textContent || el.tagName).trim().slice(0, 30);
    const out: string[] = [];
    for (const el of document.querySelectorAll("input, select, textarea")) {
      const type = (el as HTMLInputElement).type;
      if (!visible(el) || ["file", "checkbox", "hidden"].includes(type)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 16) out.push(`${name(el)}: ${size}px text makes iOS zoom`);
    }
    for (const el of document.querySelectorAll("button, a, select, input:not([type=file]):not([type=hidden])")) {
      if (!visible(el)) continue;
      // A checkbox inside its label is tapped through the label.
      const target = (el as HTMLInputElement).type === "checkbox" ? (el.closest("label") ?? el) : el;
      const { width, height } = target.getBoundingClientRect();
      if (width < 44 || height < 44) out.push(`${name(el)}: ${Math.round(width)}x${Math.round(height)} tap target`);
    }
    return out;
  });
}

test("form fields are 16px or larger and tap targets 44 px or larger", async ({ page, context, baseURL }) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);
  await setBudget(user.supabase, user.userId, 80000);
  await insertExpense(user.supabase, user.userId, 1250);
  const found: string[] = [];
  const check = async (where: string) => found.push(...(await problems(page)).map((p) => `${where} · ${p}`));

  await page.goto("/");
  await check("dashboard");

  await page.goto("/chat");
  await page.locator("#chat-input").fill("nasi lemak 8.50, boba 12");
  await page.locator("#btn-chat-send").click();
  await expect(page.getByTestId("draft-row")).toHaveCount(2);
  await check("chat");

  await page.locator("#btn-add-manual-plus").click();
  await expect(page.getByText("New Transaction")).toBeVisible();
  await check("card");
  await page.locator("#btn-open-add-category").click();
  await check("card, new category");
  await page.keyboard.press("Escape");

  const photo = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 1000;
    c.getContext("2d")!.fillRect(0, 0, 1, 1);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1]!;
  });
  await page
    .locator("#receipt-gallery-input")
    .setInputFiles({ name: "r.jpg", mimeType: "image/jpeg", buffer: Buffer.from(photo, "base64") });
  await expect(page.locator("#confirmation-amount-input")).toHaveValue("42.30");
  await page.locator("#btn-split").click();
  await check("split");
  await page.locator("#btn-discard-receipt").click();

  await page.goto("/history");
  await check("history");
  await page.goto("/audit");
  await page.locator("#btn-add-category-settings").click();
  await check("audit");

  expect(found).toEqual([]);
});
