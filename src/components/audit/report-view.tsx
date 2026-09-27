import { Lightbulb, Repeat, Sparkles, Wallet } from "lucide-react";
import { type AuditContent, totalChangeSen } from "@/lib/agents/audit-content";
import { formatRM } from "@/lib/money";
import { StackedBar } from "@/components/dashboard/stacked-bar";
import { SERIES } from "@/components/dashboard/chart-colors";
import { formatMonth, formatPeriod } from "./format";

/**
 * One weekly or monthly audit (PRD §8.2). Every RM figure comes from content.stats, the tips'
 * saving_sen or content.budget, all computed before the model ran; the model's words are shown
 * as written. tests/unit/report-view.test.tsx checks each figure against the stats (M7.9).
 * Figures stay plain formatRM text (not <Money>): that test reads the markup with tags as spaces.
 */
export function ReportView({ content }: { content: AuditContent }) {
  const { stats } = content;
  const previousLabel = content.kind === "weekly" ? "last week" : "last month";
  const change = totalChangeSen(stats);
  const needsPct = stats.wants_pct === null ? 0 : 100 - stats.wants_pct;

  return (
    <article id="audit-report" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5 px-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-brand">
          <Sparkles aria-hidden className="size-3.5 flex-shrink-0" />
          {content.kind === "weekly" ? "Weekly audit" : "Monthly review"} · {formatPeriod(content.period.start, content.period.end)}
        </p>
        <h2 id="report-headline" className="text-[1.375rem] leading-snug font-bold tracking-tight text-ink">
          {content.headline}
        </h2>
      </header>

      <section className="flex flex-col gap-3 rounded-[22px] bg-surface p-5 text-ink shadow-card">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Spent</h3>
          <span id="report-total" className="mt-2 block text-[2.25rem] leading-none font-bold tracking-tight tabular-nums">
            {formatRM(stats.total_sen)}
          </span>
        </div>
        {stats.previous && change !== null && (
          <p id="report-change" className="text-sm text-ink-muted">
            {change === 0
              ? `Same as ${previousLabel}`
              : `${formatRM(Math.abs(change))} ${change > 0 ? "more" : "less"} than ${previousLabel}`}
            {stats.previous.wants_pct !== null && stats.wants_pct !== null
              ? ` · Wants ${stats.wants_pct}% (${previousLabel} ${stats.previous.wants_pct}%)`
              : ""}
          </p>
        )}
        <StackedBar
          id="report-needs-wants"
          segments={[
            { key: "needs", label: "Needs", sen: stats.needs_sen, pct: needsPct, color: SERIES[0] },
            { key: "wants", label: "Wants", sen: stats.wants_sen, pct: stats.wants_pct ?? 0, color: SERIES[1] },
          ]}
        />
      </section>

      <section className="rounded-[22px] bg-surface p-5 text-ink shadow-card">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Top categories</h3>
        <ol id="report-top-categories" className="mt-1 flex flex-col divide-y divide-line">
          {stats.top_categories.map((c) => (
            <li key={c.name} className="flex flex-col gap-2 py-3 last:pb-0">
              <div className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                <span className="text-xs font-semibold text-ink-muted tabular-nums">{c.pct}%</span>
                <span className="w-24 text-right font-semibold tabular-nums">{formatRM(c.sen)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, c.pct))}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {stats.micro_expenses.length > 0 && (
        <section className="rounded-[22px] bg-caution-soft p-5 text-ink">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-caution">
            <Repeat aria-hidden className="size-3.5" /> Small buys that add up
          </h3>
          <ul id="report-micro" className="mt-3 flex flex-col gap-2">
            {stats.micro_expenses.map((m) => (
              <li key={m.label} data-testid="micro-expense" className="text-sm leading-relaxed">
                <span className="font-semibold capitalize">{m.label}</span> {m.count}× = {formatRM(m.total_sen)},{" "}
                <span className="font-semibold whitespace-nowrap text-caution">≈ {formatRM(m.monthly_sen)}/month</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h3 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          <Lightbulb aria-hidden className="size-3.5" /> 3 things to try
        </h3>
        <ol id="report-tips" className="flex flex-col gap-2.5">
          {content.tips.map((tip, i) => (
            <li key={i} data-testid="audit-tip" className="rounded-[22px] bg-surface p-4 text-ink shadow-card">
              <p className="text-sm font-bold">
                {i + 1}. {tip.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{tip.detail}</p>
              <p className="mt-3 w-fit rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                Could save ≈ {formatRM(tip.saving_sen)}/month
              </p>
            </li>
          ))}
        </ol>
      </section>

      {content.budget && (
        <section id="report-budget" className="flex flex-col gap-1 rounded-[22px] bg-nav p-5 text-nav-foreground shadow-card">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-nav-muted">
            <Wallet aria-hidden className="size-3.5" /> Budget for {formatMonth(content.budget.for_month)}
          </h3>
          <p className="mt-1 text-[1.75rem] leading-tight font-bold tracking-tight tabular-nums">
            {formatRM(content.budget.suggested_budget_sen)}
          </p>
          <p className="text-sm text-nav-muted">
            {content.budget.undone_at
              ? `You kept ${formatRM(content.budget.previous_budget_sen)} instead.`
              : content.budget.applied_at
                ? `Applied on the 1st; it replaced ${formatRM(content.budget.previous_budget_sen)}.`
                : `Applied automatically on the 1st, replacing ${formatRM(content.budget.previous_budget_sen)}. You can undo it then.`}
          </p>
        </section>
      )}

      <p className="px-1 text-xs text-ink-muted">
        {content.source === "ai"
          ? "Words by AI; every figure computed by SkyFin from your entries."
          : "Figures computed by SkyFin from your entries."}
      </p>
    </article>
  );
}
