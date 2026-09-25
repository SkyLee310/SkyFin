import "server-only";

import { randomUUID } from "node:crypto";
import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { todayMYT } from "@/lib/dates";
import { Draft } from "@/lib/validation/schemas";
import { fakeParseReceipt } from "./fake";
import { isPermanentAiError } from "./errors";
import { generateJson, isFakeAiEnabled } from "./generate";
import {
  type CategoryRef,
  cleanText,
  matchCategory,
  modelAmountToSen,
  normalizeDate,
  normalizePaymentMethod,
} from "./normalize";
import { AiFailedError } from "./parse-text";
import {
  PARSE_RECEIPT_RESPONSE_SCHEMA,
  PARSE_RECEIPT_SYSTEM,
  buildParseReceiptPrompt,
} from "./prompts/parse-receipt";

const ModelReceiptOutput = z.object({
  is_receipt: z.boolean(),
  total_amount: z.union([z.number(), z.string()]).nullable().optional(),
  currency_is_rm: z.boolean().optional(),
  merchant: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  suggested_category: z.string().nullable().optional(),
  suggested_is_essential: z.boolean().optional(),
  suggested_payment_method: z.string().nullable().optional(),
  item_label: z.string().nullable().optional(),
  confidence: z.number().optional(),
});

export type ParseReceiptResult = { isReceipt: false } | { isReceipt: true; draft: Draft };

interface Context {
  categories: CategoryRef[];
  now: Date;
}

/** Maps parsed model JSON onto one expense Draft (FR-11). Throws if a receipt has no usable total. */
export function mapReceiptOutput(raw: unknown, { categories, now }: Context): ParseReceiptResult {
  const output = ModelReceiptOutput.parse(raw);
  if (!output.is_receipt) return { isReceipt: false };

  const amountSen = modelAmountToSen(output.total_amount);
  if (amountSen === null) throw new Error(`Unusable total: ${String(output.total_amount)}`);
  const category = matchCategory(output.suggested_category, "expense", categories);
  if (!category) throw new Error("No expense category to use");

  const confidence = Math.min(1, Math.max(0, output.confidence ?? 0));
  const draft = Draft.parse({
    clientId: randomUUID(),
    type: "expense",
    amountSen,
    categoryId: category.id,
    paymentMethod: normalizePaymentMethod(output.suggested_payment_method),
    merchant: cleanText(output.merchant, 80),
    itemLabel: cleanText(output.item_label, 40)?.toLowerCase() ?? null,
    note: null,
    date: normalizeDate(output.date, now),
    isEssential: output.suggested_is_essential ?? category.default_essential,
    confidence,
    // FR-14: flag anything not clearly in RM; the user confirms by saving.
    currencyWarning: output.currency_is_rm === false,
  });
  return { isReceipt: true, draft };
}

type Model = (image: Uint8Array, prompt: string) => Promise<string>;

const geminiModel: Model = (image, prompt) =>
  generateJson({
    system: PARSE_RECEIPT_SYSTEM,
    parts: [
      { inlineData: { mimeType: "image/jpeg", data: Buffer.from(image).toString("base64") } },
      { text: prompt },
    ],
    schema: PARSE_RECEIPT_RESPONSE_SCHEMA,
    thinkingLevel: ThinkingLevel.LOW,
  });

/**
 * Reads one receipt photo (TECH_SPEC §5.4). Output that fails validation gets one retry, then
 * AiFailedError. The caller has already run consume_ai_call().
 */
export async function parseReceipt(
  image: Uint8Array,
  context: Omit<Context, "now"> & { now?: Date },
  model: Model = isFakeAiEnabled() ? async (img) => fakeParseReceipt(img) : geminiModel,
): Promise<ParseReceiptResult> {
  const ctx: Context = { ...context, now: context.now ?? new Date() };
  const prompt = buildParseReceiptPrompt({
    today: todayMYT(ctx.now),
    expenseCategories: ctx.categories.filter((c) => c.kind === "expense").map((c) => c.name),
  });
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return mapReceiptOutput(JSON.parse(await model(image, prompt)), ctx);
    } catch (error) {
      lastError = error;
      // Wrong settings or a refused key fail the same way twice; don't pay for a second call.
      if (isPermanentAiError(error)) break;
    }
  }
  throw new AiFailedError(lastError);
}
