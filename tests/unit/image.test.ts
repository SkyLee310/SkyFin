import { describe, it, expect, vi } from "vitest";
import { encodeUnderTarget, fitWithin } from "@/lib/image";

describe("fitWithin", () => {
  it("shrinks the long edge to 1600 px and keeps the aspect ratio", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  });

  it("never enlarges a small photo", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("encodeUnderTarget", () => {
  const blobOf = (size: number) => new Blob([new Uint8Array(size)], { type: "image/jpeg" });

  it("stops at the first quality under the target", async () => {
    const encode = vi.fn(async (q: number) => blobOf(q > 0.7 ? 1_200_000 : 900_000));
    const blob = await encodeUnderTarget(encode);
    expect(blob.size).toBe(900_000);
    expect(encode.mock.calls.map(([q]) => q)).toEqual([0.85, 0.75, 0.65]);
  });

  it("accepts the smallest result when it still fits the 2 MB bucket", async () => {
    expect((await encodeUnderTarget(async () => blobOf(1_500_000))).size).toBe(1_500_000);
  });

  it("refuses a result over the bucket limit", async () => {
    await expect(encodeUnderTarget(async () => blobOf(3_000_000))).rejects.toThrow("too large");
  });
});
