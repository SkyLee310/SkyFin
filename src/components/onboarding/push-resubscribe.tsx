"use client";

import { useEffect } from "react";
import { isStandalone, pushSupported, syncSubscription } from "@/lib/push-client";

// M6.9: on each app open, a device that already allowed notifications re-sends its subscription,
// so one dropped by the push service (or never stored) is restored without asking again.
export function PushResubscribe() {
  useEffect(() => {
    if (!pushSupported() || !isStandalone() || Notification.permission !== "granted") return;
    try {
      if (sessionStorage.getItem("skyfin:push-synced")) return;
      sessionStorage.setItem("skyfin:push-synced", "1");
    } catch {
      // Storage blocked: sync anyway.
    }
    syncSubscription().catch((error) => console.error("push resubscribe", error));
  }, []);
  return null;
}
