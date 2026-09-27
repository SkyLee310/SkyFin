import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReportSummary } from "@/lib/queries/audits";
import { formatPeriod } from "./format";

export function ReportList({ reports }: { reports: ReportSummary[] }) {
  return (
    <ul id="report-list" className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface text-ink shadow-card">
      {reports.map((r) => (
        <li key={r.id}>
          <Link href={`/audit/${r.id}`} data-testid="report-row" className="flex min-h-16 items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {r.type === "weekly_audit" ? "Weekly" : "Monthly"} · {formatPeriod(r.periodStart, r.periodEnd)}
                {!r.read && <span className="size-2 rounded-full bg-brand" aria-label="Unread" />}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-sm font-semibold">{r.headline}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 flex-shrink-0 text-ink-subtle" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
