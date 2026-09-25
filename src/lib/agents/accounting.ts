import type { SupabaseClient } from "@supabase/supabase-js";
import { monthRangeMYT, todayMYT } from "@/lib/dates";
import { messages } from "@/lib/i18n";
import { numericToSen } from "@/lib/money";

// Accounting Agent (PRD §8.1): deterministic arithmetic, so warnings are instant and never
// hallucinated. evaluatePace is pure; runAccountingCheck loads its inputs and stores what fires.

export type WarningLevel = "info" | "warning" | "critical" | "spike";

export interface NewExpense {
  id: string;
  amountSen: number;
  /** Merchant or item label, for the spike message. */
  where: string | null;
}

export interface PaceInput {
  /** B */
  budgetSen: number;
  /** S: every expense dated this month so far. */
  spentSen: number;
  /** S − S′: the part of S marked "one-off" (exclude_from_pace, D16). */
  spentExcludedSen: number;
  /** Today's MYT date; gives d, D and the dedup keys. */
  today: string;
  /** Expenses just saved or edited; one of ≥ 20% of B is a spike. */
  newExpenses?: NewExpense[];
}

export type WarningCandidate =
  | { kind: "threshold"; level: "info" | "warning" | "critical"; threshold: 50 | 80 | 100; dedupKey: string }
  | { kind: "pace"; level: "warning" | "critical"; dedupKey: string }
  | { kind: "spike"; level: "spike"; dedupKey: string; transactionId: string; amountSen: number; pct: number; where: string | null };

export interface PaceResult {
  /** S′ ÷ (B × d ÷ D); null when B = 0. */
  pace: number | null;
  /** S′ ÷ d × D + (S − S′), in sen; null when B = 0. */
  projectedSpendSen: number | null;
  /** First day projected cumulative spend reaches B; null when that is after month end ("On track"). */
  outOfCashDay: number | null;
  /** S ≥ B. */
  exceeded: boolean;
  /** Everything that fires now, most severe first. Dedup keys decide what is actually new. */
  warnings: WarningCandidate[];
}

const SEVERITY: Record<WarningLevel, number> = { spike: 0, critical: 1, warning: 2, info: 3 };

export function bySeverity<T extends { level: WarningLevel }>(a: T, b: T): number {
  return SEVERITY[a.level] - SEVERITY[b.level];
}

export function evaluatePace(input: PaceInput): PaceResult {
  const { budgetSen: B, spentSen: S, spentExcludedSen: excluded, today } = input;
  const { day: d, daysInMonth: D } = monthRangeMYT(today);
  const month = today.slice(0, 7);

  // B = 0: nothing to measure against, and no warnings (F2-2).
  if (B <= 0) return { pace: null, projectedSpendSen: null, outOfCashDay: null, exceeded: false, warnings: [] };

  const paced = S - excluded; // S′
  const exceeded = S >= B;
  const pace = (paced * D) / (B * d);
  const projectedSpendSen = Math.round((paced * D) / d) + excluded;

  // Projected cumulative spend on day x is S′ × x ÷ d + (S − S′); solve for the first x ≥ B.
  let outOfCashDay: number | null;
  if (exceeded) outOfCashDay = d;
  else if (paced <= 0) outOfCashDay = null;
  else {
    const x = Math.ceil(((B - excluded) * d) / paced);
    outOfCashDay = x <= D ? x : null;
  }

  const warnings: WarningCandidate[] = [];

  // Threshold crossings, each once a month (the dedup key carries the month). All crossed
  // levels are recorded, so an edit that dips below 50% can't fire "half used" after "80%".
  for (const [threshold, level] of [
    [100, "critical"],
    [80, "warning"],
    [50, "info"],
  ] as const) {
    if (S * 100 >= threshold * B) {
      warnings.push({ kind: "threshold", level, threshold, dedupKey: `threshold:${threshold}:${month}` });
    }
  }

  // Pace, each level once a day; quiet on days 1–2 unless 30% is already gone. Integer
  // comparisons, so 1.15 and 1.30 are exact boundaries.
  const suppressed = d < 3 && S * 100 < 30 * B;
  if (!suppressed && paced > 0) {
    if (paced * D * 100 >= 130 * B * d) {
      warnings.push({ kind: "pace", level: "critical", dedupKey: `pace:critical:${today}` });
    } else if (paced * D * 100 >= 115 * B * d) {
      warnings.push({ kind: "pace", level: "warning", dedupKey: `pace:warning:${today}` });
    }
  }

  for (const expense of input.newExpenses ?? []) {
    if (expense.amountSen * 100 >= 20 * B) {
      warnings.push({
        kind: "spike",
        level: "spike",
        dedupKey: `spike:${expense.id}`,
        transactionId: expense.id,
        amountSen: expense.amountSen,
        pct: Math.round((expense.amountSen * 100) / B),
        where: expense.where,
      });
    }
  }

  warnings.sort(bySeverity);
  return { pace, projectedSpendSen, outOfCashDay, exceeded, warnings };
}

/** The template text for one warning, in the profile's language (PRD §8.1). */
export function warningMessage(
  warning: WarningCandidate,
  result: PaceResult,
  input: Pick<PaceInput, "budgetSen" | "spentSen" | "today">,
  lang: string | null | undefined,
): string {
  const t = messages(lang).warning;
  const { day, daysInMonth } = monthRangeMYT(input.today);
  const daysLeft = daysInMonth - day + 1;
  const overOrUsedUp = () =>
    input.spentSen > input.budgetSen ? t.exceeded(input.spentSen - input.budgetSen) : t.usedUp(input.budgetSen);

  switch (warning.kind) {
    case "spike":
      return t.spike(warning.amountSen, warning.where, warning.pct);
    case "threshold":
      if (warning.threshold === 50) return t.half(input.budgetSen, daysLeft);
      if (warning.threshold === 80) return t.eighty(input.budgetSen, daysLeft);
      return overOrUsedUp();
    case "pace":
      if (result.exceeded || result.outOfCashDay === null || result.pace === null) return overOrUsedUp();
      return t.pace(Math.round((result.pace - 1) * 100), result.outOfCashDay);
  }
}

/** A stored budget_warning, as the banner and the actions' results see it. */
export interface Warning {
  id: string;
  level: WarningLevel;
  message: string;
  /** Set on a spike: the expense the "one-off?" question is about. */
  transactionId: string | null;
}

export interface WarningContent {
  kind: WarningCandidate["kind"];
  message: string;
  lang: string;
  transaction_id?: string;
  threshold?: number;
}

export function toWarning(row: { id: string; level: string | null; content: unknown }): Warning {
  const content = (row.content ?? {}) as Partial<WarningContent>;
  return {
    id: row.id,
    level: (row.level ?? "info") as WarningLevel,
    message: content.message ?? "",
    transactionId: content.transaction_id ?? null,
  };
}

/**
 * Loads this month's inputs, runs evaluatePace and stores every warning that fires as a
 * budget_warning. The (user_id, dedup_key) unique key makes repeats a no-op, so only warnings
 * that are new come back, most severe first. Works with the session client (after a save) and
 * the admin client (daily cron).
 */
export async function runAccountingCheck(
  client: SupabaseClient,
  userId: string,
  { today = todayMYT(), newExpenseIds = [] }: { today?: string; newExpenseIds?: string[] } = {},
): Promise<Warning[]> {
  const range = monthRangeMYT(today);
  const [{ data: profile, error: profileError }, { data: rows, error: rowsError }] = await Promise.all([
    client.from("profiles").select("monthly_budget, preferred_language").eq("id", userId).single(),
    client
      .from("transactions")
      .select("id, amount, exclude_from_pace, merchant, item_label")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("date", range.start)
      .lte("date", today),
  ]);
  if (profileError || !profile) throw new Error(`accounting: profile ${profileError?.message ?? "missing"}`);
  if (rowsError || !rows) throw new Error(`accounting: transactions ${rowsError?.message}`);

  let spentSen = 0;
  let spentExcludedSen = 0;
  const newExpenses: NewExpense[] = [];
  for (const row of rows) {
    const sen = numericToSen(row.amount);
    spentSen += sen;
    if (row.exclude_from_pace) spentExcludedSen += sen;
    else if (newExpenseIds.includes(row.id)) {
      newExpenses.push({ id: row.id, amountSen: sen, where: row.merchant ?? row.item_label ?? null });
    }
  }

  const input: PaceInput = {
    budgetSen: numericToSen(profile.monthly_budget),
    spentSen,
    spentExcludedSen,
    today,
    newExpenses,
  };
  const result = evaluatePace(input);
  if (result.warnings.length === 0) return [];

  const lang = profile.preferred_language;
  const { data: inserted, error } = await client
    .from("audit_reports")
    .upsert(
      result.warnings.map((w) => ({
        user_id: userId,
        type: "budget_warning",
        level: w.level,
        period_start: range.start,
        period_end: range.end,
        dedup_key: w.dedupKey,
        content: {
          kind: w.kind,
          message: warningMessage(w, result, input, lang),
          lang,
          ...(w.kind === "spike" ? { transaction_id: w.transactionId } : {}),
          ...(w.kind === "threshold" ? { threshold: w.threshold } : {}),
        } satisfies WarningContent,
      })),
      // ON CONFLICT DO NOTHING: an existing dedup_key means "already warned", and only the
      // rows actually inserted are returned.
      { onConflict: "user_id,dedup_key", ignoreDuplicates: true },
    )
    .select("id, level, content");
  if (error) throw new Error(`accounting: insert ${error.message}`);

  return (inserted ?? []).map(toWarning).sort(bySeverity);
}
