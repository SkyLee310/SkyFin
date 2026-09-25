"use server";

import { createClient } from "@/lib/supabase/server";
import { AiFailedError, parseText } from "@/lib/ai/parse-text";
import { parseReceipt as readReceipt } from "@/lib/ai/parse-receipt";
import { RECEIPTS_BUCKET, isOwnReceiptPath, newReceiptPath } from "@/lib/receipts";
import {
  type ActionResult,
  type Draft,
  type Lang,
  ParseTextInput,
  ReceiptPathInput,
} from "@/lib/validation/schemas";

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/** consume_ai_call() before every user-triggered Gemini call; null means go ahead. */
async function checkAiLimit(supabase: SessionClient): Promise<ActionResult<never> | null> {
  const { data: allowed, error } = await supabase.rpc("consume_ai_call");
  if (error) return { ok: false, code: "AI_FAILED", message: error.message };
  if (!allowed) {
    return { ok: false, code: "AI_LIMIT", message: "Daily AI limit reached — use + to add manually" };
  }
  return null;
}

async function activeCategories(supabase: SessionClient, userId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, default_essential")
    .eq("user_id", userId)
    .eq("archived", false);
  return error || !data ? null : data;
}

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
  const limited = await checkAiLimit(supabase);
  if (limited) return limited;

  const categories = await activeCategories(supabase, user.id);
  if (!categories) return { ok: false, code: "AI_FAILED", message: "Couldn't load categories" };

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

/**
 * A one-time upload URL for a new receipt at {uid}/{uuid}.jpg (TECH_SPEC §4.3). The server picks
 * the path; the browser PUTs the JPEG straight to Storage, so the image never passes through
 * Vercel and the browser needs no Supabase session of its own (D31).
 */
export async function createReceiptUpload(): Promise<ActionResult<{ path: string; signedUrl: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" };
  }

  const path = newReceiptPath(user.id);
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, code: "NOT_FOUND", message: error?.message ?? "Couldn't start the upload" };
  }
  return { ok: true, data: { path, signedUrl: data.signedUrl } };
}

/**
 * Receipt photo → one draft (F4). A photo that isn't a receipt is deleted (FR-12). On AI_LIMIT
 * or AI_FAILED the photo is kept, so the user can still log it by hand with the image attached.
 */
export async function parseReceipt(rawInput: ReceiptPathInput): Promise<ActionResult<{ draft: Draft }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" };
  }

  const parsed = ReceiptPathInput.safeParse(rawInput);
  if (!parsed.success || !isOwnReceiptPath(parsed.data.path, user.id)) {
    return { ok: false, code: "VALIDATION", message: "Not a receipt path" };
  }
  const { path } = parsed.data;

  const limited = await checkAiLimit(supabase);
  if (limited) return limited;

  const categories = await activeCategories(supabase, user.id);
  if (!categories) return { ok: false, code: "AI_FAILED", message: "Couldn't load categories" };

  // Downloaded through the session client, so RLS still decides whose file this is.
  const { data: blob, error: downloadError } = await supabase.storage.from(RECEIPTS_BUCKET).download(path);
  if (downloadError || !blob) {
    return { ok: false, code: "NOT_FOUND", message: "Receipt upload not found" };
  }

  try {
    const result = await readReceipt(new Uint8Array(await blob.arrayBuffer()), { categories });
    if (!result.isReceipt) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
      return { ok: false, code: "NOT_RECEIPT", message: "This doesn't look like a receipt" };
    }
    return { ok: true, data: { draft: result.draft } };
  } catch (error) {
    console.error("parseReceipt", error instanceof AiFailedError ? error.cause : error);
    return { ok: false, code: "AI_FAILED", message: "Couldn't read this receipt." };
  }
}

/** Discard on the Confirmation Card (F5-3): deletes the upload unless a saved row uses it. */
export async function discardReceipt(rawInput: ReceiptPathInput): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "User not authenticated" };
  }

  const parsed = ReceiptPathInput.safeParse(rawInput);
  if (!parsed.success || !isOwnReceiptPath(parsed.data.path, user.id)) {
    return { ok: false, code: "VALIDATION", message: "Not a receipt path" };
  }

  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("receipt_url", parsed.data.path);
  if (countError) return { ok: false, code: "NOT_FOUND", message: countError.message };
  if (count) return { ok: true, data: null };

  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([parsed.data.path]);
  if (error) return { ok: false, code: "NOT_FOUND", message: error.message };
  return { ok: true, data: null };
}
