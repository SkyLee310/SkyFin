import { describe, expect, it } from "vitest";
import { daysLeftInMonthMYT, isLastDayOfMonthMYT, monthRangeMYT, todayMYT } from "@/lib/dates";

// MYT is UTC+8 all year, so 16:00Z is midnight in Kuala Lumpur.

it("runs with the process clock in UTC, as on Vercel", () => {
  // Otherwise a helper that reads local time would still pass on a machine set to MYT.
  expect(new Date("2026-09-21T16:01:00Z").getDate()).toBe(21);
});

describe("todayMYT", () => {
  it.each([
    ["2026-09-21T15:59:00Z", "2026-09-21"], // 23:59 MYT
    ["2026-09-21T16:00:00Z", "2026-09-22"], // 00:00 MYT
    ["2026-09-21T16:01:00Z", "2026-09-22"], // 00:01 MYT
    ["2026-09-21T23:59:00Z", "2026-09-22"], // 07:59 MYT; still the 21st in UTC
    ["2026-12-31T15:59:00Z", "2026-12-31"],
    ["2026-12-31T16:01:00Z", "2027-01-01"],
  ])("at %s it is %s in MYT", (iso, expected) => {
    expect(todayMYT(new Date(iso))).toBe(expected);
  });
});

describe("monthRangeMYT", () => {
  it.each([
    ["2026-09-15", { start: "2026-09-01", end: "2026-09-30", day: 15, daysInMonth: 30 }],
    ["2026-01-31", { start: "2026-01-01", end: "2026-01-31", day: 31, daysInMonth: 31 }],
    ["2026-02-01", { start: "2026-02-01", end: "2026-02-28", day: 1, daysInMonth: 28 }],
    ["2028-02-29", { start: "2028-02-01", end: "2028-02-29", day: 29, daysInMonth: 29 }],
    ["2100-02-10", { start: "2100-02-01", end: "2100-02-28", day: 10, daysInMonth: 28 }],
    ["2026-12-31", { start: "2026-12-01", end: "2026-12-31", day: 31, daysInMonth: 31 }],
  ])("for the MYT date %s", (date, expected) => {
    expect(monthRangeMYT(date)).toEqual(expected);
  });

  it.each([
    ["2026-09-30T15:59:00Z", { start: "2026-09-01", end: "2026-09-30", day: 30, daysInMonth: 30 }],
    ["2026-09-30T16:01:00Z", { start: "2026-10-01", end: "2026-10-31", day: 1, daysInMonth: 31 }],
    ["2026-12-31T16:01:00Z", { start: "2027-01-01", end: "2027-01-31", day: 1, daysInMonth: 31 }],
  ])("for the instant %s uses its MYT date", (iso, expected) => {
    expect(monthRangeMYT(new Date(iso))).toEqual(expected);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-09-00", "2026-9-1", "2026/09/01", "", "not a date"])(
    "rejects %j",
    (date) => {
      expect(() => monthRangeMYT(date)).toThrow(RangeError);
    },
  );
});

describe("daysLeftInMonthMYT", () => {
  it.each([
    ["2026-09-01T00:00:00Z", 30], // 08:00 MYT on 1 Sep
    ["2026-09-21T04:00:00Z", 10], // 21 to 30 Sep
    ["2026-09-30T15:59:00Z", 1], // the last day counts itself
    ["2026-09-30T16:01:00Z", 31], // 00:01 MYT on 1 Oct
    ["2026-02-28T04:00:00Z", 1],
  ])("at %s is %i", (iso, expected) => {
    expect(daysLeftInMonthMYT(new Date(iso))).toBe(expected);
  });
});

describe("isLastDayOfMonthMYT", () => {
  it.each([
    ["2026-09-30T15:59:00Z", true], // 23:59 MYT on 30 Sep
    ["2026-09-30T16:01:00Z", false], // 00:01 MYT on 1 Oct
    ["2026-09-29T16:01:00Z", true], // 00:01 MYT on 30 Sep; still the 29th in UTC
    ["2026-02-28T04:00:00Z", true],
    ["2028-02-28T04:00:00Z", false],
  ])("at %s is %s", (iso, expected) => {
    expect(isLastDayOfMonthMYT(new Date(iso))).toBe(expected);
  });
});
