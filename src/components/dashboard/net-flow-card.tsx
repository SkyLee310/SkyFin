import React from "react";
import { formatRM } from "@/lib/money";
import { ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";

interface NetFlowCardProps {
  incomeSen: number;
  expenseSen: number;
  netSen: number;
}

export function NetFlowCard({ incomeSen, expenseSen, netSen }: NetFlowCardProps) {
  const isNetPositive = netSen >= 0;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Net Cash Flow
            </h3>
            <p className="text-[11px] text-slate-400">Current calendar month</p>
          </div>
        </div>

        <div className="text-right">
          <span
            id="dashboard-net-cash-flow"
            className={`text-lg font-extrabold tracking-tight ${
              isNetPositive ? "text-emerald-600" : "text-slate-900"
            }`}
          >
            {formatRM(netSen)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-3 mt-1">
        {/* Income */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">
              Income
            </span>
            <span
              id="dashboard-income-total"
              className="text-sm font-bold text-slate-900"
            >
              {formatRM(incomeSen)}
            </span>
          </div>
        </div>

        {/* Expenses */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">
              Expenses
            </span>
            <span
              id="dashboard-expense-total"
              className="text-sm font-bold text-slate-900"
            >
              {formatRM(expenseSen)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
