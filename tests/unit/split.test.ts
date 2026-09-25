import { describe, it, expect } from "vitest";
import { isSplitComplete, remainingSen, type SplitRow } from "@/components/confirmation-card/split";

const row = (amountSen: number, categoryId = "c1"): SplitRow => ({
  key: crypto.randomUUID(),
  amountSen,
  categoryId,
  isEssential: true,
});

describe("receipt split", () => {
  it("RM 42.30 splits into RM 30.00 + RM 12.30 with exactly RM 0.00 left (F6-1, F6-2)", () => {
    const rows = [row(3000), row(1230)];
    expect(remainingSen(4230, rows)).toBe(0);
    expect(isSplitComplete(4230, rows)).toBe(true);
  });

  it("stays incomplete while anything is left or over", () => {
    expect(remainingSen(4230, [row(3000), row(1229)])).toBe(1);
    expect(isSplitComplete(4230, [row(3000), row(1229)])).toBe(false);
    expect(remainingSen(4230, [row(3000), row(1300)])).toBe(-70);
    expect(isSplitComplete(4230, [row(3000), row(1300)])).toBe(false);
  });

  it("needs two rows, each with an amount and a category", () => {
    expect(isSplitComplete(4230, [row(4230)])).toBe(false);
    expect(isSplitComplete(4230, [row(4230), row(0)])).toBe(false);
    expect(isSplitComplete(4230, [row(3000), row(1230, "")])).toBe(false);
  });

  it("never drifts on amounts that are awkward in floating point", () => {
    // 0.1 + 0.2 !== 0.3 in floats; in sen it is exact.
    expect(remainingSen(30, [row(10), row(20)])).toBe(0);
  });
});
