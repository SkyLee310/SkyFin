import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseReceipt } from "@/lib/ai/parse-receipt";
import { formatRM } from "@/lib/money";
import { PRESET_CATEGORIES, requireGeminiCredentials } from "./support";
import suite from "./receipts/expected.json";

// M4.11: paid Gemini calls, one per photo. Run with `npm run test:ai-eval`.

interface Case {
  file: string;
  totalSen: number;
}

describe("receipts (M4.11)", () => {
  it("reads at least 18 of 20 receipt totals exactly", async () => {
    requireGeminiCredentials();
    const cases = suite.cases as Case[];
    if (cases.length < 20) {
      throw new Error(`tests/ai-eval/receipts has ${cases.length} of 20 receipts; see its README.md.`);
    }

    const failures: string[] = [];
    for (const c of cases) {
      const image = new Uint8Array(readFileSync(join(__dirname, "receipts", c.file)));
      try {
        const result = await parseReceipt(image, { categories: PRESET_CATEGORIES });
        if (!result.isReceipt) failures.push(`✘ ${c.file}: read as not a receipt`);
        else if (result.draft.amountSen !== c.totalSen) {
          failures.push(
            `✘ ${c.file}: want ${formatRM(c.totalSen)}, got ${formatRM(result.draft.amountSen)} (confidence ${result.draft.confidence})`,
          );
        }
      } catch (error) {
        failures.push(`✘ ${c.file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const passed = cases.length - failures.length;
    console.log(`receipts: ${passed}/${cases.length} exact\n${failures.join("\n")}`);
    expect(passed).toBeGreaterThanOrEqual(18);
  }, 600_000);
});
