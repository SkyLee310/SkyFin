import { describe, expect, it } from "vitest";
import { cashFlow, microExpenses, summarizeExpenses, type StatRow } from "@/lib/stats";

// M5.12: a fixture month whose sums were worked out by hand, as SQL would:
//   select sum(amount) … group by category / payment_method / is_essential.
// Amounts arrive from PostgREST as JSON numbers (floats), as they do in the app.

const FOOD = "c-food";
const TRANSPORT = "c-transport";
const SHOPPING = "c-shopping";
const ALLOWANCE = "c-allowance";

function row(amount: number, fields: Partial<StatRow> = {}): StatRow {
  return {
    amount,
    type: "expense",
    category_id: FOOD,
    category_name: "Food & Drinks",
    payment_method: "Cash",
    is_essential: true,
    merchant: null,
    item_label: null,
    ...fields,
  };
}

const month: StatRow[] = [
  row(8.5, { item_label: "nasi lemak", payment_method: "eWallet" }),
  row(12.1, { item_label: "boba", is_essential: false, payment_method: "eWallet" }),
  row(9.2, { item_label: "boba", is_essential: false, payment_method: "Cash" }),
  row(8.7, { item_label: "Boba", is_essential: false, payment_method: "eWallet" }),
  row(0.1, { category_id: TRANSPORT, category_name: "Transport", payment_method: "Card" }),
  row(0.2, { category_id: TRANSPORT, category_name: "Transport", payment_method: "Card" }),
  row(15, { category_id: TRANSPORT, category_name: "Transport", merchant: "Grab" }),
  row(180, { category_id: SHOPPING, category_name: "Shopping", is_essential: false, merchant: "Shopee", payment_method: "Card" }),
  row(500, { type: "income", category_id: ALLOWANCE, category_name: "Allowance / PTPTN" }),
];

describe("summarizeExpenses on the fixture month", () => {
  const s = summarizeExpenses(month);

  it("totals every expense to the sen, and leaves income out (0.1 + 0.2 is 30 sen, not 30.000000000000004)", () => {
    // 8.50 + 12.10 + 9.20 + 8.70 + 0.10 + 0.20 + 15.00 + 180.00 = 233.80
    expect(s.totalSen).toBe(23380);
    expect(s.count).toBe(8);
  });

  it("splits Needs and Wants", () => {
    expect(s.needsSen).toBe(850 + 10 + 20 + 1500); // 23.80
    expect(s.wantsSen).toBe(1210 + 920 + 870 + 18000); // 210.00
    expect(s.needsSen + s.wantsSen).toBe(s.totalSen);
    expect(s.wantsPct).toBe(90); // 210.00 / 233.80 = 89.8%
  });

  it("sums by category, largest first, with whole-number shares", () => {
    expect(s.byCategory).toEqual([
      { categoryId: SHOPPING, name: "Shopping", sen: 18000, pct: 77 },
      { categoryId: FOOD, name: "Food & Drinks", sen: 3850, pct: 16 },
      { categoryId: TRANSPORT, name: "Transport", sen: 1530, pct: 7 },
    ]);
  });

  it("sums by payment method in a fixed order", () => {
    expect(s.byPayment).toEqual([
      { method: "Cash", sen: 920 + 1500, pct: 10 },
      { method: "eWallet", sen: 850 + 1210 + 870, pct: 13 },
      { method: "Card", sen: 10 + 20 + 18000, pct: 77 },
    ]);
    expect(s.byPayment.reduce((a, p) => a + p.sen, 0)).toBe(s.totalSen);
  });

  it("with no expenses: zeros and a null Wants share", () => {
    const empty = summarizeExpenses([row(500, { type: "income" })]);
    expect(empty).toMatchObject({ count: 0, totalSen: 0, wantsPct: null, byCategory: [] });
    expect(empty.byPayment.map((p) => p.sen)).toEqual([0, 0, 0]);
  });
});

describe("cashFlow", () => {
  it("is income minus expense, separate from the budget (F9-2)", () => {
    expect(cashFlow(month)).toEqual({ incomeSen: 50000, expenseSen: 23380, netSen: 26620 });
  });
});

describe("microExpenses", () => {
  it("groups by coalesce(merchant, item_label) case-insensitively: boba 3× in a week", () => {
    expect(microExpenses(month, 7)).toEqual([
      // 30.00 × 30 / 7 = 128.571… → 12857 sen
      { label: "boba", count: 3, totalSen: 3000, monthlySen: 12857 },
    ]);
  });

  it("PRD example: 4 boba for RM 34 in a week ≈ RM 146/month", () => {
    const boba = [8, 8.5, 8, 9.5].map((a) => row(a, { item_label: "boba", is_essential: false }));
    expect(microExpenses(boba, 7)).toEqual([{ label: "boba", count: 4, totalSen: 3400, monthlySen: 14571 }]);
  });

  it("ignores buys over RM 15, groups under 3, rows with no label, and income", () => {
    const rows = [
      row(15.01, { item_label: "mamak" }),
      row(5, { item_label: "mamak" }),
      row(5, { item_label: "mamak" }),
      row(3, {}),
      row(3, {}),
      row(3, {}),
      row(5, { type: "income", item_label: "tutor" }),
      row(5, { type: "income", item_label: "tutor" }),
      row(5, { type: "income", item_label: "tutor" }),
    ];
    expect(microExpenses(rows, 7)).toEqual([]);
  });

  it("merchant wins over item label", () => {
    const rows = [1, 2, 3].map((n) => row(n, { merchant: "Tealive", item_label: "boba" }));
    expect(microExpenses(rows, 30)[0]).toMatchObject({ label: "Tealive", count: 3, totalSen: 600, monthlySen: 600 });
  });
});
