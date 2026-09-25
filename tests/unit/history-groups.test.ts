import { describe, it, expect } from "vitest";
import { groupReceiptRows } from "@/lib/history-groups";

const row = (id: string, amount: number, group: string | null = null, extra: Record<string, unknown> = {}) => ({
  id,
  amount,
  type: "expense" as const,
  merchant: group ? "99 Speedmart" : null,
  receipt_url: group ? `u/${group}.jpg` : null,
  receipt_group_id: group,
  ...extra,
});

describe("groupReceiptRows", () => {
  it("collapses split rows into one receipt entry with their total, in place", () => {
    const entries = groupReceiptRows([row("a", 5), row("b", 30, "g1"), row("c", 12.3, "g1"), row("d", 8)]);
    expect(entries.map((e) => e.kind)).toEqual(["row", "receipt", "row"]);
    const receipt = entries[1]!;
    if (receipt.kind !== "receipt") throw new Error("expected a receipt group");
    expect(receipt.rows.map((r) => r.id)).toEqual(["b", "c"]);
    expect(receipt.totalSen).toBe(4230);
    expect(receipt.merchant).toBe("99 Speedmart");
    expect(receipt.receiptUrl).toBe("u/g1.jpg");
  });

  it("keeps two receipts apart", () => {
    const entries = groupReceiptRows([row("a", 1, "g1"), row("b", 2, "g2"), row("c", 3, "g1"), row("d", 4, "g2")]);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => (e.kind === "receipt" ? e.rows.map((r) => r.id) : []))).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
  });

  it("shows a group with a single remaining row as a plain row", () => {
    const entries = groupReceiptRows([row("a", 1, "g1")]);
    expect(entries).toEqual([{ kind: "row", row: expect.objectContaining({ id: "a" }) }]);
  });

  it("sums in sen, so float amounts don't drift", () => {
    const entries = groupReceiptRows([row("a", 0.1, "g"), row("b", 0.2, "g")]);
    expect(entries[0]!.kind === "receipt" && entries[0]!.totalSen).toBe(30);
  });
});
