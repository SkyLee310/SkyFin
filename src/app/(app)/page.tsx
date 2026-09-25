import React from "react";
import { getDashboard } from "@/lib/queries/dashboard";
import { BudgetCard } from "@/components/dashboard/budget-card";
import { NetFlowCard } from "@/components/dashboard/net-flow-card";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { PaymentBar } from "@/components/dashboard/payment-bar";
import { NeedsWantsBar } from "@/components/dashboard/needs-wants-bar";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboard();

  return (
    <div className="flex flex-col gap-5 p-4 pt-safe">
      {/* Top Header */}
      <div className="flex items-center justify-between py-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            SkyFin
          </h1>
          <p className="text-xs text-slate-500">Student Expense Tracker</p>
        </div>

        <Link
          href="/chat"
          className="min-h-[36px] px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Log</span>
        </Link>
      </div>

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

      {/* Quick Access to History */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-800">Recent Spending</h4>
          <p className="text-[11px] text-slate-500">
            View full breakdown, edit or delete transactions
          </p>
        </div>
        <Link
          href="/history"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 p-2 min-h-[44px]"
        >
          <span>History</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
