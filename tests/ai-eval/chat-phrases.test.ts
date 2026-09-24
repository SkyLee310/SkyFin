import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseText } from "@/lib/ai/parse-text";
import type { Draft } from "@/lib/validation/schemas";
import { PRESET_CATEGORIES, requireGeminiCredentials } from "./support";
import suite from "./chat-phrases.json";

// M3.9: paid Gemini calls (one per case, two with a setup). Run with `npm run test:ai-eval`.

interface ExpectedDraft {
  type?: "expense" | "income";
  amountSen?: number;
  category?: string;
  paymentMethod?: string | null;
  isEssential?: boolean;
  date?: string;
}

interface Case {
  phrase: string;
  setup?: string;
  language: string | null;
  drafts: ExpectedDraft[];
}

const now = new Date(`${suite.today}T04:00:00Z`); // noon MYT
const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
const context = { categories: PRESET_CATEGORIES, now };
const nameOf = (id: string) => PRESET_CATEGORIES.find((c) => c.id === id)?.name;

function mismatches(expected: ExpectedDraft, actual: Draft): string[] {
  const out: string[] = [];
  const check = (field: string, want: unknown, got: unknown) => {
    if (want !== undefined && want !== got) out.push(`${field}: want ${String(want)}, got ${String(got)}`);
  };
  check("type", expected.type, actual.type);
  check("amountSen", expected.amountSen, actual.amountSen);
  check("category", expected.category, nameOf(actual.categoryId));
  check("paymentMethod", expected.paymentMethod, actual.paymentMethod);
  check("isEssential", expected.isEssential, actual.isEssential);
  const date = expected.date === "today" ? suite.today : expected.date === "yesterday" ? yesterday : expected.date;
  check("date", date, actual.date);
  return out;
}

describe("chat phrases (M3.9)", () => {
  it("parses at least 27 of 30 phrases as expected", async () => {
    requireGeminiCredentials();
    const cases = suite.cases as Case[];
    const failures: string[] = [];

    for (const c of cases) {
      try {
        const sessionDrafts = c.setup
          ? (await parseText(c.setup, { ...context, sessionDrafts: [] })).drafts
          : [];
        const result = await parseText(c.phrase, { ...context, sessionDrafts });
        const problems: string[] = [];
        if (c.language && result.language !== c.language) {
          problems.push(`language: want ${c.language}, got ${result.language}`);
        }
        if (result.drafts.length !== c.drafts.length) {
          problems.push(`drafts: want ${c.drafts.length}, got ${result.drafts.length}`);
        } else {
          c.drafts.forEach((want, i) => problems.push(...mismatches(want, result.drafts[i]!).map((p) => `#${i + 1} ${p}`)));
        }
        if (problems.length) failures.push(`✘ ${c.phrase}\n    ${problems.join("\n    ")}`);
      } catch (error) {
        failures.push(`✘ ${c.phrase}\n    ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const passed = cases.length - failures.length;
    console.log(`chat phrases: ${passed}/${cases.length} passed\n${failures.join("\n")}`);
    expect(passed).toBeGreaterThanOrEqual(27);
  }, 600_000);
});
