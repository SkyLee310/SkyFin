import React from "react";
import { getDashboardBudget, getNetCashFlow } from "@/lib/queries/dashboard";
import { BudgetCard } from "@/components/dashboard/budget-card";
import { NetFlowCard } from "@/components/dashboard/net-flow-card";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [budgetData, netFlowData] = await Promise.all([
    getDashboardBudget(),
    getNetCashFlow(),
  ]);

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

      {/* 1. Monthly Budget Card */}
      <BudgetCard
        budgetSen={budgetData.budgetSen}
        spentSen={budgetData.spentSen}
        remainingSen={budgetData.remainingSen}
        daysRemaining={budgetData.daysRemaining}
      />

      {/* 2. Net Cash Flow Card */}
      <NetFlowCard
        incomeSen={netFlowData.incomeSen}
        expenseSen={netFlowData.expenseSen}
        netSen={netFlowData.netSen}
      />

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
