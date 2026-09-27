import { describe, expect, it } from "vitest";
import { newestEntryScroll } from "@/components/chat/message-list";

// M8.13: the chat scrolls its newest entry into view, but not while it has none: on arrival
// that scroll only nudged the empty page up. An explicit smooth scroll ignores the stylesheet's
// Reduce Motion rule, so under Reduce Motion the scroll is instant.

describe("newestEntryScroll", () => {
  it.each([false, true])("doesn't scroll an empty list (Reduce Motion %s)", (reduceMotion) => {
    expect(newestEntryScroll(0, false, reduceMotion)).toBeNull();
  });

  it.each([
    [1, false],
    [4, true],
    [0, true], // the typing indicator alone
  ])("glides to the end with %i messages, pending %s", (messageCount, pending) => {
    expect(newestEntryScroll(messageCount, pending, false)).toEqual({ behavior: "smooth", block: "end" });
  });

  it("jumps to the end under Reduce Motion", () => {
    expect(newestEntryScroll(2, true, true)).toEqual({ behavior: "auto", block: "end" });
  });
});
