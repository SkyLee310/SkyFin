// Money is integer sen in TypeScript and numeric(10,2) in Postgres (TECH_SPEC §1).
// This module is the only place that converts between the two.

/** numeric(10,2) holds at most RM 99,999,999.99. */
const MAX_NUMERIC_SEN = 9_999_999_999;

// Optional "RM", then ringgit with or without comma grouping, then up to 2 decimals.
const RM_INPUT = /^(?:rm)?\s*(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d{0,2}))?$/i;

/**
 * Parses what the user typed ("800", "800.5", "RM 1,234.50") into sen without
 * going through floating point. Returns null for anything else, including
 * negative amounts, more than 2 decimals and amounts numeric(10,2) cannot hold.
 */
export function parseRMToSen(input: string): number | null {
  const match = RM_INPUT.exec(input.trim());
  if (!match) return null;
  const ringgit = (match[1] ?? "").replaceAll(",", "");
  const fraction = match[2] ?? "";
  if (ringgit === "" && fraction === "") return null;
  const sen = Number(ringgit || "0") * 100 + Number(fraction.padEnd(2, "0"));
  return sen <= MAX_NUMERIC_SEN ? sen : null;
}

/**
 * Converts a numeric(10,2) value read from Postgres to sen. PostgREST sends
 * numeric as a JSON number, so 1.15 arrives as a float and must be rounded.
 */
export function numericToSen(value: number | string): number {
  const rm =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  const sen = Math.round(rm * 100);
  if (!Number.isSafeInteger(sen)) {
    throw new RangeError(`Not a numeric(10,2) amount: ${String(value)}`);
  }
  return sen;
}

/** Writes sen for a numeric(10,2) column: 80000 → "800.00". */
export function senToNumeric(sen: number): string {
  const { sign, ringgit, cents } = splitSen(sen);
  return `${sign}${ringgit}.${cents}`;
}

/** Displays sen as ringgit: 123450 → "RM 1,234.50", -4500 → "-RM 45.00". */
export function formatRM(sen: number): string {
  const { sign, ringgit, cents } = splitSen(sen);
  return `${sign}RM ${ringgit.replace(/\B(?=(\d{3})+$)/g, ",")}.${cents}`;
}

/** Splits integer sen into its sign, whole ringgit and two-digit sen, with integer arithmetic only. */
function splitSen(sen: number): { sign: string; ringgit: string; cents: string } {
  if (!Number.isSafeInteger(sen)) {
    throw new RangeError(`Expected a whole number of sen, got ${sen}`);
  }
  const abs = Math.abs(sen);
  const rem = abs % 100;
  return {
    sign: sen < 0 ? "-" : "",
    ringgit: String((abs - rem) / 100),
    cents: String(rem).padStart(2, "0"),
  };
}

/** Alias for numericToSen. */
export function toSen(rm: number | string): number {
  return numericToSen(rm);
}

/** Convert integer sen to RM float (e.g. 1250 -> 12.5). */
export function toRM(sen: number): number {
  return sen / 100;
}
