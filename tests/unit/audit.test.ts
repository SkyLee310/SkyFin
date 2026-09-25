import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildAuditStats, dedupKeyFor, fallbackText, previousPeriod, savingOptions, suggestBudget } from "@/lib/agents/audit";
import { type AuditContent, reportFigures, rmAmountsIn } from "@/lib/agents/audit-content";
import { mapAuditOutput, writeAuditText } from "@/lib/ai/audit";
import type { AuditPromptInput } from "@/lib/ai/prompts/audit";
import type { StatRow } from "@/lib/stats";

function row(amount: number, fields: Partial<StatRow> = {}): StatRow {
  return {
    amount,
    type: "expense",
    category_id: "food",
    category_name: "Food & Drinks",
    payment_method: "eWallet",
    is_essential: true,
    merchant: null,
    item_label: null,
    ...fields,
  };
}

// The M7 demo week: 4 text-logged boba (no merchant), plus meals and a Grab ride.
const week: StatRow[] = [
  ...[8, 8.5, 8, 9.5].map((a) => row(a, { item_label: "boba", is_essential: false })),
  row(12, { item_label: "nasi lemak" }),
  row(20, { item_label: "grab ride", category_id: "transport", category_name: "Transport" }),
];
const lastWeek: StatRow[] = [row(30, { is_essential: false }), row(30)];

describe("buildAuditStats", () => {
  const stats = buildAuditStats(week, lastWeek, 7);
  it("lists boba as a micro-expense with a monthly projection (F12-1)", () => {
    expect(stats.micro_expenses).toEqual([{ label: "boba", count: 4, total_sen: 3400, monthly_sen: 14571 }]);
  });
  it("has totals, Needs vs Wants, top 3 categories and the previous period", () => {
    expect(stats).toMatchObject({
      count: 6,
      total_sen: 6600,
      needs_sen: 3200,
      wants_sen: 3400,
      wants_pct: 52,
      top_categories: [
        { name: "Food & Drinks", sen: 4600, pct: 70 },
        { name: "Transport", sen: 2000, pct: 30 },
      ],
      previous: { total_sen: 6000, wants_pct: 50 },
    });
  });
  it("has no previous period when that period had no expenses", () => {
    expect(buildAuditStats(week, [], 7).previous).toBeNull();
  });
});

describe("savingOptions", () => {
  const stats = buildAuditStats(week, [], 7);
  const options = savingOptions(week, stats, 7);
  it("starts with the micro-expense, then wants, then categories, then everyday habits", () => {
    expect(options.map((o) => o.id)).toEqual(["micro:0", "wants:food", "category:transport", "no-spend", "check"]);
  });
  it("halves the micro-expense's monthly cost and scales the rest to a 30-day month", () => {
    expect(options[0]).toMatchObject({ label: "boba", savingSen: 7286 }); // 145.71 / 2
    expect(options[1]).toMatchObject({ label: "Food & Drinks", savingSen: 4371 }); // 34 × 30/7 × 0.3
    expect(options.find((o) => o.id === "no-spend")!.savingSen).toBe(1414); // 66 × 30/7 × 0.05
  });
  it("always offers at least 3, even for one small expense", () => {
    const one = [row(10)];
    expect(savingOptions(one, buildAuditStats(one, [], 7), 7).length).toBeGreaterThanOrEqual(3);
  });
});

describe("suggestBudget", () => {
  it.each([
    // needs, wants, budget, expected
    [40000, 30000, 80000, 67000], // 400 + 270 = 670
    [60000, 50000, 80000, 96000], // 1,050 → capped at 120% of 800
    [10000, 10000, 80000, 64000], // 190 → at least 80% of 800
    [40000, 30000, 0, 67000], // no budget: no clamp
    [12345, 0, 0, 13000], // RM 123.45 rounds up to RM 130
  ])("needs %i + wants %i with budget %i → %i", (needs, wants, budget, expected) => {
    expect(suggestBudget(needs, wants, budget)).toBe(expected);
  });
});

describe("dedup keys and periods", () => {
  it("weekly:<monday>, monthly:<yyyy-mm>", () => {
    expect(dedupKeyFor("weekly", { start: "2026-09-21" })).toBe("weekly:2026-09-21");
    expect(dedupKeyFor("monthly", { start: "2026-09-01" })).toBe("monthly:2026-09");
  });
  it("the previous period is the week before, or the whole month before", () => {
    expect(previousPeriod("weekly", { start: "2026-09-21", end: "2026-09-27" })).toEqual({ start: "2026-09-14", end: "2026-09-20" });
    expect(previousPeriod("monthly", { start: "2026-03-01", end: "2026-03-31" })).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

describe("fallbackText", () => {
  const stats = buildAuditStats(week, [], 7);
  const options = savingOptions(week, stats, 7);
  it("writes exactly 3 template tips and a headline in the user's language", () => {
    for (const lang of ["en", "zh", "ms"] as const) {
      const text = fallbackText(options, stats, lang);
      expect(text.tips).toHaveLength(3);
      expect(text.headline).toContain("RM 66.00");
    }
    expect(fallbackText(options, stats, "en").tips[0]!.title).toBe("Halve the boba runs");
    expect(fallbackText(options, stats, "zh").tips[0]!.title).toBe("boba 减半");
  });
});

describe("rmAmountsIn", () => {
  it("normalises RM amounts written different ways", () => {
    expect(rmAmountsIn("boba RM34, rm 145.7 and RM 1,234.50; RM8.5")).toEqual([
      "RM 34.00",
      "RM 145.70",
      "RM 1,234.50",
      "RM 8.50",
    ]);
  });
});

describe("mapAuditOutput", () => {
  const ids = ["micro:0", "wants:food", "no-spend", "check"];
  const allowed = new Set(["RM 34.00"]);
  const tip = (option_id: string, detail = "Try the mamak.") => ({ option_id, title: "Tip", detail });
  const valid = { headline: "Boba ran the week.", tips: [tip("micro:0"), tip("wants:food"), tip("no-spend")] };

  it("accepts 3 tips on 3 known options", () => {
    expect(mapAuditOutput(valid, ids, allowed).tips.map((t) => t.optionId)).toEqual(["micro:0", "wants:food", "no-spend"]);
  });
  it("rejects 2 or 4 tips, repeated options and unknown options", () => {
    expect(() => mapAuditOutput({ ...valid, tips: valid.tips.slice(0, 2) }, ids, allowed)).toThrow();
    expect(() => mapAuditOutput({ ...valid, tips: [...valid.tips, tip("check")] }, ids, allowed)).toThrow();
    expect(() => mapAuditOutput({ ...valid, tips: [tip("micro:0"), tip("micro:0"), tip("check")] }, ids, allowed)).toThrow();
    expect(() => mapAuditOutput({ ...valid, tips: [tip("micro:0"), tip("x"), tip("check")] }, ids, allowed)).toThrow();
  });
  it("rejects an RM figure the stats don't have, and allows one they do", () => {
    expect(() => mapAuditOutput({ ...valid, headline: "You spent RM 99 on boba." }, ids, allowed)).toThrow(/RM 99.00/);
    expect(mapAuditOutput({ ...valid, headline: "Boba cost RM34." }, ids, allowed).headline).toBe("Boba cost RM34.");
  });
});

describe("writeAuditText", () => {
  const prompt: AuditPromptInput = {
    language: "en",
    kind: "weekly",
    period: { start: "2026-09-21", end: "2026-09-27" },
    stats: {},
    options: ["a", "b", "c"].map((id) => ({ id, kind: "check", label: id, monthly_saving: "RM 1.00" })),
    rows: [],
  };
  const good = JSON.stringify({
    headline: "Fine week.",
    tips: ["a", "b", "c"].map((option_id) => ({ option_id, title: "t", detail: "d" })),
  });

  it("retries once after a bad answer", async () => {
    const model = vi.fn().mockResolvedValueOnce("not json").mockResolvedValueOnce(good);
    await expect(writeAuditText(prompt, new Set(), model)).resolves.toMatchObject({ headline: "Fine week." });
    expect(model).toHaveBeenCalledTimes(2);
  });
  it("returns null after two bad answers, so the caller writes the stats-only report", async () => {
    const model = vi.fn().mockResolvedValue(JSON.stringify({ headline: "x", tips: [] }));
    await expect(writeAuditText(prompt, new Set(), model)).resolves.toBeNull();
    expect(model).toHaveBeenCalledTimes(2);
  });
});

describe("reportFigures", () => {
  it("covers every figure a report shows, including the absolute change", () => {
    const content = {
      stats: { ...buildAuditStats(week, lastWeek, 7) },
      tips: [{ title: "", detail: "", saving_sen: 7286 }],
      budget: { suggested_budget_sen: 67000, previous_budget_sen: 80000, for_month: "2026-10" },
    } as unknown as AuditContent;
    const figures = reportFigures(content);
    for (const f of ["RM 66.00", "RM 32.00", "RM 34.00", "RM 145.71", "RM 60.00", "RM 6.00", "RM 72.86", "RM 670.00", "RM 800.00"]) {
      expect(figures).toContain(f);
    }
  });
});
