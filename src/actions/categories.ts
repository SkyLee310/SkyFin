"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CreateCategorySchema,
  RenameCategorySchema,
  ArchiveCategorySchema,
  CreateCategoryInput,
  RenameCategoryInput,
  ArchiveCategoryInput,
  ActionResult,
} from "@/lib/validation/schemas";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  kind: "expense" | "income";
  default_essential: boolean;
  is_preset: boolean;
  archived: boolean;
  created_at: string;
}

export async function listCategories(params?: {
  kind?: "expense" | "income";
  includeArchived?: boolean;
}): Promise<ActionResult<Category[]>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" };
  }

  let query = supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (params?.kind) {
    query = query.eq("kind", params.kind);
  }

  if (!params?.includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false, code: "NOT_FOUND", message: error.message };
  }

  return { ok: true, data: (data as Category[]) || [] };
}

export async function createCategory(
  rawInput: CreateCategoryInput
): Promise<ActionResult<Category>> {
  const parsed = CreateCategorySchema.safeParse(rawInput);
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

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      kind: parsed.data.kind,
      default_essential: parsed.data.defaultEssential,
      is_preset: false,
      archived: false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        code: "CONFLICT",
        message: `Category "${parsed.data.name}" already exists for ${parsed.data.kind}`,
      };
    }
    return { ok: false, code: "NOT_FOUND", message: error.message };
  }

  return { ok: true, data: data as Category };
}

export async function renameCategory(
  rawInput: RenameCategoryInput
): Promise<ActionResult<Category>> {
  const parsed = RenameCategorySchema.safeParse(rawInput);
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

  const { data, error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        code: "CONFLICT",
        message: `A category named "${parsed.data.name}" already exists`,
      };
    }
    return { ok: false, code: "NOT_FOUND", message: error.message };
  }

  return { ok: true, data: data as Category };
}

export async function archiveCategory(
  rawInput: ArchiveCategoryInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = ArchiveCategorySchema.safeParse(rawInput);
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

  const { error } = await supabase
    .from("categories")
    .update({ archived: true })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, code: "NOT_FOUND", message: error.message };
  }

  return { ok: true, data: { id: parsed.data.id } };
}
