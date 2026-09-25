import { describe, expect, it } from "vitest";
import { evaluatePace, warningMessage, type PaceInput } from "@/lib/agents/accounting";

// PRD §8.1 rules, one table per rule. d = day of month, D = days in month, B = budget,
// S = expenses so far, S′ = S minus one-off rows. September has 30 days.

const B = 80000; // RM 800

function run(spentSen: number, today: string, extra: Partial<PaceInput> = {}) {
  return evaluatePace({ budgetSen: B, spentSen, spentExcludedSen: 0, today, ...extra });
}
const keys = (r: ReturnType<typeof evaluatePace>) => r.warnings.map((w) => w.dedupKey);
const levels = (r: ReturnType<typeof evaluatePace>) => r.warnings.map((w) => w.level);

describe("evaluatePace", () => {
  it("F10-1: RM 400 of RM 800 by day 10 of 30 → pace 1.5, out of cash on day 20", () => {
    const r = run(40000, "2026-09-10");
    expect(r.pace).toBeCloseTo(1.5);
    expect(r.outOfCashDay).toBe(20);
    expect(r.projectedSpendSen).toBe(120000);
    // Pace 1.5 ≥ 1.30 is critical (D15, D32); crossing 50% also fires info.
    expect(keys(r)).toEqual(["pace:critical:2026-09-10", "threshold:50:2026-09"]);
  });

  it("B = 0: no pace, no projection, no warnings (F2-2)", () => {
    const r = evaluatePace({ budgetSen: 0, spentSen: 50000, spentExcludedSen: 0, today: "2026-09-10" });
    expect(r).toEqual({ pace: null, projectedSpendSen: null, outOfCashDay: null, exceeded: false, warnings: [] });
  });

  it("S = 0: on track, pace 0, no warnings (F9-4)", () => {
    const r = run(0, "2026-09-15");
    expect(r.pace).toBe(0);
    expect(r.outOfCashDay).toBeNull();
    expect(r.exceeded).toBe(false);
    expect(r.warnings).toEqual([]);
  });

  it("on pace (1.0) is on track with no pace warning", () => {
    const r = run(40000, "2026-09-15"); // exactly half by mid-month
    expect(r.pace).toBeCloseTo(1);
    expect(r.outOfCashDay).toBe(30);
    expect(levels(r)).toEqual(["info"]);
  });

  it("a projection that reaches B after month end reads On track (null)", () => {
    const r = run(10000, "2026-09-10");
    expect(r.outOfCashDay).toBeNull();
  });

  describe("pace boundaries (D15)", () => {
    // Day 20 of 30: expected spend is 800 × 20/30 = RM 533.33…; pace = S / 533.33.
    it.each([
      // spentSen, expected level
      [61332, null], // pace 1.14998
      [61334, "warning"], // pace 1.150013 — 613.34 × 30 × 100 ≥ 115 × 800 × 20
      [69332, "warning"], // 1.29998
      [69334, "critical"], // 1.30001
    ])("S = %i sen on day 20 → %s", (spent, level) => {
      const r = run(spent, "2026-09-20");
      const pace = r.warnings.find((w) => w.kind === "pace");
      expect(pace?.level ?? null).toBe(level);
    });

    it("exactly 1.15 fires warning and exactly 1.30 fires critical (integer maths, no float drift)", () => {
      // D = 30, d = 3, B = RM 100: expected RM 10.00; 1.15 → RM 11.50, 1.30 → RM 13.00.
      const at = (spent: number) =>
        evaluatePace({ budgetSen: 10000, spentSen: spent, spentExcludedSen: 0, today: "2026-09-03" }).warnings.find(
          (w) => w.kind === "pace",
        )?.level;
      expect(at(1149)).toBeUndefined();
      expect(at(1150)).toBe("warning");
      expect(at(1299)).toBe("warning");
      expect(at(1300)).toBe("critical");
    });

    it("a pace warning's dedup key is per day, so each level fires at most once a day", () => {
      expect(keys(run(61334, "2026-09-20"))).toContain("pace:warning:2026-09-20");
      expect(keys(run(65000, "2026-09-21"))).toContain("pace:warning:2026-09-21");
    });
  });

  describe("days 1–2 suppression", () => {
    it.each([
      ["2026-09-01", 23999, false], // 29.99% on day 1: quiet
      ["2026-09-02", 23999, false],
      ["2026-09-01", 24000, true], // 30% on day 1: pace warnings allowed
      ["2026-09-03", 10000, true], // day 3: pace 1.25 → warning
    ])("%s with S = %i sen → pace warning %s", (today, spent, fires) => {
      const r = run(spent, today);
      expect(r.warnings.some((w) => w.kind === "pace")).toBe(fires);
    });
  });

  describe("threshold crossings (50 / 80 / 100%)", () => {
    it.each([
      [39999, []],
      [40000, ["threshold:50:2026-09"]],
      [63999, ["threshold:50:2026-09"]],
      [64000, ["threshold:80:2026-09", "threshold:50:2026-09"]],
      [79999, ["threshold:80:2026-09", "threshold:50:2026-09"]],
      [80000, ["threshold:100:2026-09", "threshold:80:2026-09", "threshold:50:2026-09"]],
    ])("S = %i sen → %j", (spent, expected) => {
      // Late in the month so pace stays under 1.15 and only thresholds fire.
      const r = run(spent, "2026-09-30");
      expect(r.warnings.filter((w) => w.kind === "threshold").map((w) => w.dedupKey)).toEqual(expected);
    });

    it("thresholds carry the month in their key: once per month, even if crossed again", () => {
      expect(keys(run(40000, "2026-09-30"))).toContain("threshold:50:2026-09");
      expect(keys(run(40000, "2026-10-31"))).toContain("threshold:50:2026-10");
    });

    it("levels: 50% info, 80% warning, 100% critical; S ≥ B marks exceeded", () => {
      const r = run(80000, "2026-09-30");
      expect(r.warnings.filter((w) => w.kind === "threshold").map((w) => w.level)).toEqual(["critical", "warning", "info"]);
      expect(r.exceeded).toBe(true);
      expect(r.outOfCashDay).toBe(30);
    });
  });

  describe("spike (≥ 20% of B in one expense)", () => {
    const expense = (amountSen: number) => ({ id: "t1", amountSen, where: "Shopee" });
    it.each([
      [15999, false],
      [16000, true],
      [18000, true],
    ])("a new expense of %i sen → spike %s", (amount, fires) => {
      const r = run(amount, "2026-09-15", { newExpenses: [expense(amount)] });
      expect(r.warnings.some((w) => w.kind === "spike")).toBe(fires);
    });

    it("the spike comes first, keyed by transaction, with its share of the budget", () => {
      const r = run(18000, "2026-09-15", { newExpenses: [expense(18000)] });
      expect(r.warnings[0]).toMatchObject({ kind: "spike", dedupKey: "spike:t1", pct: 23, amountSen: 18000 });
    });

    it("no spike without a budget", () => {
      const r = evaluatePace({ budgetSen: 0, spentSen: 18000, spentExcludedSen: 0, today: "2026-09-15", newExpenses: [expense(18000)] });
      expect(r.warnings).toEqual([]);
    });
  });

  describe("excluded (one-off) rows (D16)", () => {
    it("leave the pace average but still count toward S and the projection", () => {
      // Day 10: RM 220 regular + RM 180 one-off. Pace uses S′ = 220 only.
      const withSpike = run(40000, "2026-09-10");
      const oneOff = run(40000, "2026-09-10", { spentExcludedSen: 18000 });
      expect(withSpike.pace).toBeCloseTo(1.5);
      expect(oneOff.pace).toBeCloseTo(22000 / ((80000 * 10) / 30)); // 0.825
      expect(oneOff.projectedSpendSen).toBe(66000 + 18000);
      // 180 + 22x ≥ 800 → day 29 instead of day 20: "Yes" improves the projection.
      expect(withSpike.outOfCashDay).toBe(20);
      expect(oneOff.outOfCashDay).toBe(29);
      expect(oneOff.warnings.map((w) => w.kind)).toEqual(["threshold"]); // 50% still counts S
    });

    it("the out-of-cash day counts one-offs as already spent", () => {
      // S′ = RM 300 by day 10, one-off RM 200: 200 + 30x ≥ 800 → x = 20.
      const r = run(50000, "2026-09-10", { spentExcludedSen: 20000 });
      expect(r.outOfCashDay).toBe(20);
    });
  });
});

describe("warningMessage", () => {
  const input = (spentSen: number, today: string) => ({ budgetSen: B, spentSen, today });
  const message = (spentSen: number, today: string, lang: string, extra: Partial<PaceInput> = {}) => {
    const full = { budgetSen: B, spentSen, spentExcludedSen: 0, today, ...extra };
    const r = evaluatePace(full);
    return r.warnings.map((w) => warningMessage(w, r, input(spentSen, today), lang));
  };

  it("uses the PRD §8.1 templates in English", () => {
    expect(message(40000, "2026-09-14", "en")).toEqual(["Half your RM 800.00 budget is used, 17 days left."]);
    expect(message(40000, "2026-09-10", "en")[0]).toBe(
      "You're spending 50% faster than planned. At this pace you run out on the 20th.",
    );
    expect(message(84500, "2026-09-30", "en")[0]).toBe("Budget exceeded by RM 45.00. Consider a no-spend weekend.");
    expect(message(18000, "2026-09-15", "en", { newExpenses: [{ id: "t", amountSen: 18000, where: "Shopee" }] })[0]).toBe(
      "RM 180.00 at Shopee is 23% of this month's budget. Is this a one-off purchase?",
    );
  });

  it("writes Chinese and Malay from preferred_language, and English for anything else", () => {
    expect(message(40000, "2026-09-14", "zh")[0]).toBe("本月预算 RM 800.00 已用掉一半，还剩 17 天。");
    expect(message(40000, "2026-09-14", "ms")[0]).toContain("Separuh daripada bajet RM 800.00");
    expect(message(40000, "2026-09-14", "xx")[0]).toContain("Half your");
  });

  it("uses ordinals 1st, 2nd, 3rd, 11th, 21st, 22nd, 23rd", async () => {
    const { en } = await import("@/lib/i18n/en");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map((d) => en.warning.pace(20, d).match(/the (\w+)\./)![1])).toEqual(
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"],
    );
  });
});
