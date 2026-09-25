import { test, expect, type Page } from "@playwright/test";
import { createSignedInUser, setBudget } from "./support/session";

// Dark mode follows the system (PRD §9). The screens colour with Tailwind's palette, which
// globals.css mirrors in dark mode; before that, titles were near-black on a near-black page.

/** WCAG contrast between an element's text colour and the page background, read via a canvas. */
async function titleContrast(page: Page): Promise<number> {
  return page.evaluate(() => {
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const luminance = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const text = luminance(getComputedStyle(document.querySelector("h1")!).color);
    const page = luminance(getComputedStyle(document.body).backgroundColor);
    return (Math.max(text, page) + 0.05) / (Math.min(text, page) + 0.05);
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test("every tab's title is readable against the page", async ({ page, context, baseURL }) => {
      const user = await createSignedInUser(baseURL!);
      await context.addCookies(user.cookies);
      await setBudget(user.supabase, user.userId, 80000);

      for (const path of ["/", "/chat", "/history", "/audit"]) {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        expect(await titleContrast(page), `title contrast on ${path}`).toBeGreaterThanOrEqual(7);
      }
    });
  });
}
