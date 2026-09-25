import "server-only";

import { bySeverity, toWarning, type Warning } from "@/lib/agents/accounting";
import type { AuditContent } from "@/lib/agents/audit-content";
import { monthRangeMYT, todayMYT } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export interface BudgetAppliedNotice {
  reportId: string;
  month: string;
  budgetSen: number;
  previousBudgetSen: number;
}

export interface ShellState {
  /** Unread budget warnings from this month, most severe first, newest first within a level. */
  warnings: Warning[];
  /** This month's auto-applied budget, until undone or dismissed (D19). */
  budgetApplied: BudgetAppliedNotice | null;
  /** Unread weekly and monthly audits, for the AI Audit tab badge. */
  unreadAudits: number;
}

/** What the app shell shows on every tab: the banner slot and the Audit badge. */
export async function getShellState(): Promise<ShellState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { warnings: [], budgetApplied: null, unreadAudits: 0 };

  const today = todayMYT();
  const month = today.slice(0, 7);
  const range = monthRangeMYT(today);

  const [warningsRes, appliedRes, unreadRes] = await Promise.all([
    supabase
      .from("audit_reports")
      .select("id, level, content, created_at")
      .eq("user_id", user.id)
      .eq("type", "budget_warning")
      .eq("period_start", range.start)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("audit_reports")
      .select("id, content")
      .eq("user_id", user.id)
      .eq("type", "monthly_audit")
      .eq("content->budget->>for_month", month)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("audit_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("type", ["weekly_audit", "monthly_audit"])
      .is("read_at", null),
  ]);

  // Stable sort: severity first, and the query's newest-first order within each level.
  const warnings = (warningsRes.data ?? []).map(toWarning).sort(bySeverity);

  const budget = (appliedRes.data?.content as AuditContent | undefined)?.budget;
  const budgetApplied =
    appliedRes.data && budget?.applied_at && !budget.undone_at && !budget.dismissed_at
      ? {
          reportId: appliedRes.data.id as string,
          month,
          budgetSen: budget.suggested_budget_sen,
          previousBudgetSen: budget.previous_budget_sen,
        }
      : null;

  return { warnings, budgetApplied, unreadAudits: unreadRes.count ?? 0 };
}
