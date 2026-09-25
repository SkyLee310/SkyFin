import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { bySeverity, runAccountingCheck, toWarning } from "@/lib/agents/accounting";
import type { AuditContent } from "@/lib/agents/audit-content";
import { dedupKeyFor, generateAudit } from "@/lib/agents/audit";
import { monthRangeMYT, shiftMonth } from "@/lib/dates";
import { messages, monthName } from "@/lib/i18n";
import { numericToSen, senToNumeric } from "@/lib/money";
import { type PushPayload, type PushSender, defaultPushSender, sendPush } from "@/lib/push";
import { RECEIPTS_BUCKET } from "@/lib/receipts";
import { Lang } from "@/lib/validation/schemas";
import { dailySchedule } from "./schedule";

// The evening cron (TECH_SPEC §3.3). Each step is date-based and idempotent, so a late, repeated
// or overlapping run is harmless: dedup keys stop duplicate reports, and pushed_at / applied_at
// markers stop duplicate pushes.

export interface DailyOptions {
  /** MYT date to run as. */
  today: string;
  /** Only this user (testing outside production). */
  userId?: string;
  send?: PushSender;
}

export interface UserResult {
  userId: string;
  pushes: number;
  warnings: number;
  weekly: string | null;
  monthly: string | null;
  budgetApplied: boolean;
  errors: string[];
}

export interface DailyResult {
  today: string;
  users: UserResult[];
  purgedReceipts: number;
  errors: string[];
}

interface Profile {
  id: string;
  monthly_budget: number | string;
  preferred_language: string;
}

async function step(errors: string[], name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    console.error(`cron ${name}`, error);
    errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * On the 1st (or the next two days if the cron missed it), sets last month's suggested budget as
 * the budget, remembering the one it replaces for the one-tap undo (D19). Once per report.
 */
async function applySuggestedBudget(
  client: SupabaseClient,
  profile: Profile,
  forMonth: string,
): Promise<{ budgetSen: number } | null> {
  const { data: report } = await client
    .from("audit_reports")
    .select("id, content")
    .eq("user_id", profile.id)
    .eq("dedup_key", `monthly:${shiftMonth(forMonth, -1)}`)
    .maybeSingle();
  const content = report?.content as AuditContent | undefined;
  if (!report || !content?.budget || content.budget.for_month !== forMonth || content.budget.applied_at) return null;

  const currentSen = numericToSen(profile.monthly_budget);
  const suggested = content.budget.suggested_budget_sen;
  const updated: AuditContent = {
    ...content,
    budget: { ...content.budget, previous_budget_sen: currentSen, applied_at: new Date().toISOString() },
  };
  // Mark first, so an overlapping run can't apply (and push) twice: only one update matches.
  const { data: marked, error } = await client
    .from("audit_reports")
    .update({ content: updated })
    .eq("id", report.id)
    .is("content->budget->>applied_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (!marked?.length) return null;

  const { error: budgetError } = await client
    .from("profiles")
    .update({ monthly_budget: senToNumeric(suggested) })
    .eq("id", profile.id);
  if (budgetError) throw new Error(budgetError.message);
  profile.monthly_budget = senToNumeric(suggested);
  return { budgetSen: suggested };
}

/**
 * Pushes this month's unread warnings that haven't been pushed yet, including ones raised in the
 * app during the day (F11-1), as one notification: the most severe. Each is pushed at most once.
 */
async function pushPendingWarnings(
  client: SupabaseClient,
  profile: Profile,
  today: string,
  push: (payload: PushPayload) => Promise<number>,
): Promise<number> {
  const { data: rows, error } = await client
    .from("audit_reports")
    .select("id, level, content, created_at")
    .eq("user_id", profile.id)
    .eq("type", "budget_warning")
    .eq("period_start", monthRangeMYT(today).start)
    .is("read_at", null)
    .is("content->>pushed_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!rows?.length) return 0;

  const pushedAt = new Date().toISOString();
  const claimed: typeof rows = [];
  for (const row of rows) {
    const { data } = await client
      .from("audit_reports")
      .update({ content: { ...(row.content as object), pushed_at: pushedAt } })
      .eq("id", row.id)
      .is("content->>pushed_at", null)
      .select("id");
    if (data?.length) claimed.push(row);
  }
  const [top] = claimed.map(toWarning).sort(bySeverity);
  if (!top) return 0;
  return push({
    title: messages(profile.preferred_language).push.warningTitle,
    body: top.message,
    url: "/",
    tag: "budget-warning",
  });
}

export async function runDailyJobs(client: SupabaseClient, options: DailyOptions): Promise<DailyResult> {
  const { today } = options;
  const send = options.send ?? defaultPushSender();
  const schedule = dailySchedule(today);
  const result: DailyResult = { today, users: [], purgedReceipts: 0, errors: [] };

  let query = client.from("profiles").select("id, monthly_budget, preferred_language").order("created_at");
  if (options.userId) query = query.eq("id", options.userId);
  const { data: profiles, error } = await query;
  if (error) throw new Error(`cron: profiles ${error.message}`);

  for (const profile of (profiles ?? []) as Profile[]) {
    const user: UserResult = {
      userId: profile.id,
      pushes: 0,
      warnings: 0,
      weekly: null,
      monthly: null,
      budgetApplied: false,
      errors: [],
    };
    const lang = Lang.catch("en").parse(profile.preferred_language);
    const t = messages(lang).push;
    const push = async (payload: PushPayload) => {
      const delivered = await sendPush(client, profile.id, payload, send);
      user.pushes += delivered;
      return delivered;
    };

    // 1. Audits due today (Sunday: the week; last day: the month). Reports first, so a
    //    back-filled monthly report can still be applied below.
    await Promise.all([
      schedule.weekly &&
        step(user.errors, "weekly", async () => {
          const audit = await generateAudit(client, profile.id, "weekly", schedule.weekly!, {
            lang,
            budgetSen: numericToSen(profile.monthly_budget),
          });
          if (!audit) return;
          user.weekly = audit.id;
          await push({ title: t.weeklyTitle, body: audit.content.headline, url: `/audit/${audit.id}`, tag: dedupKeyFor("weekly", schedule.weekly!) });
        }),
      schedule.monthly &&
        step(user.errors, "monthly", async () => {
          const audit = await generateAudit(client, profile.id, "monthly", schedule.monthly!, {
            lang,
            budgetSen: numericToSen(profile.monthly_budget),
          });
          if (!audit) return;
          user.monthly = audit.id;
          await push({ title: t.monthlyTitle, body: audit.content.headline, url: `/audit/${audit.id}`, tag: dedupKeyFor("monthly", schedule.monthly!) });
        }),
    ]);

    // 2. The 1st: last month's suggested budget becomes this month's.
    if (schedule.applyBudgetFor) {
      await step(user.errors, "budget", async () => {
        const applied = await applySuggestedBudget(client, profile, schedule.applyBudgetFor!);
        if (!applied) return;
        user.budgetApplied = true;
        await push({
          title: t.budgetAppliedTitle,
          body: t.budgetApplied(monthName(schedule.applyBudgetFor!, lang), applied.budgetSen),
          url: "/",
          tag: "budget-applied",
        });
      });
    }

    // 3. The Accounting Agent against today's figures, then one push for what's new (F11).
    await step(user.errors, "accounting", async () => {
      user.warnings = (await runAccountingCheck(client, profile.id, { today })).length;
      await pushPendingWarnings(client, profile, today, push);
    });

    result.users.push(user);
  }

  // 4. Storage sweep (D17): receipts older than a month and uploads never saved after 24 h, deleted
  //    through the Storage API; rows keep their data and show "Image expired". Once per run.
  if (!options.userId) {
    await step(result.errors, "receipts", async () => {
      result.purgedReceipts = await purgeReceipts(client);
    });
  }
  return result;
}

export async function purgeReceipts(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc("receipts_to_purge");
  if (error) throw new Error(error.message);
  const names = ((data ?? []) as { name: string }[]).map((r) => r.name);
  let purged = 0;
  for (let i = 0; i < names.length; i += 100) {
    const batch = names.slice(i, i + 100);
    const { error: removeError } = await client.storage.from(RECEIPTS_BUCKET).remove(batch);
    if (removeError) throw new Error(removeError.message);
    const { error: updateError } = await client
      .from("transactions")
      .update({ receipt_url: null })
      .in("receipt_url", batch);
    if (updateError) throw new Error(updateError.message);
    purged += batch.length;
  }
  return purged;
}
