import React from "react";
import { getDashboard } from "@/lib/queries/dashboard";
import { BudgetCard } from "@/components/dashboard/budget-card";
import { NetFlowCard } from "@/components/dashboard/net-flow-card";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { PaymentBar } from "@/components/dashboard/payment-bar";
import { NeedsWantsBar } from "@/components/dashboard/needs-wants-bar";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { monthName } from "@/lib/i18n";
import Link from "next/link";
import { ChevronRight, Plus, ReceiptText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboard();

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Top Header */}
      <header className="flex items-center justify-between gap-3 pt-2 pb-1">
        <div>
          <h1 className="text-[1.625rem] font-bold tracking-tight text-ink">SkyFin</h1>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Overview · {monthName(data.month, "en")}
          </p>
        </div>

        <Link
          href="/chat"
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground shadow-card"
        >
          <Plus aria-hidden className="size-4" strokeWidth={2.5} />
          <span>Log</span>
        </Link>
      </header>

      {/* First run: Add to Home Screen, then notifications (F15), once the budget is set. */}
      {data.budgetSen > 0 && <OnboardingSteps />}

      {/* 1. Monthly Budget Card */}
      <BudgetCard
        budgetSen={data.budgetSen}
        spentSen={data.spentSen}
        remainingSen={data.remainingSen}
        daysRemaining={data.daysRemaining}
        month={data.month}
        outOfCashDay={data.pace.outOfCashDay}
        exceeded={data.pace.exceeded}
      />

      {/* 2. Net Cash Flow Card */}
      <NetFlowCard
        incomeSen={data.cashFlow.incomeSen}
        expenseSen={data.cashFlow.expenseSen}
        netSen={data.cashFlow.netSen}
      />

      {/* 3–5. Breakdowns; every figure is summed in sen from this month's rows (F9-1). */}
      <CategoryDonut categories={data.expenses.byCategory} totalSen={data.expenses.totalSen} month={data.month} />
      {data.expenses.totalSen > 0 && (
        <>
          <PaymentBar payments={data.expenses.byPayment} />
          <NeedsWantsBar
            needsSen={data.expenses.needsSen}
            wantsSen={data.expenses.wantsSen}
            lastMonthWantsPct={data.lastMonthWantsPct}
          />
        </>
      )}

      {/* Quick access to History. Its name leaves out "History" so the tab bar's link stays the only match. */}
      <Link
        href="/history"
        className="flex min-h-16 items-center gap-3 rounded-[22px] bg-surface p-4 text-ink shadow-card"
      >
        <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-sunken text-ink-muted">
          <ReceiptText aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Recent spending</span>
          <span className="block text-xs text-ink-muted">View full breakdown, edit or delete transactions</span>
        </span>
        <ChevronRight aria-hidden className="size-5 flex-shrink-0 text-ink-subtle" />
      </Link>
    </div>
  );
}
