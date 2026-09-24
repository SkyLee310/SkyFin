// Shared by the AI eval suites: the preset categories a new account gets (0001_init.sql), with
// fixed ids, and a guard that fails fast without Vertex AI credentials.

const PRESETS: [string, "expense" | "income", boolean][] = [
  ["Food & Drinks", "expense", true],
  ["Groceries", "expense", true],
  ["Transport", "expense", true],
  ["Education", "expense", true],
  ["Rent & Utilities", "expense", true],
  ["Phone & Internet", "expense", true],
  ["Health", "expense", true],
  ["Shopping", "expense", false],
  ["Entertainment", "expense", false],
  ["Subscriptions", "expense", false],
  ["Others", "expense", true],
  ["Allowance / PTPTN", "income", true],
  ["Scholarship", "income", true],
  ["Part-time", "income", true],
  ["Family", "income", true],
  ["Others", "income", true],
];

export const PRESET_CATEGORIES = PRESETS.map(([name, kind, default_essential], i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name,
  kind,
  default_essential,
}));

export function requireGeminiCredentials() {
  if (!process.env.GOOGLE_CLOUD_PROJECT || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("AI eval needs GOOGLE_CLOUD_PROJECT and GOOGLE_SERVICE_ACCOUNT_KEY in .env.local.");
  }
}
