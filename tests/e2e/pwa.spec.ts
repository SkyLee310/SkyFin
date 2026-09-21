import { type APIRequestContext, expect, test } from "@playwright/test";

// iOS fetches the manifest and icons without the session cookie. maxRedirects: 0 makes a
// redirect to /login fail here, since it would break Add to Home Screen.
async function expectSquarePng(request: APIRequestContext, src: string, size: number) {
  const response = await request.get(src, { maxRedirects: 0 });
  expect(response.status(), src).toBe(200);
  expect(response.headers()["content-type"], src).toBe("image/png");
  // After the 8-byte PNG signature, the IHDR chunk holds the width at byte 16 and height at byte 20.
  const png = await response.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)], src).toEqual([size, size]);
}

test("the manifest makes SkyFin an installable standalone app", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  const manifest = await response.json();

  expect(manifest).toMatchObject({
    name: "SkyFin",
    short_name: "SkyFin",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
    background_color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
  });
  const icons: { src: string; sizes: string; type: string; purpose?: string }[] = manifest.icons;
  expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  for (const icon of icons) {
    expect(icon.type).toBe("image/png");
    await expectSquarePng(request, icon.src, Number(icon.sizes.split("x")[0]));
  }
});

test("every page links the Home Screen icon and fills the screen edge to edge", async ({
  page,
  request,
}) => {
  await page.goto("/login");

  const appleIcon = page.locator('link[rel="apple-touch-icon"]');
  await expect(appleIcon).toHaveAttribute("href", /\.png$/);
  await expectSquarePng(request, (await appleIcon.getAttribute("href"))!, 180);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    "content",
    "SkyFin",
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  // The status bar follows the system theme; the page background matches it in both modes.
  for (const scheme of ["light", "dark"]) {
    await expect(
      page.locator(`meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`),
    ).toHaveAttribute("content", /^#[0-9a-f]{6}$/i);
  }
  // Content runs under the home indicator; bottom bars pad themselves with pb-safe.
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
});
