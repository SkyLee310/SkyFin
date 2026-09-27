"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Loader2, X } from "lucide-react";
import { dismissBudgetApplied, restorePreviousBudget } from "@/actions/audits";
import { formatRM } from "@/lib/money";
import type { BudgetAppliedNotice } from "@/lib/queries/shell";

/** On the 1st the monthly audit's suggested budget is applied; one tap puts the old one back (D19). */
export function BudgetAppliedBanner({ notice, monthLabel }: { notice: BudgetAppliedNotice; monthLabel: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) setError(res.message ?? "Something went wrong. Try again.");
    });

  return (
    <div
      id="budget-applied-banner"
      role="status"
      className="flex flex-col gap-3 rounded-[22px] bg-brand-soft p-4 text-ink shadow-card"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-surface text-brand">
          <CalendarCheck aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">New budget</p>
          <p className="mt-1 text-sm leading-snug font-medium">
            Your budget for {monthLabel} is now <strong className="font-bold">{formatRM(notice.budgetSen)}</strong>,
            from last month&apos;s review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => run(() => dismissBudgetApplied({ id: notice.reportId }))}
          disabled={pending}
          aria-label="Keep the new budget"
          className="-mt-1.5 -mr-1.5 flex size-11 flex-shrink-0 items-center justify-center rounded-full text-ink-muted"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <button
        type="button"
        id="btn-undo-budget"
        disabled={pending}
        onClick={() => run(() => restorePreviousBudget({ id: notice.reportId }))}
        className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-50"
      >
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Undo — go back to {formatRM(notice.previousBudgetSen)}
      </button>
      {error && (
        <p role="alert" className="px-1 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
