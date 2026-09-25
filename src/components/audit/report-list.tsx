import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReportSummary } from "@/lib/queries/audits";
import { formatPeriod } from "./format";

export function ReportList({ reports }: { reports: ReportSummary[] }) {
  return (
    <ul id="report-list" className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
      {reports.map((r) => (
        <li key={r.id}>
          <Link
            href={`/audit/${r.id}`}
            data-testid="report-row"
            className="flex items-center gap-3 min-h-[56px] p-3.5 hover:bg-slate-50"
          >
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {r.type === "weekly_audit" ? "Weekly" : "Monthly"} · {formatPeriod(r.periodStart, r.periodEnd)}
                {!r.read && <span className="w-2 h-2 rounded-full bg-rose-500" aria-label="Unread" />}
              </span>
              <span className="block text-sm text-slate-800 line-clamp-2 mt-0.5">{r.headline}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
