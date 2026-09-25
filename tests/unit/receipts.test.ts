import { describe, it, expect } from "vitest";
import { isOwnReceiptPath, newReceiptPath } from "@/lib/receipts";

const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("isOwnReceiptPath", () => {
  it("accepts {uid}/{uuid}.jpg in the user's own folder", () => {
    expect(isOwnReceiptPath(newReceiptPath(userA), userA)).toBe(true);
  });

  it("rejects another user's folder", () => {
    expect(isOwnReceiptPath(newReceiptPath(userB), userA)).toBe(false);
  });

  it("rejects traversal, nesting, other extensions and non-strings", () => {
    for (const path of [
      `${userA}/../${userB}/11111111-1111-4111-8111-111111111111.jpg`,
      `${userA}/x/11111111-1111-4111-8111-111111111111.jpg`,
      `${userA}/11111111-1111-4111-8111-111111111111.png`,
      `${userA}/receipt.jpg`,
      `/${userA}/11111111-1111-4111-8111-111111111111.jpg`,
      null,
      42,
    ]) {
      expect(isOwnReceiptPath(path, userA)).toBe(false);
    }
  });
});
