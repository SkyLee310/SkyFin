import "server-only";

import { randomUUID } from "node:crypto";
import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { todayMYT } from "@/lib/dates";
import { senToNumeric } from "@/lib/money";
import { Draft, Lang } from "@/lib/validation/schemas";
import { fakeParseText } from "./fake";
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
import {
  PARSE_TEXT_RESPONSE_SCHEMA,
  PARSE_TEXT_SYSTEM,
  type ParseTextPromptInput,
  buildParseTextPrompt,
} from "./prompts/parse-text";

// What the model is allowed to return. Loose on purpose: normalize.ts maps each field onto the
// Draft schema, and Draft.parse is the final check.
const ModelDraft = z.object({
  client_id: z.string().nullable().optional(),
  type: z.enum(["expense", "income"]),
  amount: z.union([z.number(), z.string()]),
  category: z.string(),
  payment_method: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  item_label: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  is_essential: z.boolean().optional(),
});

const ModelTextOutput = z.object({
  reply: z.string().trim().min(1),
  language: Lang,
  drafts: z.array(ModelDraft).max(20),
});

export interface ParseTextResult {
  reply: string;
  language: Lang;
  /** Every pending draft for this chat session: corrections applied, new drafts appended. */
  drafts: Draft[];
}

export class AiFailedError extends Error {
  constructor(cause: unknown) {
    super("The AI response could not be used", { cause });
    this.name = "AiFailedError";
  }
}

interface Context {
  categories: CategoryRef[];
  sessionDrafts: Draft[];
  now: Date;
}

/** Maps parsed model JSON onto Drafts, merged with the session's drafts. Throws if anything is off. */
export function mapTextOutput(raw: unknown, { categories, sessionDrafts, now }: Context): ParseTextResult {
  const output = ModelTextOutput.parse(raw);
  const merged = [...sessionDrafts];

  for (const d of output.drafts) {
    const amountSen = modelAmountToSen(d.amount);
    if (amountSen === null) throw new Error(`Unusable amount: ${String(d.amount)}`);
    const category = matchCategory(d.category, d.type, categories);
    if (!category) throw new Error(`No ${d.type} category to use`);

    const existing = d.client_id ? merged.findIndex((s) => s.clientId === d.client_id) : -1;
    const draft = Draft.parse({
      clientId: existing >= 0 ? merged[existing]!.clientId : randomUUID(),
      type: d.type,
      amountSen,
      categoryId: category.id,
      paymentMethod: normalizePaymentMethod(d.payment_method),
      merchant: cleanText(d.merchant, 80),
      itemLabel: cleanText(d.item_label, 40)?.toLowerCase() ?? null,
      note: cleanText(d.note, 200),
      date: normalizeDate(d.date, now),
      isEssential: d.type === "income" ? true : (d.is_essential ?? category.default_essential),
    });

    if (existing >= 0) merged[existing] = draft;
    else merged.push(draft);
  }

  return { reply: output.reply.slice(0, 300), language: output.language, drafts: merged.slice(0, 20) };
}

export function toPromptInput(
  message: string,
  { categories, sessionDrafts, now }: Context,
): ParseTextPromptInput {
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? "Others";
  return {
    today: todayMYT(now),
    expenseCategories: categories.filter((c) => c.kind === "expense").map((c) => c.name),
    incomeCategories: categories.filter((c) => c.kind === "income").map((c) => c.name),
    sessionDrafts: sessionDrafts.map((d) => ({
      client_id: d.clientId,
      type: d.type,
      amount: senToNumeric(d.amountSen),
      category: nameOf(d.categoryId),
      payment_method: d.paymentMethod,
      merchant: d.merchant,
      item_label: d.itemLabel,
      date: d.date,
      is_essential: d.isEssential,
    })),
    message,
  };
}

type Model = (prompt: ParseTextPromptInput) => Promise<string>;

const geminiModel: Model = (prompt) =>
  generateJson({
    system: PARSE_TEXT_SYSTEM,
    parts: [{ text: buildParseTextPrompt(prompt) }],
    schema: PARSE_TEXT_RESPONSE_SCHEMA,
    thinkingLevel: ThinkingLevel.LOW,
  });

/**
 * Parses one chat message into drafts (TECH_SPEC §5.4). Output that fails validation gets one
 * retry, then AiFailedError. The caller has already run consume_ai_call().
 */
export async function parseText(
  message: string,
  context: Omit<Context, "now"> & { now?: Date },
  model: Model = isFakeAiEnabled() ? async (p) => fakeParseText(p) : geminiModel,
): Promise<ParseTextResult> {
  const ctx: Context = { ...context, now: context.now ?? new Date() };
  const prompt = toPromptInput(message, ctx);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return mapTextOutput(JSON.parse(await model(prompt)), ctx);
    } catch (error) {
      lastError = error;
      // Wrong settings or a refused key fail the same way twice; don't pay for a second call.
      if (isPermanentAiError(error)) break;
    }
  }
  throw new AiFailedError(lastError);
}
