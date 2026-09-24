import { expect, test } from "@playwright/test";
import { createSignedInUser, startEmailSignIn } from "./support/session";

test("a signed-out visitor is sent to the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/login");
  const button = page.getByRole("button", { name: "Continue with Google" });
  await expect(button).toBeVisible();
  expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("Continue with Google starts a PKCE sign-in that returns to /auth/callback", async ({
  page,
  context,
  baseURL,
}) => {
  // Stop at Supabase's authorize endpoint: Google itself can't run in a test.
  await page.route("**/auth/v1/authorize**", (route) => route.fulfill({ status: 200, body: "stub" }));
  await page.goto("/login");

  const authorize = page.waitForRequest("**/auth/v1/authorize**");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const url = new URL((await authorize).url());

  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe(`${baseURL}/auth/callback`);
  expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  // The callback route reads the verifier from a cookie; browser storage would not reach it.
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name.endsWith("-auth-token-code-verifier"))).toBe(true);
});

test("the callback exchanges the code and lands the user signed in", async ({
  page,
  context,
  baseURL,
}) => {
  // Email stands in for Google here: both send a PKCE code back to /auth/callback.
  const signIn = await startEmailSignIn(baseURL!);
  await context.addCookies(signIn.cookies);

  await page.goto(signIn.callbackURL);

  // The session cookies must ride on the callback's redirect, or / sends the user to /login.
  await expect(page).toHaveURL("/");
  // A fresh, signed-in user lands on the real Dashboard, which auto-opens onboarding.
  await expect(page.getByRole("heading", { name: "Set your monthly budget" })).toBeVisible();
});

test("a callback without a code shows a sign-in error", async ({ page }) => {
  await page.goto("/auth/callback");

  await expect(page).toHaveURL("/login?error=auth");
  // Next's route announcer is an alert too, so match by text.
  await expect(page.getByRole("alert").filter({ hasText: "Sign-in didn't finish" })).toBeVisible();
});

test("a callback in a browser without the PKCE verifier shows a sign-in error", async ({ page }) => {
  // How R1 would fail: the code returns to a container that never started the sign-in.
  await page.goto("/auth/callback?code=from-another-browser");

  await expect(page).toHaveURL("/login?error=auth");
});

test("a signed-in user skips the login page", async ({ page, context, baseURL }) => {
  const user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);

  await page.goto("/login");

  await expect(page).toHaveURL("/");
  // A fresh, signed-in user lands on the real Dashboard, which auto-opens onboarding.
  await expect(page.getByRole("heading", { name: "Set your monthly budget" })).toBeVisible();
});
