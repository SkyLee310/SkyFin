import { test, expect, type Page } from "@playwright/test";
import { createSignedInUser, setBudget } from "./support/session";

// M8.13: an empty chat opens at the top, like every other page. It used to scroll its (empty)
// message list into view on arrival, which nudged the page up by whatever the empty card left
// below the fold: 8 px on this viewport, so its heading sat higher than on the other tabs.
// A new message still scrolls into view: smoothly, or at once under Reduce Motion, which an
// explicit smooth scroll would ignore.

/** Waits until React has hydrated the chat page; its effects run right after. */
async function waitForHydratedChat(page: Page) {
  await page.waitForFunction(() => {
    const input = document.querySelector("#chat-input");
    return input !== null && Object.keys(input).some((key) => key.startsWith("__reactProps"));
  });
}

test.beforeEach(async ({ context, baseURL }) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);
  await setBudget(user.supabase, user.userId, 80000);
});

test("an empty chat opens at the top and stays there", async ({ page }) => {
  // Every scroll position the page passes through, from its first paint on.
  await page.addInitScript(() => {
    const seen: number[] = [];
    Object.assign(window, { seenScrolls: seen });
    addEventListener("scroll", () => seen.push(Math.round(scrollY)), { passive: true });
  });

  await page.goto("/chat");
  await waitForHydratedChat(page);
  // A scroll on arrival starts within a frame of the effects and runs for a few hundred ms.
  await page.waitForTimeout(1000);

  expect(await page.evaluate(() => (window as unknown as { seenScrolls: number[] }).seenScrolls)).toEqual([]);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

for (const { name, reducedMotion, behavior } of [
  { name: "a new message glides into view", reducedMotion: "no-preference", behavior: "smooth" },
  { name: "under Reduce Motion, a new message jumps into view", reducedMotion: "reduce", behavior: "auto" },
] as const) {
  test(name, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    // Every scroll the message list asks for; each still happens as usual. Sending empties the
    // page of its empty card, so the page itself may have nowhere to scroll to.
    await page.addInitScript(() => {
      const asked: unknown[] = [];
      Object.assign(window, { listScrolls: asked });
      const scrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) {
        if (this.closest("#chat-message-list")) asked.push(options);
        scrollIntoView.call(this, options);
      };
    });

    await page.goto("/chat");
    await waitForHydratedChat(page);
    await page.getByRole("button", { name: "Makan nasi lemak RM8.50 pakai eWallet" }).click();
    await expect(page.getByText("Okay, nasi lemak RM8.50 with eWallet.")).toBeVisible();

    const asked = await page.evaluate(() => (window as unknown as { listScrolls: unknown[] }).listScrolls);
    expect(asked).not.toHaveLength(0);
    expect(asked).toEqual(asked.map(() => ({ behavior, block: "end" })));
  });
}
