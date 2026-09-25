import "server-only";

import { todayMYT } from "@/lib/dates";
import type { PaymentMethod } from "@/lib/validation/schemas";

// Turns loosely typed model fields into Draft fields. Shared by parse-text and parse-receipt so
// both follow TECH_SPEC §5.4 the same way.

export interface CategoryRef {
  id: string;
  name: string;
  kind: "expense" | "income";
  default_essential: boolean;
}

const MAX_AMOUNT_SEN = 99_999_999;
const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** RM from the model (8.5, "8.50", "RM 1,234.50") → sen, or null if it isn't a positive amount. */
export function modelAmountToSen(amount: unknown): number | null {
  const rm =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
        ? Number(amount.replace(/^\s*rm\s*/i, "").replaceAll(",", ""))
        : Number.NaN;
  if (!Number.isFinite(rm)) return null;
  const sen = Math.round(rm * 100);
  return sen > 0 && sen <= MAX_AMOUNT_SEN ? sen : null;
}

/**
 * The active category the model named, matched case-insensitively. Anything else maps to
 * "Others" of the same kind (FR-22, F7-3). Null only if the user has no category of that kind.
 */
export function matchCategory(
  name: unknown,
  kind: "expense" | "income",
  categories: CategoryRef[],
): CategoryRef | null {
  const ofKind = categories.filter((c) => c.kind === kind);
  const wanted = typeof name === "string" ? name.trim().toLowerCase() : "";
  return (
    ofKind.find((c) => c.name.toLowerCase() === wanted) ??
    ofKind.find((c) => c.name === "Others") ??
    ofKind[0] ??
    null
  );
}

/** A model date as a MYT business date: missing, malformed or future dates become today (FR-4). */
export function normalizeDate(date: unknown, now: Date = new Date()): string {
  const today = todayMYT(now);
  if (typeof date !== "string" || !BUSINESS_DATE.test(date)) return today;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return today;
  return date > today ? today : date;
}

export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  return value === "Cash" || value === "eWallet" || value === "Card" ? value : null;
}

/** Trimmed text cut to the Draft schema's limit, or null when empty. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, max).trim();
  return text === "" ? null : text;
}
