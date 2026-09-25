import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The eval calls Vertex AI with the credentials in .env.local (D22).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Paid Gemini calls: run only when changing a model or prompt, or when asked.
// A separate config (not merged with vitest.config.mts) so plain `vitest` never picks these up.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/ai-eval/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 60_000,
  },
});
