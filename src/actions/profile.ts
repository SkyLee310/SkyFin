"use server";

import { revalidatePath } from "next/cache";
import { senToNumeric } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { UpdateBudgetInput, type ActionResult } from "@/lib/validation/schemas";

const UNAUTHENTICATED = "Sign in to update your budget.";
const INVALID = "Enter a budget between RM 0 and RM 999,999.99.";
const FAILED = "Couldn't update your budget. Try again.";

// warning is added in M5.3 once evaluatePace exists; M1 always omits it.
export async function updateBudget(input: UpdateBudgetInput): Promise<ActionResult<{ budgetSen: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "UNAUTHENTICATED", message: UNAUTHENTICATED };

  const parsed = UpdateBudgetInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: INVALID };

  // .select().single() also confirms a row was actually updated: RLS makes a mismatched id
  // silently affect zero rows rather than error.
  const { data, error } = await supabase
    .from("profiles")
    .update({ monthly_budget: senToNumeric(parsed.data.budgetSen) })
    .eq("id", user.id)
    .select("id")
    .single();
  if (error || !data) return { ok: false, code: "NOT_FOUND", message: FAILED };

  revalidatePath("/");
  return { ok: true, data: { budgetSen: parsed.data.budgetSen } };
}
