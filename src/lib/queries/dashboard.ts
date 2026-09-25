import "server-only";

import { redirect } from "next/navigation";
import { evaluatePace, type PaceResult } from "@/lib/agents/accounting";
import { monthRangeMYT, todayMYT } from "@/lib/dates";
import { numericToSen } from "@/lib/money";
import { cashFlow, summarizeExpenses, type CashFlow, type ExpenseSummary } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";
import { loadPeriodRows } from "./stats";

export interface DashboardData {
  /** "YYYY-MM", for links into History. */
  month: string;
  budgetSen: number;
  spentSen: number;
  remainingSen: number;
  /** D − d + 1: today counts. */
  daysRemaining: number;
  daysInMonth: number;
  pace: PaceResult;
  cashFlow: CashFlow;
  expenses: ExpenseSummary;
  /** Last month's Wants share, the marker on the Needs vs Wants bar; null with no expenses. */
  lastMonthWantsPct: number | null;
}

function previousMonthStart(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  return month === 1 ? `${year! - 1}-12-01` : `${year}-${String(month! - 1).padStart(2, "0")}-01`;
}

/** Everything the Dashboard shows for the current MYT month (PRD §9), from one set of rows. */
export async function getDashboard(): Promise<DashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayMYT();
  const range = monthRangeMYT(today);
  const last = monthRangeMYT(previousMonthStart(range.start));

  const [{ data: profile }, rows, lastRows] = await Promise.all([
    supabase.from("profiles").select("monthly_budget").eq("id", user.id).single(),
    loadPeriodRows(supabase, user.id, range.start, range.end),
    loadPeriodRows(supabase, user.id, last.start, last.end),
  ]);

  const budgetSen = profile ? numericToSen(profile.monthly_budget) : 0;
  const expenses = summarizeExpenses(rows);
  const spentExcludedSen = rows
    .filter((r) => r.type === "expense" && r.exclude_from_pace)
    .reduce((sum, r) => sum + numericToSen(r.amount), 0);

  return {
    month: today.slice(0, 7),
    budgetSen,
    spentSen: expenses.totalSen,
    remainingSen: Math.max(0, budgetSen - expenses.totalSen),
    daysRemaining: range.daysInMonth - range.day + 1,
    daysInMonth: range.daysInMonth,
    pace: evaluatePace({ budgetSen, spentSen: expenses.totalSen, spentExcludedSen, today }),
    cashFlow: cashFlow(rows),
    expenses,
    lastMonthWantsPct: summarizeExpenses(lastRows).wantsPct,
  };
}
