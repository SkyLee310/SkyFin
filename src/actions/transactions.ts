"use server";

import { createClient } from "@/lib/supabase/server";
import { toRM } from "@/lib/money";
import {
  SaveInput,
  Draft,
  ActionResult,
} from "@/lib/validation/schemas";
import { randomUUID } from "crypto";

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

export async function saveTransactions(
  rawInput: SaveInput
): Promise<ActionResult<{ ids: string[] }>> {
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

  if (authError || !user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" };
  }

  const { drafts, receiptPath } = parsed.data;
  const isSplitGroup = drafts.length > 1 && !!receiptPath;
  const receiptGroupId = isSplitGroup ? randomUUID() : null;

  const rowsToInsert = drafts.map((d) => ({
    user_id: user.id,
    amount: toRM(d.amountSen),
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
    .select("id");

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

  const ids = (data as { id: string }[]).map((r) => r.id);
  return { ok: true, data: { ids } };
}

export async function updateTransaction(params: {
  id: string;
  patch: Partial<Draft>;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" };
  }

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const { patch } = params;
  if (patch.amountSen !== undefined) updateFields.amount = toRM(patch.amountSen);
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
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, code: "NOT_FOUND", message: error?.message || "Transaction not found" };
  }

  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function deleteTransaction(params: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, code: "NOT_FOUND", message: error.message };
  }

  return { ok: true, data: { id: params.id } };
}
