// M3.1: confirms GEMINI_MODEL answers on Vertex AI in GOOGLE_CLOUD_LOCATION (D22).
// One paid call. Run with `npm run check:gemini`, which loads .env.local.
import { GoogleGenAI } from "@google/genai";

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const encodedKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (!project || !encodedKey) {
  console.error("Set GOOGLE_CLOUD_PROJECT and GOOGLE_SERVICE_ACCOUNT_KEY in .env.local first.");
  process.exit(1);
}

const credentials = JSON.parse(Buffer.from(encodedKey, "base64").toString("utf8"));
const ai = new GoogleGenAI({
  vertexai: true,
  project,
  location,
  googleAuthOptions: { credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] },
});

try {
  const response = await ai.models.generateContent({ model, contents: "Reply with the single word OK." });
  console.log(`${model} in ${location} answered: ${response.text?.trim()}`);
} catch (error) {
  console.error(`${model} in ${location} failed:`, error instanceof Error ? error.message : error);
  process.exit(1);
}
