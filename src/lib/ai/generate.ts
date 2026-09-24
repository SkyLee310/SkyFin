import "server-only";

import type { Part, ThinkingLevel } from "@google/genai";
import { geminiModel, getGenAI } from "./client";

export interface JsonRequest {
  system: string;
  parts: Part[];
  schema: object;
  thinkingLevel: ThinkingLevel;
}

/** One structured-output call; returns the raw JSON text for the caller to validate. */
export async function generateJson({ system, parts, schema, thinkingLevel }: JsonRequest): Promise<string> {
  const response = await getGenAI().models.generateContent({
    model: geminiModel(),
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      thinkingConfig: { thinkingLevel },
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

/**
 * D30: with AI_FAKE=1 outside production, the parsers use canned model output from ./fake.ts
 * instead of Gemini, so E2E tests run without credentials or cost. Vercel always builds with
 * NODE_ENV=production, so this can never switch on there.
 */
export function isFakeAiEnabled(): boolean {
  return process.env.AI_FAKE === "1" && process.env.NODE_ENV !== "production";
}
