import { numericToSen } from "@/lib/money";
import type { PaymentMethod } from "@/lib/validation/schemas";

// Figures for the Dashboard charts and the audits (PRD §8.2, §9), summed in integer sen from the
// period's rows. Pure, so every total is unit-tested against a fixture month; the model never
// computes a figure.

export interface StatRow {
  amount: number | string;
  type: "expense" | "income";
  category_id: string;
  category_name: string;
  payment_method: PaymentMethod;
  is_essential: boolean;
  merchant?: string | null;
  item_label?: string | null;
}

export interface CategoryStat {
  categoryId: string;
  name: string;
  sen: number;
  /** Whole-number share of total expenses. */
  pct: number;
}

export interface PaymentStat {
  method: PaymentMethod;
  sen: number;
  pct: number;
}

export interface ExpenseSummary {
  count: number;
  totalSen: number;
  needsSen: number;
  wantsSen: number;
  /** Wants share of expenses, 0–100; null with no expenses. */
  wantsPct: number | null;
  /** Largest first. */
  byCategory: CategoryStat[];
  /** Always Cash, eWallet, Card, in that order. */
  byPayment: PaymentStat[];
}

export interface CashFlow {
  incomeSen: number;
  expenseSen: number;
  netSen: number;
}

export interface MicroExpense {
  label: string;
  count: number;
  totalSen: number;
  /** totalSen scaled to a 30-day month. */
  monthlySen: number;
}

const METHODS: PaymentMethod[] = ["Cash", "eWallet", "Card"];

/** Micro-expenses are small repeat buys: each ≤ RM 15, at least 3 in the period (PRD §8.2). */
export const MICRO_MAX_SEN = 1500;
export const MICRO_MIN_COUNT = 3;

export function pctOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part * 100) / whole) : 0;
}

export function summarizeExpenses(rows: StatRow[]): ExpenseSummary {
  const expenses = rows.filter((r) => r.type === "expense");
  let totalSen = 0;
  let needsSen = 0;
  const categories = new Map<string, CategoryStat>();
  const payments = new Map<PaymentMethod, number>(METHODS.map((m) => [m, 0]));

  for (const row of expenses) {
    const sen = numericToSen(row.amount);
    totalSen += sen;
    if (row.is_essential) needsSen += sen;
    const category = categories.get(row.category_id) ?? {
      categoryId: row.category_id,
      name: row.category_name,
      sen: 0,
      pct: 0,
    };
    category.sen += sen;
    categories.set(row.category_id, category);
    payments.set(row.payment_method, (payments.get(row.payment_method) ?? 0) + sen);
  }

  const wantsSen = totalSen - needsSen;
  return {
    count: expenses.length,
    totalSen,
    needsSen,
    wantsSen,
    wantsPct: totalSen > 0 ? pctOf(wantsSen, totalSen) : null,
    byCategory: [...categories.values()]
      .map((c) => ({ ...c, pct: pctOf(c.sen, totalSen) }))
      .sort((a, b) => b.sen - a.sen || a.name.localeCompare(b.name)),
    byPayment: METHODS.map((method) => {
      const sen = payments.get(method) ?? 0;
      return { method, sen, pct: pctOf(sen, totalSen) };
    }),
  };
}

export function cashFlow(rows: Pick<StatRow, "amount" | "type">[]): CashFlow {
  let incomeSen = 0;
  let expenseSen = 0;
  for (const row of rows) {
    if (row.type === "income") incomeSen += numericToSen(row.amount);
    else expenseSen += numericToSen(row.amount);
  }
  return { incomeSen, expenseSen, netSen: incomeSen - expenseSen };
}

/**
 * Expenses grouped by coalesce(merchant, item_label), case-insensitively, counting only those of
 * RM 15 or less; a group with at least 3 is a micro-expense. Largest monthly cost first.
 */
export function microExpenses(
  rows: Pick<StatRow, "amount" | "type" | "merchant" | "item_label">[],
  periodDays: number,
): MicroExpense[] {
  const groups = new Map<string, MicroExpense>();
  for (const row of rows) {
    if (row.type !== "expense") continue;
    const label = (row.merchant ?? row.item_label ?? "").trim();
    const sen = numericToSen(row.amount);
    if (!label || sen > MICRO_MAX_SEN) continue;
    const key = label.toLowerCase();
    const group = groups.get(key) ?? { label, count: 0, totalSen: 0, monthlySen: 0 };
    group.count += 1;
    group.totalSen += sen;
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((g) => g.count >= MICRO_MIN_COUNT)
    .map((g) => ({ ...g, monthlySen: Math.round((g.totalSen * 30) / periodDays) }))
    .sort((a, b) => b.monthlySen - a.monthlySen || a.label.localeCompare(b.label));
}
