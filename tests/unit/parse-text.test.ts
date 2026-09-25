import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiFailedError, mapTextOutput, parseText } from "@/lib/ai/parse-text";
import { modelAmountToSen, normalizeDate } from "@/lib/ai/normalize";
import type { Draft } from "@/lib/validation/schemas";

// 2026-09-21 12:00 MYT
const now = new Date("2026-09-21T04:00:00Z");

const categories = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Food & Drinks", kind: "expense" as const, default_essential: true },
  { id: "22222222-2222-4222-8222-222222222222", name: "Transport", kind: "expense" as const, default_essential: true },
  { id: "33333333-3333-4333-8333-333333333333", name: "Others", kind: "expense" as const, default_essential: true },
  { id: "44444444-4444-4444-8444-444444444444", name: "Shopping", kind: "expense" as const, default_essential: false },
  { id: "55555555-5555-4555-8555-555555555555", name: "Allowance / PTPTN", kind: "income" as const, default_essential: true },
  { id: "66666666-6666-4666-8666-666666666666", name: "Others", kind: "income" as const, default_essential: true },
];

const modelDraft = (fields: Record<string, unknown> = {}) => ({
  client_id: null,
  type: "expense",
  amount: 8.5,
  category: "Food & Drinks",
  payment_method: "eWallet",
  merchant: null,
  item_label: "nasi lemak",
  note: null,
  date: "2026-09-21",
  is_essential: true,
  ...fields,
});

const output = (drafts: unknown[], extra: Record<string, unknown> = {}) => ({
  reply: "Okay",
  language: "ms",
  drafts,
  ...extra,
});

const ctx = (sessionDrafts: Draft[] = []) => ({ categories, sessionDrafts, now });

describe("mapTextOutput", () => {
  it("maps a model draft to a Draft in sen with the matching category id", () => {
    const { drafts, language } = mapTextOutput(output([modelDraft()]), ctx());
    expect(language).toBe("ms");
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!).toMatchObject({
      type: "expense",
      amountSen: 850,
      categoryId: categories[0]!.id,
      paymentMethod: "eWallet",
      itemLabel: "nasi lemak",
      date: "2026-09-21",
      isEssential: true,
    });
  });

  it("maps an unknown category to Others of the same kind", () => {
    const { drafts } = mapTextOutput(
      output([modelDraft({ category: "Boba Shops" }), modelDraft({ type: "income", category: "Lottery" })]),
      ctx(),
    );
    expect(drafts[0]!.categoryId).toBe(categories[2]!.id);
    expect(drafts[1]!.categoryId).toBe(categories[5]!.id);
  });

  it("matches category names case-insensitively", () => {
    const { drafts } = mapTextOutput(output([modelDraft({ category: "food & drinks" })]), ctx());
    expect(drafts[0]!.categoryId).toBe(categories[0]!.id);
  });

  it("leaves an unknown payment method unset so the card forces a choice", () => {
    const { drafts } = mapTextOutput(
      output([modelDraft({ payment_method: null }), modelDraft({ payment_method: "TNG" })]),
      ctx(),
    );
    expect(drafts.map((d) => d.paymentMethod)).toEqual([null, null]);
  });

  it("clamps a future or malformed date to today (MYT)", () => {
    const { drafts } = mapTextOutput(
      output([modelDraft({ date: "2026-09-22" }), modelDraft({ date: "yesterday" }), modelDraft({ date: "2026-09-20" })]),
      ctx(),
    );
    expect(drafts.map((d) => d.date)).toEqual(["2026-09-21", "2026-09-21", "2026-09-20"]);
  });

  it("forces income to count as essential", () => {
    const { drafts } = mapTextOutput(
      output([modelDraft({ type: "income", category: "Allowance / PTPTN", amount: 500, is_essential: false })]),
      ctx(),
    );
    expect(drafts[0]!).toMatchObject({ type: "income", amountSen: 50000, isEssential: true });
  });

  it("applies a correction to the session draft with that client_id and keeps the others", () => {
    const first = mapTextOutput(
      output([modelDraft(), modelDraft({ amount: 12, item_label: "boba", is_essential: false })]),
      ctx(),
    ).drafts;
    const boba = first[1]!;

    const { drafts } = mapTextOutput(
      output([modelDraft({ client_id: boba.clientId, amount: 13, item_label: "boba", is_essential: false })]),
      ctx(first),
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0]!).toEqual(first[0]!);
    expect(drafts[1]!).toMatchObject({ clientId: boba.clientId, amountSen: 1300, isEssential: false });
  });

  it("treats a client_id that is not in the session as a new draft", () => {
    const { drafts } = mapTextOutput(
      output([modelDraft({ client_id: "99999999-9999-4999-8999-999999999999" })]),
      ctx(),
    );
    expect(drafts[0]!.clientId).not.toBe("99999999-9999-4999-8999-999999999999");
  });

  it("returns the session drafts unchanged when the message logs nothing", () => {
    const session = mapTextOutput(output([modelDraft()]), ctx()).drafts;
    const result = mapTextOutput(output([], { language: "en", reply: "See Dashboard" }), ctx(session));
    expect(result.drafts).toEqual(session);
    expect(result.reply).toBe("See Dashboard");
  });

  it("rejects zero, negative and non-numeric amounts", () => {
    for (const amount of [0, -5, "abc"]) {
      expect(() => mapTextOutput(output([modelDraft({ amount })]), ctx())).toThrow();
    }
  });

  it("rejects a language outside en / zh / ms", () => {
    expect(() => mapTextOutput(output([], { language: "fr" }), ctx())).toThrow();
  });
});

describe("parseText", () => {
  it("retries once when the first response is not valid JSON", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(JSON.stringify(output([modelDraft()])));
    const result = await parseText("nasi lemak 8.50", { categories, sessionDrafts: [], now }, model);
    expect(model).toHaveBeenCalledTimes(2);
    expect(result.drafts[0]!.amountSen).toBe(850);
  });

  it("throws AiFailedError after two bad responses", async () => {
    const model = vi.fn().mockResolvedValue(JSON.stringify(output([modelDraft({ amount: 0 })])));
    await expect(parseText("x", { categories, sessionDrafts: [], now }, model)).rejects.toBeInstanceOf(
      AiFailedError,
    );
    expect(model).toHaveBeenCalledTimes(2);
  });

  it("sends today in MYT, the category names and the session drafts to the model", async () => {
    const model = vi.fn().mockResolvedValue(JSON.stringify(output([])));
    const session = mapTextOutput(output([modelDraft()]), ctx()).drafts;
    // 2026-09-21 23:30 UTC is already the 22nd in MYT.
    await parseText("hi", { categories, sessionDrafts: session, now: new Date("2026-09-21T23:30:00Z") }, model);
    const prompt = model.mock.calls[0]![0];
    expect(prompt.today).toBe("2026-09-22");
    expect(prompt.expenseCategories).toContain("Food & Drinks");
    expect(prompt.incomeCategories).toContain("Allowance / PTPTN");
    expect(prompt.sessionDrafts[0]).toMatchObject({
      client_id: session[0]!.clientId,
      amount: "8.50",
      category: "Food & Drinks",
    });
  });
});

describe("normalize helpers", () => {
  it("converts model RM amounts to sen without float drift", () => {
    expect(modelAmountToSen(1.15)).toBe(115);
    expect(modelAmountToSen("RM 1,234.50")).toBe(123450);
    expect(modelAmountToSen(0.004)).toBeNull();
  });

  it("rejects impossible calendar dates", () => {
    expect(normalizeDate("2026-02-30", now)).toBe("2026-09-21");
  });
});
