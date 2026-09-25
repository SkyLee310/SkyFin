"use server";

import { createClient } from "@/lib/supabase/server";
import { senToNumeric } from "@/lib/money";
import { RECEIPTS_BUCKET, isOwnReceiptPath } from "@/lib/receipts";
import { checkAfterWrite } from "@/lib/agents/check";
import type { Warning } from "@/lib/agents/accounting";
import {
  SaveInput,
  UpdateTransactionInput,
  IdInput,
  ExcludeFromPaceInput,
  ActionResult,
} from "@/lib/validation/schemas";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

export interface TransactionRecord {
  id: string;
  user_id: string;
  amount: number;
  category_id: string;
  type: "expense" | "income";
  payment_method: "Cash" | "eWallet" | "Card";
  merchant: string | null;
  item_label: string | null;
  receipt_url: string | null;
  receipt_group_id: string | null;
  note: string | null;
  date: string;
  is_essential: boolean;
  exclude_from_pace: boolean;
  created_at: string;
  updated_at: string;
}

const UNAUTHENTICATED = { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" } as const;

// Every page reads these rows, and the layout's banner shows any warning the write raised.
function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveTransactions(
  rawInput: SaveInput
): Promise<ActionResult<{ ids: string[]; warning?: Warning }>> {
  const parsed = SaveInput.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return UNAUTHENTICATED;

  const { drafts, receiptPath } = parsed.data;
  // Only the caller's own upload can go on a row (F1-2); the path is shared by every split row.
  if (receiptPath !== null && !isOwnReceiptPath(receiptPath, user.id)) {
    return { ok: false, code: "VALIDATION", message: "Invalid receipt path" };
  }
  // Every receipt entry gets a group id, split or not, so History can still tell it was a
  // receipt after the daily sweep clears receipt_url ("Image expired", FR-26).
  const receiptGroupId = receiptPath ? randomUUID() : null;

  const rowsToInsert = drafts.map((d) => ({
    user_id: user.id,
    amount: senToNumeric(d.amountSen),
    category_id: d.categoryId,
    type: d.type,
    payment_method: d.paymentMethod,
    merchant: d.merchant || null,
    item_label: d.itemLabel || null,
    receipt_url: receiptPath || null,
    receipt_group_id: receiptGroupId,
    note: d.note || null,
    date: d.date,
    is_essential: d.isEssential,
  }));

  const { data, error } = await supabase
    .from("transactions")
    .insert(rowsToInsert)
    .select("id, type");

  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Invalid category or user reference",
      };
    }
    return { ok: false, code: "NOT_FOUND", message: error.message };
  }

  const rows = data as { id: string; type: string }[];
  const warning = await checkAfterWrite(
    supabase,
    user.id,
    rows.filter((r) => r.type === "expense").map((r) => r.id),
  );
  revalidateAll();
  return { ok: true, data: { ids: rows.map((r) => r.id), ...(warning ? { warning } : {}) } };
}

export async function updateTransaction(
  rawInput: UpdateTransactionInput
): Promise<ActionResult<{ id: string; warning?: Warning }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return UNAUTHENTICATED;

  const parsed = UpdateTransactionInput.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const { patch } = parsed.data;
  if (patch.amountSen !== undefined) updateFields.amount = senToNumeric(patch.amountSen);
  if (patch.categoryId !== undefined) updateFields.category_id = patch.categoryId;
  if (patch.type !== undefined) updateFields.type = patch.type;
  if (patch.paymentMethod !== undefined && patch.paymentMethod !== null) {
    updateFields.payment_method = patch.paymentMethod;
  }
  if (patch.merchant !== undefined) updateFields.merchant = patch.merchant;
  if (patch.itemLabel !== undefined) updateFields.item_label = patch.itemLabel;
  if (patch.note !== undefined) updateFields.note = patch.note;
  if (patch.date !== undefined) updateFields.date = patch.date;
  if (patch.isEssential !== undefined) updateFields.is_essential = patch.isEssential;

  const { data, error } = await supabase
    .from("transactions")
    .update(updateFields)
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id, type")
    .single();

  if (error || !data) {
    return { ok: false, code: "NOT_FOUND", message: error?.message || "Transaction not found" };
  }

  const row = data as { id: string; type: string };
  // F8-3: an edit re-runs the check; an expense edited up to ≥ 20% of the budget is a spike.
  const warning = await checkAfterWrite(supabase, user.id, row.type === "expense" ? [row.id] : []);
  revalidateAll();
  return { ok: true, data: { id: row.id, ...(warning ? { warning } : {}) } };
}

export async function deleteTransaction(
  rawInput: IdInput
): Promise<ActionResult<{ id: string; warning?: Warning }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return UNAUTHENTICATED;

  const parsed = IdInput.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Invalid transaction id" };

  const { data: deleted, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("receipt_url")
    .maybeSingle();

  if (error) {
    return { ok: false, code: "NOT_FOUND", message: error.message };
  }

  // The last row of a receipt takes its image with it. Through the Storage API: a SQL delete
  // would leave the file behind. Best effort; the daily sweep removes any orphan left over.
  const receiptPath = (deleted as { receipt_url: string | null } | null)?.receipt_url;
  if (receiptPath) {
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("receipt_url", receiptPath);
    if (count === 0) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([receiptPath]);
    }
  }

  const warning = await checkAfterWrite(supabase, user.id);
  revalidateAll();
  return { ok: true, data: { id: parsed.data.id, ...(warning ? { warning } : {}) } };
}

/**
 * The D16 answer, from the spike banner or a History row: a one-off expense still counts toward
 * the budget but leaves the pace average. Also settles any spike question about this expense.
 */
export async function setExcludeFromPace(
  rawInput: ExcludeFromPaceInput
): Promise<ActionResult<{ warning?: Warning }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return UNAUTHENTICATED;

  const parsed = ExcludeFromPaceInput.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Invalid input" };

  const { data, error } = await supabase
    .from("transactions")
    .update({ exclude_from_pace: parsed.data.value, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("type", "expense")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, code: "NOT_FOUND", message: error?.message || "Expense not found" };
  }

  await supabase
    .from("audit_reports")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("type", "budget_warning")
    .eq("level", "spike")
    .eq("content->>transaction_id", parsed.data.id)
    .is("read_at", null);

  const warning = await checkAfterWrite(supabase, user.id);
  revalidateAll();
  return { ok: true, data: warning ? { warning } : {} };
}
