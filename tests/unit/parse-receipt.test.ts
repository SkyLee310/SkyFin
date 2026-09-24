import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mapReceiptOutput, parseReceipt } from "@/lib/ai/parse-receipt";
import { AiFailedError } from "@/lib/ai/parse-text";
import { jpegSize } from "@/lib/ai/fake";

const now = new Date("2026-09-21T04:00:00Z"); // 12:00 MYT

const categories = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Groceries", kind: "expense" as const, default_essential: true },
  { id: "22222222-2222-4222-8222-222222222222", name: "Food & Drinks", kind: "expense" as const, default_essential: true },
  { id: "33333333-3333-4333-8333-333333333333", name: "Others", kind: "expense" as const, default_essential: true },
  { id: "44444444-4444-4444-8444-444444444444", name: "Others", kind: "income" as const, default_essential: true },
];

const receipt = (fields: Record<string, unknown> = {}) => ({
  is_receipt: true,
  total_amount: 42.3,
  currency_is_rm: true,
  merchant: "99 Speedmart",
  date: "2026-09-20",
  suggested_category: "Groceries",
  suggested_is_essential: true,
  suggested_payment_method: "Cash",
  item_label: "Groceries",
  confidence: 0.93,
  ...fields,
});

const ctx = { categories, now };
const draftOf = (raw: unknown) => {
  const result = mapReceiptOutput(raw, ctx);
  if (!result.isReceipt) throw new Error("expected a receipt");
  return result.draft;
};

describe("mapReceiptOutput", () => {
  it("maps a receipt to an expense draft in sen", () => {
    expect(draftOf(receipt())).toMatchObject({
      type: "expense",
      amountSen: 4230,
      categoryId: categories[0]!.id,
      paymentMethod: "Cash",
      merchant: "99 Speedmart",
      itemLabel: "groceries",
      date: "2026-09-20",
      isEssential: true,
      confidence: 0.93,
      currencyWarning: false,
    });
  });

  it("reports a non-receipt without a draft", () => {
    expect(mapReceiptOutput({ is_receipt: false, total_amount: null, confidence: 0 }, ctx)).toEqual({
      isReceipt: false,
    });
  });

  it("flags a non-RM receipt but keeps the number (FR-14)", () => {
    expect(draftOf(receipt({ currency_is_rm: false, total_amount: 12 }))).toMatchObject({
      amountSen: 1200,
      currencyWarning: true,
    });
  });

  it("maps an unknown category to Others and only ever an expense category", () => {
    expect(draftOf(receipt({ suggested_category: "Hardware" })).categoryId).toBe(categories[2]!.id);
  });

  it("uses today for a missing or future date", () => {
    expect(draftOf(receipt({ date: null })).date).toBe("2026-09-21");
    expect(draftOf(receipt({ date: "2026-10-01" })).date).toBe("2026-09-21");
  });

  it("leaves payment unset when the receipt doesn't show it", () => {
    expect(draftOf(receipt({ suggested_payment_method: null })).paymentMethod).toBeNull();
  });

  it("clamps confidence into 0..1 and treats a missing one as 0", () => {
    expect(draftOf(receipt({ confidence: 1.4 })).confidence).toBe(1);
    expect(draftOf(receipt({ confidence: undefined })).confidence).toBe(0);
  });

  it("throws on a receipt without a usable total, so the caller retries", () => {
    for (const total_amount of [null, 0, -3, "n/a"]) {
      expect(() => mapReceiptOutput(receipt({ total_amount }), ctx)).toThrow();
    }
  });
});

describe("parseReceipt", () => {
  const image = new Uint8Array([0xff, 0xd8]);

  it("retries once, then succeeds", async () => {
    const model = vi.fn().mockResolvedValueOnce("{").mockResolvedValueOnce(JSON.stringify(receipt()));
    const result = await parseReceipt(image, ctx, model);
    expect(result.isReceipt).toBe(true);
    expect(model).toHaveBeenCalledTimes(2);
  });

  it("throws AiFailedError after two unusable answers", async () => {
    const model = vi.fn().mockResolvedValue(JSON.stringify(receipt({ total_amount: null })));
    await expect(parseReceipt(image, ctx, model)).rejects.toBeInstanceOf(AiFailedError);
  });

  it("sends today (MYT) and the expense category names only", async () => {
    const model = vi.fn().mockResolvedValue(JSON.stringify(receipt()));
    await parseReceipt(image, { categories, now: new Date("2026-09-21T23:30:00Z") }, model);
    const prompt = model.mock.calls[0]![1] as string;
    expect(prompt).toContain("2026-09-22");
    expect(prompt).toContain('["Groceries","Food & Drinks","Others"]');
  });
});

describe("jpegSize", () => {
  it("reads width and height from the SOF0 marker", () => {
    // SOI, an APP0 segment of length 4, then SOF0 with height 1000 and width 600.
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0xe8, 0x02, 0x58, 0x03,
    ]);
    expect(jpegSize(bytes)).toEqual({ width: 600, height: 1000 });
  });

  it("returns null for something that isn't a JPEG", () => {
    expect(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
