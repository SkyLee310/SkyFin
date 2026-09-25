import { addDaysMYT, daysBetweenMYT, isMonthEndMYT, monthRangeMYT, shiftMonth, weekdayMYT } from "@/lib/dates";

// What the daily cron owes on a given MYT date (TECH_SPEC §3.3). Jobs are date-based and
// idempotent (dedup_key), and each has a short back-fill window, so a run that Vercel Hobby
// starts late or skips is made up by the next one without surprising the user days later.

/** How many days after its due date a missed job may still run. */
export const BACKFILL_DAYS = 2;

export interface Period {
  start: string;
  end: string;
}

export interface DailySchedule {
  /** The Mon–Sun week whose audit is due (Sunday evening, D9). */
  weekly: Period | null;
  /** The month whose review is due (last day of the month, D9). */
  monthly: Period | null;
  /** "YYYY-MM" of the month whose suggested budget should be applied now (the 1st, D19). */
  applyBudgetFor: string | null;
}

export function dailySchedule(today: string): DailySchedule {
  // Weekly: the latest Sunday on or before today.
  const sunday = addDaysMYT(today, -weekdayMYT(today));
  const weekly = daysBetweenMYT(sunday, today) <= BACKFILL_DAYS ? { start: addDaysMYT(sunday, -6), end: sunday } : null;

  // Monthly: this month on its last day, else last month during the first days of this one.
  const { day } = monthRangeMYT(today);
  let monthly: Period | null = null;
  if (isMonthEndMYT(today)) {
    const range = monthRangeMYT(today);
    monthly = { start: range.start, end: range.end };
  } else if (day <= BACKFILL_DAYS) {
    const range = monthRangeMYT(`${shiftMonth(today.slice(0, 7), -1)}-01`);
    monthly = { start: range.start, end: range.end };
  }

  const applyBudgetFor = day <= BACKFILL_DAYS + 1 ? today.slice(0, 7) : null;
  return { weekly, monthly, applyBudgetFor };
}
