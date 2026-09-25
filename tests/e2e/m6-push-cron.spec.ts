import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { evaluatePace, warningMessage } from "../../src/lib/agents/accounting";
import { todayMYT } from "../../src/lib/dates";
import { createSignedInUser, insertRows, runCron, setBudget } from "./support/session";
import { startPushServer } from "./support/push-server";

// M6: warnings with the app closed. The cron runs as Vercel calls it (bearer token), scoped to one
// test user with ?user=; pushes go to a local stand-in push service (PUSH_FAKE, src/lib/push.ts).

type User = Awaited<ReturnType<typeof createSignedInUser>>;
let user: User;
let push: Awaited<ReturnType<typeof startPushServer>>;

test.beforeEach(async ({ context, baseURL }) => {
  user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);
  await setBudget(user.supabase, user.userId, 80000);
  push = await startPushServer();
});

test.afterEach(async () => {
  await push.close();
});

async function subscribe(path = `/sub/${randomUUID()}`) {
  const endpoint = push.url(path);
  const { error } = await user.supabase
    .from("push_subscriptions")
    .insert({ user_id: user.userId, endpoint, p256dh: "test-p256dh", auth: "test-auth" });
  if (error) throw error;
  return endpoint;
}

test("M6.12: the cron route answers 401 without the exact bearer token", async ({ baseURL }) => {
  expect((await runCron(baseURL!, {}, "")).status).toBe(401);
  expect((await runCron(baseURL!, {}, "wrong-token")).status).toBe(401);
  expect((await runCron(baseURL!, {}, `${process.env.CRON_SECRET}x`)).status).toBe(401);
});

test("F11-1, M6.13: crossing 80% during the day gives one push that evening; a second run sends none", async ({
  baseURL,
}) => {
  await subscribe();
  await insertRows(user, [{ amountSen: 66000, category: "Rent & Utilities" }]);

  const first = await runCron(baseURL!, { user: user.userId });
  expect(first.status).toBe(200);
  expect(push.received).toHaveLength(1);

  // The push carries the most severe new warning, in the user's language, and opens the Dashboard.
  const input = { budgetSen: 80000, spentSen: 66000, spentExcludedSen: 0, today: todayMYT() };
  const result = evaluatePace(input);
  expect(push.received[0]!.payload).toEqual({
    title: "SkyFin budget alert",
    body: warningMessage(result.warnings[0]!, result, input, "en"),
    url: "/",
    tag: "budget-warning",
  });

  const second = await runCron(baseURL!, { user: user.userId });
  expect(second.status).toBe(200);
  expect(push.received).toHaveLength(1);
});

test("a warning raised in the app during the day is pushed once that evening", async ({
  page,
  baseURL,
}) => {
  await subscribe();
  await page.goto("/chat");
  await page.locator("#btn-add-manual-plus").click();
  await page.locator("#confirmation-amount-input").fill("200");
  await page.locator("#category-selector-dropdown").selectOption({ label: "Shopping" });
  await page.locator("#payment-method-card").click();
  await page.locator("#confirmation-merchant-input").fill("Shopee");
  await page.locator("#btn-confirm-save").click();
  await expect(page.locator("#warning-banner")).toHaveAttribute("data-level", "spike");

  await runCron(baseURL!, { user: user.userId });
  expect(push.received.map((p) => p.payload.body)).toEqual([
    "RM 200.00 at Shopee is 25% of this month's budget. Is this a one-off purchase?",
  ]);

  // Tapping the notification opens the Dashboard, where the banner is waiting.
  await page.goto(push.received[0]!.payload.url);
  await expect(page.locator("#warning-banner")).toHaveAttribute("data-level", "spike");

  await runCron(baseURL!, { user: user.userId });
  expect(push.received).toHaveLength(1);
});

test("F11-2: a 410 from the push service deletes the dead subscription", async ({ baseURL }) => {
  const dead = await subscribe(`/gone/${randomUUID()}`);
  const live = await subscribe();
  await insertRows(user, [{ amountSen: 66000, category: "Rent & Utilities" }]);

  await runCron(baseURL!, { user: user.userId });
  expect(push.received).toHaveLength(1);
  const { data } = await user.supabase.from("push_subscriptions").select("endpoint");
  expect(data!.map((r) => r.endpoint)).toEqual([live]);
  expect(dead).not.toEqual(live);
});

test("a month with no new warning and no audit due sends nothing", async ({ baseURL }) => {
  await subscribe();
  const { status, body } = await runCron(baseURL!, { user: user.userId });
  expect(status).toBe(200);
  expect(push.received).toHaveLength(0);
  expect((body.users as { errors: string[] }[])[0]!.errors).toEqual([]);
});

test("/api/push/subscribe stores and removes this device's subscription, for signed-in users only", async ({
  page,
  baseURL,
}) => {
  const endpoint = push.url(`/sub/${randomUUID()}`);
  const body = { endpoint, keys: { p256dh: "BNc-key", auth: "auth-secret" } };

  const anonymous = await fetch(`${baseURL}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(anonymous.status).toBe(401);

  expect((await page.request.post("/api/push/subscribe", { data: { endpoint: "not a url" } })).status()).toBe(400);
  expect((await page.request.post("/api/push/subscribe", { data: body })).status()).toBe(200);
  // Re-subscribing on the next app open (M6.9) replaces the row rather than adding one.
  expect((await page.request.post("/api/push/subscribe", { data: body })).status()).toBe(200);
  const { data: stored } = await user.supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  expect(stored).toEqual([{ endpoint, p256dh: "BNc-key", auth: "auth-secret" }]);

  expect((await page.request.delete("/api/push/subscribe", { data: { endpoint } })).status()).toBe(200);
  const { data: after } = await user.supabase.from("push_subscriptions").select("endpoint");
  expect(after).toEqual([]);
});

test("F15-1: in Safari the Dashboard shows Add-to-Home-Screen steps and never asks for notifications", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { __permissionAsks: number }).__permissionAsks = 0;
    if ("Notification" in window) {
      Notification.requestPermission = async () => {
        (window as unknown as { __permissionAsks: number }).__permissionAsks++;
        return "default";
      };
    }
  });
  await page.goto("/");
  await expect(page.locator("#install-step")).toContainText("Add to Home Screen");
  await expect(page.locator("#notify-step")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __permissionAsks: number }).__permissionAsks)).toBe(0);

  await page.getByRole("button", { name: "Hide install steps" }).click();
  await page.reload();
  await expect(page.locator("#install-step")).toHaveCount(0);
});

test("F15-2: opened from the Home Screen, the permission prompt appears only after a tap", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    const w = window as unknown as { __permissionAsks: number; Notification: unknown; PushManager: unknown };
    w.__permissionAsks = 0;
    // Headless Chromium has Notification; make sure PushManager looks available too.
    w.PushManager ??= function PushManager() {};
    Object.defineProperty(Notification, "permission", { get: () => "default" });
    Notification.requestPermission = async () => {
      w.__permissionAsks++;
      return "denied";
    };
  });
  await page.goto("/");
  await expect(page.locator("#notify-step")).toBeVisible();
  await expect(page.locator("#install-step")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __permissionAsks: number }).__permissionAsks)).toBe(0);

  await page.locator("#btn-enable-notifications").click();
  await expect(page.locator("#notify-step")).toContainText("Notifications are off");
  expect(await page.evaluate(() => (window as unknown as { __permissionAsks: number }).__permissionAsks)).toBe(1);
});

test("FR-26: a receipt whose photo the sweep removed shows 'Image expired' in History", async ({ page }) => {
  await insertRows(user, [
    { amountSen: 3000, category: "Groceries", merchant: "99 Speedmart", receiptGroupId: randomUUID() },
  ]);
  const group = randomUUID();
  await insertRows(user, [
    { amountSen: 3000, category: "Groceries", merchant: "Tesco", receiptGroupId: group },
    { amountSen: 1230, category: "Food & Drinks", merchant: "Tesco", essential: false, receiptGroupId: group },
  ]);
  await page.goto("/history");
  await expect(page.getByTestId("image-expired")).toHaveCount(2);
  await expect(page.getByTestId("receipt-group")).toContainText("Tesco");
});
