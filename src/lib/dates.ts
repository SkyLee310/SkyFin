import { tz } from "@date-fns/tz";
import { format } from "date-fns";

// Business dates are MYT calendar dates as "YYYY-MM-DD" strings (TECH_SPEC §1).
// Vercel runs in UTC, so a date read off new Date() is a day behind from 00:00 to 08:00 MYT.

const MYT = tz("Asia/Kuala_Lumpur");
const BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date in Kuala Lumpur, e.g. "2026-09-21". */
export function todayMYT(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd", { in: MYT });
}

/**
 * The calendar month containing `at`, which is either a MYT business date
 * ("2026-09-15") or an instant, taken at its MYT date. `end` is the last day
 * of the month (inclusive); `day` and `daysInMonth` are d and D in PRD §8.1.
 */
export function monthRangeMYT(at: Date | string = new Date()): {
  start: string;
  end: string;
  day: number;
  daysInMonth: number;
} {
  const date = typeof at === "string" ? at : todayMYT(at);
  const match = BUSINESS_DATE.exec(date);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  const daysInMonth = month >= 1 && month <= 12 ? daysInMonthOf(year, month) : 0;
  if (!(day >= 1 && day <= daysInMonth)) {
    throw new RangeError(`Not a YYYY-MM-DD calendar date: ${JSON.stringify(date)}`);
  }
  const yearMonth = date.slice(0, 7);
  return { start: `${yearMonth}-01`, end: `${yearMonth}-${daysInMonth}`, day, daysInMonth };
}

/** Days left in the MYT month, counting today, so the last day has 1 (D − d + 1). */
export function daysLeftInMonthMYT(now: Date = new Date()): number {
  const { day, daysInMonth } = monthRangeMYT(now);
  return daysInMonth - day + 1;
}

/** Whether today is the last day of the month in MYT, when the monthly audit runs (D9). */
export function isLastDayOfMonthMYT(now: Date = new Date()): boolean {
  const { day, daysInMonth } = monthRangeMYT(now);
  return day === daysInMonth;
}

function daysInMonthOf(year: number, month: number): number {
  if (month === 2) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Whether dateStr (YYYY-MM-DD) is strictly after today in MYT. */
export function isFutureDateMYT(dateStr: string, now: Date = new Date()): boolean {
  return dateStr > todayMYT(now);
}
