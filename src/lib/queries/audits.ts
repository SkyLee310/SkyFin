import "server-only";

import type { AuditContent } from "@/lib/agents/audit-content";
import { createClient } from "@/lib/supabase/server";

export interface ReportSummary {
  id: string;
  type: "weekly_audit" | "monthly_audit";
  periodStart: string;
  periodEnd: string;
  headline: string;
  read: boolean;
  createdAt: string;
}

export interface Report extends ReportSummary {
  content: AuditContent;
}

type Row = {
  id: string;
  type: ReportSummary["type"];
  period_start: string;
  period_end: string;
  content: AuditContent;
  read_at: string | null;
  created_at: string;
};

function toReport(row: Row): Report {
  return {
    id: row.id,
    type: row.type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    headline: row.content?.headline ?? "",
    read: row.read_at !== null,
    createdAt: row.created_at,
    content: row.content,
  };
}

/** Weekly and monthly audits, newest first (the AI Audit tab). */
export async function listReports(limit = 30): Promise<ReportSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_reports")
    .select("id, type, period_start, period_end, content, read_at, created_at")
    .in("type", ["weekly_audit", "monthly_audit"])
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map((row) => {
    const { content: _content, ...summary } = toReport(row);
    void _content;
    return summary;
  });
}

/** One report; RLS returns nothing for another user's id. */
export async function getReport(id: string): Promise<Report | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_reports")
    .select("id, type, period_start, period_end, content, read_at, created_at")
    .eq("id", id)
    .in("type", ["weekly_audit", "monthly_audit"])
    .maybeSingle();
  return data ? toReport(data as Row) : null;
}
