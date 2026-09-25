import Link from "next/link";
import { ChevronRight, Sparkles, Wallet } from "lucide-react";
import { CategorySettings } from "@/components/audit/category-settings";
import { ReportList } from "@/components/audit/report-list";
import { formatPeriod } from "@/components/audit/format";
import { BudgetStep } from "@/components/onboarding/budget-step";
import { formatRM } from "@/lib/money";
import { listReports } from "@/lib/queries/audits";
import { getProfile } from "@/lib/queries/profile";

export const dynamic = "force-dynamic";

/** AI Audit tab (PRD §9): latest report on top, past reports, then budget and category settings. */
export default async function AuditPage() {
  const [reports, profile] = await Promise.all([listReports(), getProfile()]);
  const [latest, ...past] = reports;

  return (
    <div className="flex flex-col gap-5 min-h-screen p-4">
      <div className="pb-3 border-b border-slate-100">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">AI Audit</h1>
        <p className="text-xs text-slate-500">Weekly audits, monthly reviews and settings</p>
      </div>

      {latest ? (
        <Link
          href={`/audit/${latest.id}`}
          id="latest-report"
          className="block p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl shadow-sm"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Latest {latest.type === "weekly_audit" ? "weekly audit" : "monthly review"} ·{" "}
            {formatPeriod(latest.periodStart, latest.periodEnd)}
            {!latest.read && <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-600 text-white normal-case">New</span>}
          </p>
          <p className="text-base font-bold text-slate-900 mt-1.5 leading-snug">{latest.headline}</p>
          <p className="text-xs font-semibold text-emerald-700 mt-3 flex items-center gap-1">
            Read the report <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </p>
        </Link>
      ) : (
        <div id="no-reports" className="p-5 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-center">
          <Sparkles className="w-6 h-6 mx-auto text-emerald-600" aria-hidden />
          <p className="text-sm font-bold text-slate-800 mt-2">Your first audit arrives on Sunday evening</p>
          <p className="text-xs text-slate-500 mt-1">
            It names your money leaks and gives 3 tips. A monthly review follows on the last day of the month.
          </p>
        </div>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Past reports</h2>
          <ReportList reports={past} />
        </section>
      )}

      <section className="flex flex-col gap-3 pt-2">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Settings</h2>
        <BudgetStep
          currentBudgetSen={profile.budgetSen}
          trigger={
            <button
              type="button"
              id="btn-edit-budget-settings"
              className="flex items-center gap-3 min-h-[56px] p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-left"
            >
              <Wallet className="w-4 h-4 text-slate-500" aria-hidden />
              <span className="flex-1 text-sm font-semibold text-slate-800">Monthly budget</span>
              <span className="text-sm font-bold text-slate-900">{formatRM(profile.budgetSen)}</span>
              <ChevronRight className="w-4 h-4 text-slate-300" aria-hidden />
            </button>
          }
        />
        <CategorySettings />
      </section>
    </div>
  );
}
