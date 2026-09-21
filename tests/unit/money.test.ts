import { describe, expect, it } from "vitest";
import { formatRM, numericToSen, parseRMToSen, senToNumeric } from "@/lib/money";

describe("parseRMToSen", () => {
  it.each([
    ["800", 80000],
    ["800.5", 80050],
    ["800.50", 80050],
    ["1.15", 115],
    ["0.29", 29],
    ["0.01", 1],
    ["0", 0],
    [".5", 50],
    ["800.", 80000],
    [" 800 ", 80000],
    ["1,234", 123400],
    ["RM 1,234.50", 123450],
    ["rm1,234.50", 123450],
    ["99,999,999.99", 9999999999],
  ])("parses %j as %i sen", (input, expected) => {
    expect(parseRMToSen(input)).toBe(expected);
  });

  it.each([
    "",
    " ",
    ".",
    "RM",
    "-5",
    "RM -5",
    "+5",
    "5.123",
    "12,50",
    "1,2345",
    "1 234",
    "1e3",
    "abc",
    "100000000", // RM 100,000,000 does not fit numeric(10,2)
  ])("rejects %j", (input) => {
    expect(parseRMToSen(input)).toBeNull();
  });
});

describe("numericToSen", () => {
  it.each([
    [1.15, 115], // 1.15 * 100 is 114.99999999999999 in floating point
    [0.29, 29],
    [1234.5, 123450],
    [0, 0],
    [99999999.99, 9999999999],
    ["800.00", 80000],
    ["-45.00", -4500],
  ])("converts %j to %i sen", (value, expected) => {
    expect(numericToSen(value)).toBe(expected);
  });

  it.each(["", "  ", "abc", Number.NaN, Number.POSITIVE_INFINITY, 1e20, null])(
    "throws on %j",
    (value) => {
      expect(() => numericToSen(value as number)).toThrow();
    },
  );
});

describe("senToNumeric", () => {
  it.each([
    [80000, "800.00"],
    [123450, "1234.50"],
    [5, "0.05"],
    [0, "0.00"],
    [-4500, "-45.00"],
    [-5, "-0.05"],
    [9999999999, "99999999.99"],
  ])("writes %i sen as %j", (sen, expected) => {
    expect(senToNumeric(sen)).toBe(expected);
  });

  it.each([12.5, Number.NaN])("throws on non-integer sen %j", (sen) => {
    expect(() => senToNumeric(sen)).toThrow();
  });
});

describe("formatRM", () => {
  it.each([
    [123450, "RM 1,234.50"],
    [0, "RM 0.00"],
    [5, "RM 0.05"],
    [99999, "RM 999.99"],
    [100000, "RM 1,000.00"],
    [100000000, "RM 1,000,000.00"],
    [9999999999, "RM 99,999,999.99"],
    [-4500, "-RM 45.00"],
    [-123450, "-RM 1,234.50"],
    [-0, "RM 0.00"],
  ])("formats %i sen as %j", (sen, expected) => {
    expect(formatRM(sen)).toBe(expected);
  });

  it.each([12.5, Number.NaN])("throws on non-integer sen %j", (sen) => {
    expect(() => formatRM(sen)).toThrow();
  });
});
