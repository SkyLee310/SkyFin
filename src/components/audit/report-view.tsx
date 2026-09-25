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
 */
export function ReportView({ content }: { content: AuditContent }) {
  const { stats } = content;
  const previousLabel = content.kind === "weekly" ? "last week" : "last month";
  const change = totalChangeSen(stats);
  const needsPct = stats.wants_pct === null ? 0 : 100 - stats.wants_pct;

  return (
    <article id="audit-report" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          {content.kind === "weekly" ? "Weekly audit" : "Monthly review"} · {formatPeriod(content.period.start, content.period.end)}
        </p>
        <h2 id="report-headline" className="text-lg font-bold text-slate-900 leading-snug">
          {content.headline}
        </h2>
      </header>

      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Spent</h3>
          <span id="report-total" className="text-2xl font-extrabold text-slate-900">
            {formatRM(stats.total_sen)}
          </span>
        </div>
        {stats.previous && change !== null && (
          <p id="report-change" className="text-xs text-slate-500">
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

      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Top categories</h3>
        <ol id="report-top-categories" className="flex flex-col divide-y divide-slate-100">
          {stats.top_categories.map((c) => (
            <li key={c.name} className="flex items-center gap-2 min-h-[40px] text-sm">
              <span className="flex-1 text-slate-700">{c.name}</span>
              <span className="text-xs text-slate-400">{c.pct}%</span>
              <span className="w-24 text-right font-semibold text-slate-900 tabular-nums">{formatRM(c.sen)}</span>
            </li>
          ))}
        </ol>
      </section>

      {stats.micro_expenses.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
          <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" aria-hidden /> Small buys that add up
          </h3>
          <ul id="report-micro" className="flex flex-col gap-2">
            {stats.micro_expenses.map((m) => (
              <li key={m.label} data-testid="micro-expense" className="text-sm text-amber-950">
                <span className="font-semibold capitalize">{m.label}</span> {m.count}× = {formatRM(m.total_sen)},{" "}
                <span className="whitespace-nowrap">≈ {formatRM(m.monthly_sen)}/month</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" aria-hidden /> 3 things to try
        </h3>
        <ol id="report-tips" className="flex flex-col gap-2">
          {content.tips.map((tip, i) => (
            <li key={i} data-testid="audit-tip" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">
                {i + 1}. {tip.title}
              </p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{tip.detail}</p>
              <p className="text-xs font-semibold text-emerald-700 mt-2">Could save ≈ {formatRM(tip.saving_sen)}/month</p>
            </li>
          ))}
        </ol>
      </section>

      {content.budget && (
        <section id="report-budget" className="bg-slate-900 text-white rounded-3xl p-5 flex flex-col gap-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" aria-hidden /> Budget for {formatMonth(content.budget.for_month)}
          </h3>
          <p className="text-xl font-extrabold">{formatRM(content.budget.suggested_budget_sen)}</p>
          <p className="text-xs text-slate-400">
            {content.budget.undone_at
              ? `You kept ${formatRM(content.budget.previous_budget_sen)} instead.`
              : content.budget.applied_at
                ? `Applied on the 1st; it replaced ${formatRM(content.budget.previous_budget_sen)}.`
                : `Applied automatically on the 1st, replacing ${formatRM(content.budget.previous_budget_sen)}. You can undo it then.`}
          </p>
        </section>
      )}

      <p className="text-[11px] text-slate-400">
        {content.source === "ai"
          ? "Words by AI; every figure computed by SkyFin from your entries."
          : "Figures computed by SkyFin from your entries."}
      </p>
    </article>
  );
}
