"use server";

import { createClient } from "@/lib/supabase/server";
import { AiFailedError, parseText } from "@/lib/ai/parse-text";
import {
  type ActionResult,
  type Draft,
  type Lang,
  ParseTextInput,
} from "@/lib/validation/schemas";

/**
 * Chat text → drafts (F3). Nothing is written to transactions here: drafts go to the
 * Confirmation Card, and only Confirm & Save inserts rows.
 */
export async function parseTextEntry(
  rawInput: ParseTextInput,
): Promise<ActionResult<{ reply: string; language: Lang; drafts: Draft[] }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" };
  }

  const parsed = ParseTextInput.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  // Counted before the model is called, so a failing call still uses up the daily cap.
  const { data: allowed, error: limitError } = await supabase.rpc("consume_ai_call");
  if (limitError) {
    return { ok: false, code: "AI_FAILED", message: limitError.message };
  }
  if (!allowed) {
    return {
      ok: false,
      code: "AI_LIMIT",
      message: "Daily AI limit reached — use + to add manually",
    };
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, kind, default_essential")
    .eq("user_id", user.id)
    .eq("archived", false);
  if (categoriesError || !categories) {
    return { ok: false, code: "AI_FAILED", message: categoriesError?.message ?? "No categories" };
  }

  try {
    const result = await parseText(parsed.data.message, {
      categories,
      sessionDrafts: parsed.data.sessionDrafts,
    });

    // D7: scheduled warnings and audits use the language of the latest message. Best effort;
    // a failed write here shouldn't lose the drafts.
    await supabase
      .from("profiles")
      .update({ preferred_language: result.language })
      .eq("id", user.id);

    return { ok: true, data: result };
  } catch (error) {
    console.error("parseTextEntry", error instanceof AiFailedError ? error.cause : error);
    return { ok: false, code: "AI_FAILED", message: "Couldn't read that. Try again." };
  }
}
