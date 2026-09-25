"use client";

import { useSyncExternalStore } from "react";

// iOS Safari doesn't shrink the layout viewport for the on-screen keyboard, so anything fixed to
// the bottom of the screen ends up behind it. The visual viewport does shrink: the keyboard
// covers whatever lies below its bottom edge.

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  viewport.addEventListener("resize", onChange);
  viewport.addEventListener("scroll", onChange);
  return () => {
    viewport.removeEventListener("resize", onChange);
    viewport.removeEventListener("scroll", onChange);
  };
}

function snapshot(): number {
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}

/** Pixels at the bottom of the layout viewport hidden by the keyboard (0 when it's closed). */
export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
