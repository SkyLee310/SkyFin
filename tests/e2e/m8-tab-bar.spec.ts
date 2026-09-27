import { test, expect, type Page } from "@playwright/test";
import { createSignedInUser, setBudget } from "./support/session";

// M8.12: the tab bar is frosted glass, and its light capsule slides to a tapped tab while
// that tab's page loads, instead of jumping when the page arrives.

/** Waits until React has hydrated the tab bar: a tap before that is a full page load. */
async function waitForHydratedNav(page: Page) {
  await page.waitForFunction(() => {
    const link = document.querySelector("nav a[data-tab]");
    return link !== null && Object.keys(link).some((key) => key.startsWith("__reactProps"));
  });
}

test.beforeEach(async ({ context, baseURL }) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);
  await setBudget(user.supabase, user.userId, 80000);
});

test("the capsule moves to a tapped tab before its page arrives", async ({ page, baseURL }) => {
  // Compile History first, so the held request below is the only wait.
  await page.goto("/history");
  await page.goto("/");
  await waitForHydratedNav(page);

  // Hold the navigation's RSC request, so the page stays on Dashboard until release().
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === "/history",
    async (route) => {
      if (route.request().headers()["rsc"] === "1") await released;
      await route.continue();
    },
  );

  const nav = page.getByRole("navigation");
  const dashboard = nav.getByRole("link", { name: "Dashboard" });
  const history = nav.getByRole("link", { name: "History" });
  const pill = page.locator(".tab-pill");
  const historyX = (await history.boundingBox())!.x;
  expect(Math.abs((await pill.boundingBox())!.x - historyX)).toBeGreaterThan(1);

  await history.click();
  await expect
    .poll(async () => Math.abs((await pill.boundingBox())!.x - historyX))
    .toBeLessThan(1);
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(dashboard).toHaveAttribute("aria-current", "page");

  release();
  await expect(page).toHaveURL(/\/history$/, { timeout: 20_000 });
  await expect(history).toHaveAttribute("aria-current", "page");
  expect(Math.abs((await pill.boundingBox())!.x - historyX)).toBeLessThan(1);
});

test("the tab bar is frosted glass, and solid when the system asks for more contrast", async ({
  page,
}) => {
  await page.goto("/");
  // The blur, and a background of rgba() (translucent) or rgb() (solid).
  const glass = () =>
    page.getByRole("navigation").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        filter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
        background: style.backgroundColor,
      };
    });

  const frosted = await glass();
  expect(frosted.filter).toContain("blur(20px)");
  expect(frosted.background).toMatch(/^rgba\(/);

  await page.emulateMedia({ contrast: "more" });
  const solid = await glass();
  expect(solid.filter).toBe("none");
  expect(solid.background).toMatch(/^rgb\(/);
});
