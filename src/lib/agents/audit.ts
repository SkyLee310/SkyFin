import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditText, type AuditText } from "@/lib/ai/audit";
import { addDaysMYT, daysBetweenMYT, monthRangeMYT, shiftMonth } from "@/lib/dates";
import { messages } from "@/lib/i18n";
import { formatRM, numericToSen } from "@/lib/money";
import { loadPeriodRows } from "@/lib/queries/stats";
import { microExpenses, summarizeExpenses, type StatRow } from "@/lib/stats";
import type { Lang } from "@/lib/validation/schemas";
import { type AuditContent, type AuditStats, reportFigures, rmAmountsIn } from "./audit-content";

// Audit Agent (PRD §8.2): SQL rows → stats → saving options → Gemini writes the words → Zod and a
// figure check → stored with a dedup_key, so a repeated cron run never makes a second report.

export type AuditKind = "weekly" | "monthly";

export interface SavingOption {
  id: string;
  kind: "micro" | "wants" | "category" | "no-spend" | "check";
  label: string;
  /** Estimated monthly saving, computed here, shown beside the tip. */
  savingSen: number;
}

export function dedupKeyFor(kind: AuditKind, period: { start: string }): string {
  return kind === "weekly" ? `weekly:${period.start}` : `monthly:${period.start.slice(0, 7)}`;
}

/** The same-length period just before this one: the week before, or the month before. */
export function previousPeriod(kind: AuditKind, period: { start: string; end: string }) {
  if (kind === "weekly") return { start: addDaysMYT(period.start, -7), end: addDaysMYT(period.end, -7) };
  const range = monthRangeMYT(`${shiftMonth(period.start.slice(0, 7), -1)}-01`);
  return { start: range.start, end: range.end };
}

export function buildAuditStats(rows: StatRow[], previousRows: StatRow[], periodDays: number): AuditStats {
  const summary = summarizeExpenses(rows);
  const previous = summarizeExpenses(previousRows);
  return {
    count: summary.count,
    total_sen: summary.totalSen,
    needs_sen: summary.needsSen,
    wants_sen: summary.wantsSen,
    wants_pct: summary.wantsPct,
    top_categories: summary.byCategory.slice(0, 3).map((c) => ({ name: c.name, sen: c.sen, pct: c.pct })),
    micro_expenses: microExpenses(rows, periodDays).map((m) => ({
      label: m.label,
      count: m.count,
      total_sen: m.totalSen,
      monthly_sen: m.monthlySen,
    })),
    previous: previous.count > 0 ? { total_sen: previous.totalSen, wants_pct: previous.wantsPct } : null,
  };
}

/**
 * What each tip can be about, with its estimated monthly saving: halve a micro-expense, cut a
 * wants category by 30%, trim a top category by 10%, or a no-spend day (5%) / pause-before-paying
 * (3%) on everything. Most specific first; the stats-only report uses the first three.
 */
export function savingOptions(rows: StatRow[], stats: AuditStats, periodDays: number): SavingOption[] {
  const monthly = (sen: number) => Math.round((sen * 30) / periodDays);
  const options: SavingOption[] = [];

  stats.micro_expenses.slice(0, 3).forEach((m, i) =>
    options.push({ id: `micro:${i}`, kind: "micro", label: m.label, savingSen: Math.round(m.monthly_sen / 2) }),
  );

  const wants = summarizeExpenses(rows.filter((r) => r.type === "expense" && !r.is_essential)).byCategory;
  for (const c of wants.slice(0, 2)) {
    options.push({ id: `wants:${c.categoryId}`, kind: "wants", label: c.name, savingSen: Math.round(monthly(c.sen) * 0.3) });
  }
  const all = summarizeExpenses(rows).byCategory;
  for (const c of all.slice(0, 3)) {
    if (options.some((o) => o.id === `wants:${c.categoryId}`)) continue;
    options.push({ id: `category:${c.categoryId}`, kind: "category", label: c.name, savingSen: Math.round(monthly(c.sen) * 0.1) });
  }
  options.push({ id: "no-spend", kind: "no-spend", label: "no-spend day", savingSen: Math.round(monthly(stats.total_sen) * 0.05) });
  options.push({ id: "check", kind: "check", label: "pause before paying", savingSen: Math.round(monthly(stats.total_sen) * 0.03) });

  return options.filter((o) => o.savingSen > 0);
}

/**
 * Next month's budget from this month (F13): Needs plus 90% of Wants, rounded up to RM 10, and
 * kept within 80–120% of the current budget so one odd month can't swing it wildly.
 */
export function suggestBudget(needsSen: number, wantsSen: number, budgetSen: number): number {
  const up10 = (sen: number) => Math.ceil(sen / 1000) * 1000;
  let suggested = up10(needsSen + Math.round(wantsSen * 0.9));
  if (budgetSen > 0) {
    suggested = Math.min(Math.max(suggested, up10(budgetSen * 0.8)), up10(budgetSen * 1.2));
  }
  return Math.max(suggested, 1000);
}

/** Template headline and tips for when the model's answer can't be used (TECH_SPEC §5.4). */
export function fallbackText(options: SavingOption[], stats: AuditStats, lang: Lang): AuditText {
  const t = messages(lang).audit;
  return {
    headline: t.headline(stats.total_sen, stats.wants_pct ?? 0),
    tips: options.slice(0, 3).map((o) => {
      const text =
        o.kind === "micro"
          ? t.tipMicro(o.label)
          : o.kind === "wants" || o.kind === "category"
            ? t.tipCategory(o.label)
            : o.kind === "no-spend"
              ? t.tipOverall()
              : t.tipCheck();
      return { optionId: o.id, ...text };
    }),
  };
}

export interface GeneratedAudit {
  id: string;
  content: AuditContent;
}

/**
 * Generates and stores one weekly or monthly audit. Returns null when there's nothing new: the
 * report already exists (checked before the paid call) or the period had no expenses.
 */
export async function generateAudit(
  client: SupabaseClient,
  userId: string,
  kind: AuditKind,
  period: { start: string; end: string },
  { lang, budgetSen }: { lang: Lang; budgetSen: number },
): Promise<GeneratedAudit | null> {
  const dedupKey = dedupKeyFor(kind, period);
  const { data: existing } = await client
    .from("audit_reports")
    .select("id")
    .eq("user_id", userId)
    .eq("dedup_key", dedupKey)
    .maybeSingle();
  if (existing) return null;

  const previous = previousPeriod(kind, period);
  const [rows, previousRows] = await Promise.all([
    loadPeriodRows(client, userId, period.start, period.end),
    loadPeriodRows(client, userId, previous.start, previous.end),
  ]);
  if (!rows.some((r) => r.type === "expense")) return null;

  const periodDays = daysBetweenMYT(period.start, period.end) + 1;
  const stats = buildAuditStats(rows, previousRows, periodDays);
  const options = savingOptions(rows, stats, periodDays);
  const budget =
    kind === "monthly"
      ? {
          suggested_budget_sen: suggestBudget(stats.needs_sen, stats.wants_sen, budgetSen),
          previous_budget_sen: budgetSen,
          for_month: shiftMonth(period.start.slice(0, 7), 1),
        }
      : undefined;

  // The model may only repeat figures the report shows.
  const draft: AuditContent = {
    version: 1,
    kind,
    language: lang,
    source: "stats",
    period,
    headline: "",
    stats,
    tips: options.map((o) => ({ title: "", detail: "", saving_sen: o.savingSen })),
    ...(budget ? { budget } : {}),
  };
  const allowed = reportFigures(draft);

  const aiText = await writeAuditText(
    {
      language: lang,
      kind,
      period,
      stats: {
        total: formatRM(stats.total_sen),
        needs: formatRM(stats.needs_sen),
        wants: formatRM(stats.wants_sen),
        wants_pct: stats.wants_pct,
        top_categories: stats.top_categories.map((c) => ({ name: c.name, total: formatRM(c.sen), pct: c.pct })),
        micro_expenses: stats.micro_expenses.map((m) => ({
          label: m.label,
          count: m.count,
          total: formatRM(m.total_sen),
          monthly: formatRM(m.monthly_sen),
        })),
        previous_period: stats.previous
          ? { total: formatRM(stats.previous.total_sen), wants_pct: stats.previous.wants_pct }
          : null,
      },
      options: options.map((o) => ({ id: o.id, kind: o.kind, label: o.label, monthly_saving: formatRM(o.savingSen) })),
      rows: rows
        .filter((r) => r.type === "expense")
        .slice(0, 200)
        .map((r) => ({
          date: r.date,
          amount: formatRM(numericToSen(r.amount)),
          category: r.category_name,
          label: r.merchant ?? r.item_label ?? null,
          needs: r.is_essential,
        })),
    },
    allowed,
  );
  const savingOf = (id: string) => options.find((o) => o.id === id)?.savingSen ?? 0;
  const compose = (text: AuditText, source: AuditContent["source"]): AuditContent => ({
    ...draft,
    source,
    headline: text.headline,
    tips: text.tips.map((t) => ({ title: t.title, detail: t.detail, saving_sen: savingOf(t.optionId) })),
  });

  // Final check against the figures this report actually shows (M7.9): any RM amount in the
  // model's words must be one of them, or the stats-only text is used instead.
  let content = aiText ? compose(aiText, "ai") : null;
  if (content) {
    const shown = reportFigures(content);
    const words = [content.headline, ...content.tips.flatMap((t) => [t.title, t.detail])].join("\n");
    if (rmAmountsIn(words).some((amount) => !shown.has(amount))) content = null;
  }
  content ??= compose(fallbackText(options, stats, lang), "stats");

  const { data: inserted, error } = await client
    .from("audit_reports")
    .upsert(
      {
        user_id: userId,
        type: kind === "weekly" ? "weekly_audit" : "monthly_audit",
        period_start: period.start,
        period_end: period.end,
        dedup_key: dedupKey,
        content,
      },
      { onConflict: "user_id,dedup_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`audit: insert ${error.message}`);
  const id = inserted?.[0]?.id as string | undefined;
  return id ? { id, content } : null;
}
