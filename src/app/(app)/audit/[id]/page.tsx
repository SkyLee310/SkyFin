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
    <div className="flex flex-col gap-4 min-h-screen p-4">
      <Link href="/audit" className="self-start flex items-center gap-1 min-h-[44px] text-sm font-semibold text-slate-600">
        <ChevronLeft className="w-4 h-4" aria-hidden /> AI Audit
      </Link>
      <ReportView content={report.content} />
      <MarkRead id={report.id} read={report.read} />
    </div>
  );
}
