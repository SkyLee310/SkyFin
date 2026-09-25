import { ApiError } from "@google/genai";

// Why an AI call failed, in words the user can act on. Only the kind of failure is shown, never
// a key or a raw provider message.

/** Vertex AI settings are missing or unreadable on the server (D22). */
export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

/** A failure that another attempt can't fix: wrong settings, a refused key, a missing model. */
export function isPermanentAiError(error: unknown): boolean {
  if (error instanceof AiConfigError) return true;
  return error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429;
}

/** The chat's message for a failed call; `fallback` covers output that just couldn't be used. */
export function aiFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof AiConfigError) {
    return "AI isn't set up on the server yet (Vertex AI settings in Vercel).";
  }
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "The AI service refused the server's key (check GOOGLE_SERVICE_ACCOUNT_KEY and its Vertex AI role).";
    }
    if (error.status === 404) {
      return "The AI model wasn't found (check GEMINI_MODEL and GOOGLE_CLOUD_LOCATION).";
    }
    if (error.status === 429) return "The AI service is busy. Try again in a minute.";
    if (error.status >= 500) return "The AI service is having trouble. Try again in a minute.";
  }
  return fallback;
}
