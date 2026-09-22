import { formatRM } from "@/lib/money";
import { Calendar } from "lucide-react";

interface BudgetCardProps {
  budgetSen: number;
  spentSen: number;
  remainingSen: number;
  daysRemaining: number;
}

export function BudgetCard({
  budgetSen,
  spentSen,
  remainingSen,
  daysRemaining,
}: BudgetCardProps) {
  const percentUsed = budgetSen > 0 ? Math.min(100, Math.round((spentSen / budgetSen) * 100)) : 0;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 shadow-lg border border-slate-800 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
        <span>Monthly Budget</span>
        <div className="flex items-center gap-1 text-slate-300">
          <Calendar className="w-3.5 h-3.5" />
          <span>{daysRemaining} days left</span>
        </div>
      </div>

      {budgetSen === 0 ? (
        <div className="py-3">
          <p className="text-xl font-bold text-slate-200">No budget set</p>
          <p className="text-xs text-slate-400 mt-1">
            Set your monthly budget in settings to track your burn rate.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <span
              id="dashboard-remaining-rm"
              className="text-3xl font-extrabold tracking-tight text-white"
            >
              {formatRM(remainingSen)}
            </span>
            <span className="text-xs text-slate-400">left</span>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            Spent {formatRM(spentSen)} of {formatRM(budgetSen)}
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentUsed > 85 ? "bg-rose-500" : percentUsed > 60 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
