import { describe, it, expect } from "vitest";
import {
  Draft,
  SaveInput,
  PaymentMethod,
  CreateCategorySchema,
  RenameCategorySchema,
  ArchiveCategorySchema,
} from "@/lib/validation/schemas";

describe("PaymentMethod", () => {
  it("accepts Cash, eWallet, and Card", () => {
    expect(PaymentMethod.parse("Cash")).toBe("Cash");
    expect(PaymentMethod.parse("eWallet")).toBe("eWallet");
    expect(PaymentMethod.parse("Card")).toBe("Card");
  });

  it("rejects invalid payment methods", () => {
    expect(() => PaymentMethod.parse("crypto")).toThrow();
  });
});

describe("Draft Schema", () => {
  const validDraft = {
    clientId: "123e4567-e89b-12d3-a456-426614174000",
    type: "expense" as const,
    amountSen: 1250, // RM 12.50
    categoryId: "123e4567-e89b-12d3-a456-426614174001",
    paymentMethod: "eWallet" as const,
    merchant: "Food Court",
    itemLabel: "nasi lemak",
    note: "lunch with friends",
    date: "2026-09-21",
    isEssential: true,
  };

  it("validates a complete valid draft", () => {
    const result = Draft.parse(validDraft);
    expect(result.amountSen).toBe(1250);
    expect(result.type).toBe("expense");
    expect(result.paymentMethod).toBe("eWallet");
  });

  it("allows nullable merchant, itemLabel, note, and paymentMethod in draft stage", () => {
    const draft = {
      ...validDraft,
      merchant: null,
      itemLabel: null,
      note: null,
      paymentMethod: null,
    };
    const result = Draft.parse(draft);
    expect(result.paymentMethod).toBeNull();
    expect(result.merchant).toBeNull();
  });

  it("rejects zero or negative amount", () => {
    expect(() =>
      Draft.parse({
        ...validDraft,
        amountSen: 0,
      })
    ).toThrow();

    expect(() =>
      Draft.parse({
        ...validDraft,
        amountSen: -500,
      })
    ).toThrow();
  });

  it("rejects floating point amounts (must be integer sen)", () => {
    expect(() =>
      Draft.parse({
        ...validDraft,
        amountSen: 12.5,
      })
    ).toThrow();
  });

  it("rejects future dates beyond today MYT", () => {
    // Tomorrow or far future
    expect(() =>
      Draft.parse({
        ...validDraft,
        date: "2099-01-01",
      })
    ).toThrow();
  });

  it("rejects invalid date formats", () => {
    expect(() =>
      Draft.parse({
        ...validDraft,
        date: "21-09-2026",
      })
    ).toThrow();
  });
});

describe("SaveInput Schema", () => {
  const validDraftWithPayment = {
    clientId: "123e4567-e89b-12d3-a456-426614174000",
    type: "expense" as const,
    amountSen: 1250,
    categoryId: "123e4567-e89b-12d3-a456-426614174001",
    paymentMethod: "eWallet" as const,
    merchant: "Store",
    itemLabel: null,
    note: null,
    date: "2026-09-21",
    isEssential: true,
  };

  it("accepts drafts with paymentMethod set", () => {
    const input = {
      drafts: [validDraftWithPayment],
      receiptPath: null,
    };
    const result = SaveInput.parse(input);
    expect(result.drafts).toHaveLength(1);
    expect(result.receiptPath).toBeNull();
  });

  it("rejects saving when paymentMethod is null/missing (M2.12 requirement)", () => {
    const draftWithoutPayment = {
      ...validDraftWithPayment,
      paymentMethod: null,
    };
    expect(() =>
      SaveInput.parse({
        drafts: [draftWithoutPayment],
        receiptPath: null,
      })
    ).toThrow();
  });

  it("rejects empty drafts array", () => {
    expect(() =>
      SaveInput.parse({
        drafts: [],
        receiptPath: null,
      })
    ).toThrow();
  });

  it("rejects more than 20 drafts", () => {
    const drafts = Array(21).fill(validDraftWithPayment);
    expect(() =>
      SaveInput.parse({
        drafts,
        receiptPath: null,
      })
    ).toThrow();
  });
});

describe("Category Schemas", () => {
  it("validates CreateCategorySchema", () => {
    const valid = {
      name: "Printing",
      kind: "expense" as const,
      defaultEssential: true,
    };
    expect(CreateCategorySchema.parse(valid).name).toBe("Printing");

    expect(() =>
      CreateCategorySchema.parse({
        name: "",
        kind: "expense",
      })
    ).toThrow();

    expect(() =>
      CreateCategorySchema.parse({
        name: "a".repeat(41),
        kind: "expense",
      })
    ).toThrow();
  });

  it("validates RenameCategorySchema", () => {
    expect(
      RenameCategorySchema.parse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Books & Printing",
      }).name
    ).toBe("Books & Printing");
  });

  it("validates ArchiveCategorySchema", () => {
    expect(
      ArchiveCategorySchema.parse({
        id: "123e4567-e89b-12d3-a456-426614174000",
      }).id
    ).toBe("123e4567-e89b-12d3-a456-426614174000");
  });
});
