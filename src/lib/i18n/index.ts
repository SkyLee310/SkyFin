import type { Lang } from "@/lib/validation/schemas";
import { en, type Messages } from "./en";
import { ms } from "./ms";
import { zh } from "./zh";

const BY_LANG: Record<Lang, Messages> = { en, zh, ms };

/** The template set for a profile's preferred_language; anything unknown falls back to English. */
export function messages(lang: string | null | undefined): Messages {
  return BY_LANG[lang as Lang] ?? en;
}

/** "October" / "十月" / "Oktober" for a "YYYY-MM" month, in the language's locale. */
export function monthName(yearMonth: string, lang: string | null | undefined): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat(messages(lang).locale, { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year!, month! - 1, 1)),
  );
}

export type { Messages };
