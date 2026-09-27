import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MarkRead } from "@/components/audit/mark-read";
import { ReportView } from "@/components/audit/report-view";
import { getReport } from "@/lib/queries/audits";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: PageProps<"/audit/[id]">) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link
        href="/audit"
        className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-full pr-3 text-sm font-semibold text-ink-muted"
      >
        <ChevronLeft aria-hidden className="size-5" /> AI Audit
      </Link>
      <ReportView content={report.content} />
      <MarkRead id={report.id} read={report.read} />
    </div>
  );
}
