import "server-only";

import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { rmAmountsIn } from "@/lib/agents/audit-content";
import { fakeAudit } from "./fake";
import { generateJson, isFakeAiEnabled } from "./generate";
import { AUDIT_RESPONSE_SCHEMA, AUDIT_SYSTEM, type AuditPromptInput, buildAuditPrompt } from "./prompts/audit";

const ModelAuditOutput = z.object({
  headline: z.string().trim().min(1).max(300),
  tips: z
    .array(
      z.object({
        option_id: z.string(),
        title: z.string().trim().min(1).max(100),
        detail: z.string().trim().min(1).max(400),
      }),
    )
    .length(3),
});

export interface AuditText {
  headline: string;
  tips: { optionId: string; title: string; detail: string }[];
}

type Model = (prompt: AuditPromptInput) => Promise<string>;

const geminiModel: Model = (prompt) =>
  generateJson({
    system: AUDIT_SYSTEM,
    parts: [{ text: buildAuditPrompt(prompt) }],
    schema: AUDIT_RESPONSE_SCHEMA,
    thinkingLevel: ThinkingLevel.MEDIUM,
  });

/**
 * Checks the model's answer: exactly 3 tips on 3 different known options, and no RM amount in
 * the text that isn't one of the report's pre-computed figures. Throws if anything is off.
 */
export function mapAuditOutput(raw: unknown, optionIds: string[], allowedFigures: Set<string>): AuditText {
  const output = ModelAuditOutput.parse(raw);
  const ids = output.tips.map((t) => t.option_id);
  if (new Set(ids).size !== 3 || ids.some((id) => !optionIds.includes(id))) {
    throw new Error(`Tips must use 3 different known options, got ${JSON.stringify(ids)}`);
  }
  const text = [output.headline, ...output.tips.flatMap((t) => [t.title, t.detail])].join("\n");
  const stray = rmAmountsIn(text).filter((amount) => !allowedFigures.has(amount));
  if (stray.length > 0) throw new Error(`Model wrote figures not in the stats: ${stray.join(", ")}`);
  return {
    headline: output.headline,
    tips: output.tips.map((t) => ({ optionId: t.option_id, title: t.title, detail: t.detail })),
  };
}

/**
 * The audit's words from Gemini (medium thinking). Output that fails the checks gets one retry;
 * after that it returns null and the caller writes the stats-only report instead.
 */
export async function writeAuditText(
  prompt: AuditPromptInput,
  allowedFigures: Set<string>,
  model: Model = isFakeAiEnabled() ? async (p) => fakeAudit(p) : geminiModel,
): Promise<AuditText | null> {
  const optionIds = prompt.options.map((o) => o.id);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return mapAuditOutput(JSON.parse(await model(prompt)), optionIds, allowedFigures);
    } catch (error) {
      console.error("audit text", error);
    }
  }
  return null;
}
