import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { type AuditContent, reportFigures, rmAmountsIn } from "../../src/lib/agents/audit-content";
import { addDaysMYT, monthRangeMYT, shiftMonth, todayMYT, weekdayMYT } from "../../src/lib/dates";
import { formatRM } from "../../src/lib/money";
import { createSignedInUser, insertRows, runCron, setBudget } from "./support/session";
import { startPushServer } from "./support/push-server";

// M7 demo through the cron's test-only ?date= override and the D30 fake model. Dates are picked
// relative to today so every seeded row is in the past.

type User = Awaited<ReturnType<typeof createSignedInUser>>;
let user: User;
let push: Awaited<ReturnType<typeof startPushServer>>;

test.beforeEach(async ({ context, baseURL }) => {
  user = await createSignedInUser(baseURL!);
  await context.addCookies(user.cookies);
  await setBudget(user.supabase, user.userId, 80000);
  push = await startPushServer();
  const { error } = await user.supabase.from("push_subscriptions").insert({
    user_id: user.userId,
    endpoint: push.url(`/sub/${randomUUID()}`),
    p256dh: "p",
    auth: "a",
  });
  if (error) throw error;
});

test.afterEach(async () => {
  await push.close();
});

/** The latest Sunday on or before today, and its Monday. */
function lastWeek() {
  const today = todayMYT();
  const sunday = addDaysMYT(today, -weekdayMYT(today));
  return { monday: addDaysMYT(sunday, -6), sunday };
}

async function seedBobaWeek(monday: string) {
  await insertRows(user, [
    ...[800, 850, 800, 950].map((amountSen, i) => ({
      amountSen,
      category: "Food & Drinks",
      essential: false,
      itemLabel: "boba",
      payment: "eWallet" as const,
      date: addDaysMYT(monday, i),
    })),
    { amountSen: 1200, category: "Food & Drinks", itemLabel: "nasi lemak", date: addDaysMYT(monday, 1) },
    { amountSen: 2000, category: "Transport", itemLabel: "grab ride", merchant: "Grab", date: addDaysMYT(monday, 5) },
  ]);
}

async function reports() {
  const { data, error } = await user.supabase
    .from("audit_reports")
    .select("id, type, dedup_key, content")
    .in("type", ["weekly_audit", "monthly_audit"]);
  if (error) throw error;
  return data as { id: string; type: string; dedup_key: string; content: AuditContent }[];
}

test("F12: Sunday → push → weekly audit with boba as a micro-expense and exactly 3 tips; no duplicate on re-run", async ({
  page,
  baseURL,
}) => {
  const { monday, sunday } = lastWeek();
  await seedBobaWeek(monday);

  const run = await runCron(baseURL!, { date: sunday, user: user.userId });
  expect(run.status).toBe(200);
  const [report] = await reports();
  expect(report).toMatchObject({ type: "weekly_audit", dedup_key: `weekly:${monday}` });

  const weeklyPushes = push.received.filter((p) => p.payload.title === "Your weekly audit is ready");
  expect(weeklyPushes).toHaveLength(1);
  expect(weeklyPushes[0]!.payload).toMatchObject({ url: `/audit/${report!.id}`, body: report!.content.headline });

  // The Audit tab badge counts the unread report until it's opened (M6.10).
  await page.goto("/audit");
  await expect(page.locator("#audit-badge")).toHaveText("1");
  await expect(page.locator("#latest-report")).toContainText(report!.content.headline);

  await page.goto(weeklyPushes[0]!.payload.url);
  await expect(page.locator("#report-headline")).toHaveText(report!.content.headline);
  await expect(page.getByTestId("micro-expense")).toHaveText(["boba 4× = RM 34.00, ≈ RM 145.71/month"]);
  await expect(page.getByTestId("audit-tip")).toHaveCount(3);
  await expect(page.locator("#report-total")).toHaveText("RM 66.00");

  // M7.9 on the real page: every RM amount shown is a pre-computed figure.
  const text = await page.locator("#audit-report").innerText();
  const allowed = reportFigures(report!.content);
  expect(rmAmountsIn(text).filter((amount) => !allowed.has(amount))).toEqual([]);
  await expect(page.locator("#audit-badge")).toHaveCount(0);

  // F12-3: the same Sunday again makes no second report and no second push.
  await runCron(baseURL!, { date: sunday, user: user.userId });
  expect(await reports()).toHaveLength(1);
  expect(push.received.filter((p) => p.payload.title === "Your weekly audit is ready")).toHaveLength(1);
});

test("the audit and its push are written in preferred_language", async ({ baseURL }) => {
  await user.supabase.from("profiles").update({ preferred_language: "zh" }).eq("id", user.userId);
  const { monday, sunday } = lastWeek();
  await seedBobaWeek(monday);

  await runCron(baseURL!, { date: sunday, user: user.userId });
  const [report] = await reports();
  expect(report!.content.language).toBe("zh");
  expect(report!.content.headline).toContain("小额消费");
  expect(report!.content.tips).toHaveLength(3);
  expect(push.received.map((p) => p.payload.title)).toContain("你的每周审计已生成");
});

test("a week with no expenses gets no report", async ({ baseURL }) => {
  await runCron(baseURL!, { date: lastWeek().sunday, user: user.userId });
  expect(await reports()).toEqual([]);
  expect(push.received).toEqual([]);
});

test("F13: month end → review with a suggested budget; the 1st applies it with a push; one tap undoes it", async ({
  page,
  baseURL,
}) => {
  const thisMonth = todayMYT().slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, -1);
  const { end: lastDay } = monthRangeMYT(`${lastMonth}-01`);
  await insertRows(user, [
    { amountSen: 45000, category: "Rent & Utilities", date: `${lastMonth}-03` },
    { amountSen: 20000, category: "Groceries", date: `${lastMonth}-10` },
    { amountSen: 15000, category: "Shopping", essential: false, merchant: "Shopee", date: `${lastMonth}-20` },
    { amountSen: 5000, category: "Entertainment", essential: false, date: lastDay },
  ]);

  // The last day of last month: the monthly review (F13-1).
  await runCron(baseURL!, { date: lastDay, user: user.userId });
  const monthly = (await reports()).find((r) => r.type === "monthly_audit")!;
  expect(monthly.dedup_key).toBe(`monthly:${lastMonth}`);
  // Needs RM 650 + 90% of Wants RM 200 = RM 830, rounded up to RM 10.
  expect(monthly.content.budget).toMatchObject({ suggested_budget_sen: 83000, previous_budget_sen: 80000, for_month: thisMonth });
  expect(push.received.map((p) => p.payload.title)).toContain("Your monthly review is ready");

  await page.goto(`/audit/${monthly.id}`);
  await expect(page.locator("#report-budget")).toContainText("RM 830.00");
  const allowed = reportFigures(monthly.content);
  expect(rmAmountsIn(await page.locator("#audit-report").innerText()).filter((a) => !allowed.has(a))).toEqual([]);

  // The 1st: applied automatically, with a push (F13-3, D19).
  await runCron(baseURL!, { date: `${thisMonth}-01`, user: user.userId });
  const monthName = new Intl.DateTimeFormat("en-MY", { month: "long", timeZone: "UTC" }).format(
    new Date(`${thisMonth}-01T00:00:00Z`),
  );
  const applied = push.received.filter((p) => p.payload.title === "New monthly budget");
  expect(applied.map((p) => p.payload.body)).toEqual([`Your budget for ${monthName} is ${formatRM(83000)} — tap to change`]);
  const { data: profile } = await user.supabase.from("profiles").select("monthly_budget").single();
  expect(profile!.monthly_budget).toBe(830);

  // Running the 1st again applies nothing twice.
  await runCron(baseURL!, { date: `${thisMonth}-01`, user: user.userId });
  expect(push.received.filter((p) => p.payload.title === "New monthly budget")).toHaveLength(1);

  // Tap the push → Dashboard with the banner → Undo.
  await page.goto(applied[0]!.payload.url);
  await expect(page.locator("#budget-applied-banner")).toContainText("RM 830.00");
  await page.locator("#btn-undo-budget").click();
  await expect(page.locator("#budget-applied-banner")).toHaveCount(0);
  await expect(page.getByText("of RM 800.00")).toBeVisible();
  const { data: restored } = await user.supabase.from("profiles").select("monthly_budget").single();
  expect(restored!.monthly_budget).toBe(800);
});
