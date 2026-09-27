import React from "react";
import { formatRM } from "@/lib/money";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Money } from "@/components/ui/money";

interface NetFlowCardProps {
  incomeSen: number;
  expenseSen: number;
  netSen: number;
}

export function NetFlowCard({ incomeSen, expenseSen, netSen }: NetFlowCardProps) {
  const isNetPositive = netSen >= 0;

  return (
    <section className="rounded-[22px] bg-surface p-5 text-ink shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Net Cash Flow</h3>
        <p className="text-xs text-ink-muted">Current calendar month</p>
      </div>

      <Money
        id="dashboard-net-cash-flow"
        sen={netSen}
        className={`mt-2 block text-[2rem] leading-tight font-bold tracking-tight ${isNetPositive ? "text-brand" : "text-ink"}`}
      />

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-sunken p-3">
          <div className="flex items-center gap-1.5">
            <ArrowDownRight aria-hidden className="size-4 text-brand" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Income</span>
          </div>
          <span id="dashboard-income-total" className="mt-1 block text-base font-bold tabular-nums">
            {formatRM(incomeSen)}
          </span>
        </div>

        <div className="rounded-2xl bg-sunken p-3">
          <div className="flex items-center gap-1.5">
            <ArrowUpRight aria-hidden className="size-4 text-danger" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Expenses</span>
          </div>
          <span id="dashboard-expense-total" className="mt-1 block text-base font-bold tabular-nums">
            {formatRM(expenseSen)}
          </span>
        </div>
      </div>
    </section>
  );
}
