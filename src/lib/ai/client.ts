import "server-only";

import { GoogleGenAI } from "@google/genai";

// Gemini on Vertex AI (D22). This module is the only place that reads the service-account key,
// so local and production share one code path.

const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_LOCATION = "global";

let client: GoogleGenAI | null = null;

/** The model ID from GEMINI_MODEL, so a retired model is swapped without a code change. */
export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** A GoogleGenAI client authenticated with the base64 service-account key in GOOGLE_SERVICE_ACCOUNT_KEY. */
export function getGenAI(): GoogleGenAI {
  if (client) return client;

  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const encodedKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  if (!project || !encodedKey) {
    throw new Error("Gemini is not configured: set GOOGLE_CLOUD_PROJECT and GOOGLE_SERVICE_ACCOUNT_KEY.");
  }

  let credentials: { client_email?: string; private_key?: string };
  try {
    credentials = JSON.parse(Buffer.from(encodedKey, "base64").toString("utf8"));
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not base64-encoded service-account JSON.");
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email or private_key.");
  }

  client = new GoogleGenAI({
    vertexai: true,
    project,
    location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || DEFAULT_LOCATION,
    googleAuthOptions: {
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });
  return client;
}
