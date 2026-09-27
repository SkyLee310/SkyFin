import { formatRM } from "@/lib/money";
import { Calendar, ChevronRight, PencilLine, TrendingUp, Wallet } from "lucide-react";
import { BudgetStep } from "@/components/onboarding/budget-step";
import { Money } from "@/components/ui/money";

interface BudgetCardProps {
  budgetSen: number;
  spentSen: number;
  remainingSen: number;
  daysRemaining: number;
  /** "YYYY-MM" of the month shown. */
  month: string;
  /** Projected out-of-cash day of this month; null = "On track" (PRD §8.1). */
  outOfCashDay: number | null;
  exceeded: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function BudgetCard({
  budgetSen,
  spentSen,
  remainingSen,
  daysRemaining,
  month,
  outOfCashDay,
  exceeded,
}: BudgetCardProps) {
  const monthLabel = MONTHS[Number(month.slice(5, 7)) - 1] ?? "";
  const projection = exceeded
    ? { text: "Budget used up", tone: "bg-danger-soft text-danger" }
    : outOfCashDay !== null
      ? { text: `At this pace you run out on ${outOfCashDay} ${monthLabel}`, tone: "bg-caution-soft text-caution" }
      : { text: "On track", tone: "bg-brand-soft text-brand" };
  const percentUsed = budgetSen > 0 ? Math.min(100, Math.round((spentSen / budgetSen) * 100)) : 0;

  return (
    <BudgetStep
      currentBudgetSen={budgetSen}
      trigger={
        <button
          type="button"
          className="block w-full rounded-[22px] bg-surface p-5 text-left text-ink shadow-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              <span>Monthly Budget</span>
              {budgetSen > 0 && <PencilLine aria-hidden className="size-3.5 text-ink-subtle" />}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink-muted">
              <Calendar aria-hidden className="size-3.5" />
              <span>{daysRemaining} days left</span>
            </div>
          </div>

          {budgetSen === 0 ? (
            <div className="mt-4 flex items-center gap-3">
              <span className="flex size-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Wallet aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold tracking-tight">Set your monthly budget</p>
                <p className="mt-0.5 text-sm text-ink-muted">Tap to enter an amount and track your burn rate.</p>
              </div>
              <ChevronRight aria-hidden className="size-5 flex-shrink-0 text-ink-subtle" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <Money
                  id="dashboard-remaining-rm"
                  sen={remainingSen}
                  className="text-[2.75rem] leading-none font-bold tracking-tight"
                />
                <span className="text-sm font-medium text-ink-muted">left</span>
              </div>

              <p className="mt-2 text-sm text-ink-muted">
                Spent {formatRM(spentSen)} of {formatRM(budgetSen)}
              </p>

              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    percentUsed > 85 ? "bg-danger" : percentUsed > 60 ? "bg-caution" : "bg-brand"
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p
                  id="budget-projection"
                  className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${projection.tone}`}
                >
                  <TrendingUp className="size-3.5 flex-shrink-0" aria-hidden />
                  {projection.text}
                </p>
                <span className="text-xs font-semibold text-ink-muted tabular-nums">{percentUsed}% used</span>
              </div>
            </>
          )}
        </button>
      }
    />
  );
}
