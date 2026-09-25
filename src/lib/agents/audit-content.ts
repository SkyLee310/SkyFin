import { formatRM } from "@/lib/money";
import type { Lang } from "@/lib/validation/schemas";

// The jsonb stored in audit_reports.content for weekly and monthly audits (PRD §8.2). Every
// figure is computed before the model is called; the model only supplies headline and tip text.

export interface AuditTip {
  title: string;
  detail: string;
  /** Estimated monthly saving, from the saving option the tip was written for. */
  saving_sen: number;
}

export interface AuditStats {
  count: number;
  total_sen: number;
  needs_sen: number;
  wants_sen: number;
  wants_pct: number | null;
  top_categories: { name: string; sen: number; pct: number }[];
  micro_expenses: { label: string; count: number; total_sen: number; monthly_sen: number }[];
  /** The period before, for the change line; null when it had no expenses. */
  previous: { total_sen: number; wants_pct: number | null } | null;
}

export interface AuditBudget {
  suggested_budget_sen: number;
  /** The budget in place before the suggestion was applied; restorePreviousBudget puts it back. */
  previous_budget_sen: number;
  /** "YYYY-MM" the suggestion is for (the month after the report). */
  for_month: string;
  applied_at?: string;
  undone_at?: string;
  dismissed_at?: string;
}

export interface AuditContent {
  version: 1;
  kind: "weekly" | "monthly";
  language: Lang;
  /** "ai" when the model wrote the words, "stats" for the template fallback. */
  source: "ai" | "stats";
  period: { start: string; end: string };
  headline: string;
  stats: AuditStats;
  /** Exactly 3. */
  tips: AuditTip[];
  /** Monthly only. */
  budget?: AuditBudget;
}

/** Signed change from the previous period, or null without one. */
export function totalChangeSen(stats: AuditStats): number | null {
  return stats.previous ? stats.total_sen - stats.previous.total_sen : null;
}

/**
 * Every RM figure a report may show, formatted as the UI formats it. The audit's text check and
 * the M7.9 test both hold rendered reports to this set.
 */
export function reportFigures(content: AuditContent): Set<string> {
  const { stats } = content;
  const sen = [
    stats.total_sen,
    stats.needs_sen,
    stats.wants_sen,
    ...stats.top_categories.map((c) => c.sen),
    ...stats.micro_expenses.flatMap((m) => [m.total_sen, m.monthly_sen]),
    ...(stats.previous ? [stats.previous.total_sen] : []),
    ...content.tips.map((t) => t.saving_sen),
    ...(content.budget ? [content.budget.suggested_budget_sen, content.budget.previous_budget_sen] : []),
  ];
  const change = totalChangeSen(stats);
  if (change !== null) sen.push(Math.abs(change));
  return new Set(sen.map((s) => formatRM(s)));
}

/** "RM 1,234.50"-style amounts in a piece of text, normalised to formatRM's spacing. */
export function rmAmountsIn(text: string): string[] {
  return [...text.matchAll(/RM\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?/gi)].map((m) => {
    const ringgit = m[1]!.replaceAll(",", "");
    const sen = Number(ringgit) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
    return formatRM(sen);
  });
}
