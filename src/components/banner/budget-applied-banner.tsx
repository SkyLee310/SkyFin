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
      className="flex flex-col gap-2 p-3.5 border rounded-2xl shadow-sm bg-emerald-50 border-emerald-200 text-emerald-900"
    >
      <div className="flex items-start gap-2.5">
        <CalendarCheck className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden />
        <p className="flex-1 text-sm font-medium leading-snug">
          Your budget for {monthLabel} is now <strong>{formatRM(notice.budgetSen)}</strong>, from last month&apos;s
          review.
        </p>
        <button
          type="button"
          onClick={() => run(() => dismissBudgetApplied({ id: notice.reportId }))}
          disabled={pending}
          aria-label="Keep the new budget"
          className="-m-2 w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full opacity-60 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <button
        type="button"
        id="btn-undo-budget"
        disabled={pending}
        onClick={() => run(() => restorePreviousBudget({ id: notice.reportId }))}
        className="min-h-[44px] rounded-xl bg-white/80 border border-emerald-200 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        Undo — go back to {formatRM(notice.previousBudgetSen)}
      </button>
      {error && <p className="text-xs font-medium text-rose-700">{error}</p>}
    </div>
  );
}
