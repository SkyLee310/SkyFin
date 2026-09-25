import { describe, expect, it } from "vitest";
import { addDaysMYT, isMonthEndMYT, shiftMonth, weekdayMYT, daysBetweenMYT } from "@/lib/dates";
import { dailySchedule } from "@/lib/jobs/schedule";

describe("month-end detection (M7.10)", () => {
  it.each([
    ["2026-02-28", true], // February, common year
    ["2026-02-27", false],
    ["2028-02-28", false], // leap year: the 29th is the last day
    ["2028-02-29", true],
    ["2100-02-28", true], // divisible by 100, not 400: not a leap year
    ["2000-02-29", true], // divisible by 400: leap
    ["2026-04-30", true], // 30-day months
    ["2026-06-30", true],
    ["2026-09-30", true],
    ["2026-11-30", true],
    ["2026-09-29", false],
    ["2026-01-31", true], // 31-day months
    ["2026-03-31", true],
    ["2026-07-31", true],
    ["2026-08-31", true],
    ["2026-12-31", true],
    ["2026-08-30", false],
  ])("%s → %s", (date, expected) => {
    expect(isMonthEndMYT(date)).toBe(expected);
  });

  it("the monthly review is due on each month's last day, covering the whole month", () => {
    expect(dailySchedule("2026-02-28").monthly).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(dailySchedule("2028-02-29").monthly).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(dailySchedule("2028-02-28").monthly).toBeNull();
    expect(dailySchedule("2026-09-30").monthly).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(dailySchedule("2026-12-31").monthly).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(dailySchedule("2026-12-30").monthly).toBeNull();
  });
});

describe("date helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addDaysMYT("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysMYT("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDaysMYT("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("knows the weekday (0 = Sunday)", () => {
    expect(weekdayMYT("2026-09-27")).toBe(0);
    expect(weekdayMYT("2026-09-21")).toBe(1);
  });
  it("shifts months across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-09", 0)).toBe("2026-09");
  });
  it("counts days between dates", () => {
    expect(daysBetweenMYT("2026-09-21", "2026-09-27")).toBe(6);
  });
});

describe("dailySchedule", () => {
  it("Sunday: the Mon–Sun week just ending", () => {
    expect(dailySchedule("2026-09-27").weekly).toEqual({ start: "2026-09-21", end: "2026-09-27" });
  });

  it("back-fills a missed Sunday for 2 days, then gives up", () => {
    expect(dailySchedule("2026-09-28").weekly).toEqual({ start: "2026-09-21", end: "2026-09-27" });
    expect(dailySchedule("2026-09-29").weekly).toEqual({ start: "2026-09-21", end: "2026-09-27" });
    expect(dailySchedule("2026-09-30").weekly).toBeNull();
    expect(dailySchedule("2026-09-26").weekly).toBeNull(); // Saturday
  });

  it("the 1st applies this month's budget and back-fills last month's review", () => {
    expect(dailySchedule("2026-10-01")).toMatchObject({
      applyBudgetFor: "2026-10",
      monthly: { start: "2026-09-01", end: "2026-09-30" },
    });
    expect(dailySchedule("2026-03-02").monthly).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(dailySchedule("2026-10-03")).toMatchObject({ applyBudgetFor: "2026-10", monthly: null });
    expect(dailySchedule("2026-10-04").applyBudgetFor).toBeNull();
  });
});
