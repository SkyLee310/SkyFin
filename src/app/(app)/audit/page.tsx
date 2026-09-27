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
    <div className="flex flex-col gap-4 p-4">
      <header className="pt-2 pb-1">
        <h1 className="text-[1.625rem] font-bold tracking-tight text-ink">AI Audit</h1>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Weekly audits, monthly reviews and settings
        </p>
      </header>

      {latest ? (
        <Link
          href={`/audit/${latest.id}`}
          id="latest-report"
          className="block rounded-[22px] bg-brand p-5 text-brand-foreground shadow-card"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
              <Sparkles aria-hidden className="size-3.5 flex-shrink-0" />
              Latest {latest.type === "weekly_audit" ? "weekly audit" : "monthly review"}
            </p>
            {!latest.read && (
              <span className="flex-shrink-0 rounded-full bg-brand-foreground px-2.5 py-1 text-xs font-semibold text-brand">
                New
              </span>
            )}
          </div>
          <p className="mt-3 text-lg leading-snug font-bold tracking-tight">{latest.headline}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">{formatPeriod(latest.periodStart, latest.periodEnd)}</span>
            <span className="flex items-center gap-1 font-semibold">
              Read the report <ChevronRight aria-hidden className="size-4" />
            </span>
          </div>
        </Link>
      ) : (
        <div
          id="no-reports"
          className="flex flex-col items-center rounded-[22px] bg-surface px-6 py-10 text-center text-ink shadow-card"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Sparkles aria-hidden className="size-5" />
          </span>
          <p className="mt-3 text-base font-bold tracking-tight">Your first audit arrives on Sunday evening</p>
          <p className="mt-1 text-sm text-ink-muted">
            It names your money leaks and gives 3 tips. A monthly review follows on the last day of the month.
          </p>
        </div>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Past reports</h2>
          <ReportList reports={past} />
        </section>
      )}

      <section className="flex flex-col gap-2.5 pt-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Settings</h2>
        <BudgetStep
          currentBudgetSen={profile.budgetSen}
          trigger={
            <button
              type="button"
              id="btn-edit-budget-settings"
              className="flex min-h-16 w-full items-center gap-3 rounded-[22px] bg-surface p-4 text-left text-ink shadow-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-sunken text-ink-muted">
                <Wallet aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold">Monthly budget</span>
              <span className="text-sm font-bold tabular-nums">{formatRM(profile.budgetSen)}</span>
              <ChevronRight aria-hidden className="size-5 flex-shrink-0 text-ink-subtle" />
            </button>
          }
        />
        <CategorySettings />
      </section>
    </div>
  );
}
