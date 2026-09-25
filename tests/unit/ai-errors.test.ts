import { describe, expect, it } from "vitest";
import { ApiError } from "@google/genai";
import { AiConfigError, aiFailureMessage, isPermanentAiError } from "@/lib/ai/errors";

describe("aiFailureMessage", () => {
  const fallback = "Couldn't read that. Try again.";
  it("names missing server settings", () => {
    expect(aiFailureMessage(new AiConfigError("Gemini is not configured"), fallback)).toMatch(/isn't set up on the server/);
  });
  it.each([
    [401, /refused the server's key/],
    [403, /refused the server's key/],
    [404, /model wasn't found/],
    [429, /busy/],
    [503, /having trouble/],
  ])("HTTP %i → %s", (status, expected) => {
    expect(aiFailureMessage(new ApiError({ message: "x", status }), fallback)).toMatch(expected);
  });
  it("falls back for output that just couldn't be used", () => {
    expect(aiFailureMessage(new Error("Unusable amount"), fallback)).toBe(fallback);
  });
});

describe("isPermanentAiError", () => {
  it("doesn't retry settings, key or model errors, but does retry busy, server and output errors", () => {
    expect(isPermanentAiError(new AiConfigError("x"))).toBe(true);
    expect(isPermanentAiError(new ApiError({ message: "x", status: 403 }))).toBe(true);
    expect(isPermanentAiError(new ApiError({ message: "x", status: 404 }))).toBe(true);
    expect(isPermanentAiError(new ApiError({ message: "x", status: 429 }))).toBe(false);
    expect(isPermanentAiError(new ApiError({ message: "x", status: 500 }))).toBe(false);
    expect(isPermanentAiError(new SyntaxError("bad json"))).toBe(false);
  });
});
