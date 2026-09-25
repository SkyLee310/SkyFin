const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "15 Sep – 21 Sep 2026" for two business dates. */
export function formatPeriod(start: string, end: string): string {
  const part = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
  return `${part(start)} – ${part(end)} ${end.slice(0, 4)}`;
}

/** "September 2026" for "2026-09". */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year!, month! - 1, 1)),
  );
}
