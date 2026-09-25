"use server";

import { revalidatePath } from "next/cache";
import { numericToSen, senToNumeric } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { checkAfterWrite } from "@/lib/agents/check";
import type { AuditContent } from "@/lib/agents/audit-content";
import {
  type ActionResult,
  DismissWarningsInput,
  IdInput,
} from "@/lib/validation/schemas";

const UNAUTHENTICATED = { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" } as const;

/** Opening a report marks it read, which clears it from the Audit tab badge. */
export async function markReportRead(rawInput: IdInput): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return UNAUTHENTICATED;

  const parsed = IdInput.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Invalid report id" };

  const { error } = await supabase
    .from("audit_reports")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, code: "NOT_FOUND", message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/** Dismiss on the warning banner: marks these budget warnings read. */
export async function dismissWarnings(rawInput: DismissWarningsInput): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return UNAUTHENTICATED;

  const parsed = DismissWarningsInput.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Invalid warning ids" };

  const { error } = await supabase
    .from("audit_reports")
    .update({ read_at: new Date().toISOString() })
    .in("id", parsed.data.ids)
    .eq("user_id", user.id)
    .eq("type", "budget_warning")
    .is("read_at", null);
  if (error) return { ok: false, code: "NOT_FOUND", message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

async function loadMonthlyReport(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, id: string) {
  const { data, error } = await supabase
    .from("audit_reports")
    .select("id, content")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("type", "monthly_audit")
    .maybeSingle();
  return error || !data ? null : { id: data.id as string, content: data.content as AuditContent };
}

/**
 * The one-tap undo after the suggested budget was applied on the 1st (D19): puts back the
 * budget that was in place before, and re-runs the accounting check against it.
 */
export async function restorePreviousBudget(
  rawInput: IdInput,
): Promise<ActionResult<{ budgetSen: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return UNAUTHENTICATED;

  const parsed = IdInput.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Invalid report id" };

  const report = await loadMonthlyReport(supabase, user.id, parsed.data.id);
  const previous = report?.content.budget?.previous_budget_sen;
  if (!report || !report.content.budget?.applied_at || previous === undefined) {
    return { ok: false, code: "NOT_FOUND", message: "There is no applied budget to undo." };
  }
  if (report.content.budget.undone_at) {
    return { ok: false, code: "CONFLICT", message: "The previous budget is already restored." };
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ monthly_budget: senToNumeric(previous) })
    .eq("id", user.id)
    .select("monthly_budget")
    .single();
  if (error || !updated) return { ok: false, code: "NOT_FOUND", message: "Couldn't restore your budget." };

  const content: AuditContent = {
    ...report.content,
    budget: { ...report.content.budget, undone_at: new Date().toISOString() },
  };
  await supabase.from("audit_reports").update({ content }).eq("id", report.id).eq("user_id", user.id);

  await checkAfterWrite(supabase, user.id);
  revalidatePath("/", "layout");
  return { ok: true, data: { budgetSen: numericToSen(updated.monthly_budget) } };
}

/** Hides the "new budget applied" banner and keeps the new budget. */
export async function dismissBudgetApplied(rawInput: IdInput): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return UNAUTHENTICATED;

  const parsed = IdInput.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Invalid report id" };

  const report = await loadMonthlyReport(supabase, user.id, parsed.data.id);
  if (!report?.content.budget) return { ok: false, code: "NOT_FOUND", message: "Report not found" };

  const content: AuditContent = {
    ...report.content,
    budget: { ...report.content.budget, dismissed_at: new Date().toISOString() },
  };
  const { error } = await supabase
    .from("audit_reports")
    .update({ content })
    .eq("id", report.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, code: "NOT_FOUND", message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}
