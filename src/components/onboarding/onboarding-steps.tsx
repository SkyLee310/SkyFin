"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, Loader2, Share, SquarePlus, X } from "lucide-react";
import { type EnableResult, enableNotifications, isIOS, isStandalone, pushSupported } from "@/lib/push-client";

// First run after the budget (PRD §9, F15): in Safari the app shows Add-to-Home-Screen steps and
// never a notification prompt; opened from the Home Screen it offers notifications, asking the
// system only after a tap.

type Step = "install" | "notify" | null;

const DISMISSED = { install: "skyfin:install-dismissed", notify: "skyfin:notify-dismissed" } as const;

function wasDismissed(step: Exclude<Step, null>): boolean {
  try {
    return localStorage.getItem(DISMISSED[step]) === "1";
  } catch {
    return false;
  }
}

function currentStep(): Step {
  if (isStandalone()) {
    return pushSupported() && Notification.permission === "default" && !wasDismissed("notify") ? "notify" : null;
  }
  return isIOS() && !wasDismissed("install") ? "install" : null;
}

const noSubscribe = () => () => {};

export function OnboardingSteps() {
  // Read once on the client; the server render shows nothing.
  const detected = useSyncExternalStore(noSubscribe, currentStep, () => null);
  const [hidden, setHidden] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<EnableResult | null>(null);

  const step = hidden ? null : detected;
  if (!step) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED[step], "1");
    } catch {
      // Storage blocked: hide for this visit only.
    }
    setHidden(true);
  };

  if (step === "install") {
    return (
      <section id="install-step" className="relative p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sky-950">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide install steps"
          className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center opacity-60"
        >
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold pr-8">Add SkyFin to your Home Screen</h2>
        <p className="text-xs mt-1 opacity-80">Warnings and your Sunday audit can reach you only from the Home Screen app.</p>
        <ol className="flex flex-col gap-2 mt-3 text-sm">
          <li className="flex items-center gap-2">
            <Share className="w-4 h-4 flex-shrink-0" aria-hidden /> 1. Tap Share in Safari&apos;s toolbar.
          </li>
          <li className="flex items-center gap-2">
            <SquarePlus className="w-4 h-4 flex-shrink-0" aria-hidden /> 2. Choose &ldquo;Add to Home Screen&rdquo;, then Add.
          </li>
          <li className="flex items-center gap-2">
            <Bell className="w-4 h-4 flex-shrink-0" aria-hidden /> 3. Open SkyFin from the new icon to turn on alerts.
          </li>
        </ol>
      </section>
    );
  }

  return (
    <section id="notify-step" className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950">
      <h2 className="text-sm font-bold">Get warned before the money runs out</h2>
      <p className="text-xs mt-1 opacity-80">
        At most one budget alert an evening, plus your weekly audit on Sunday.
      </p>
      {result === "denied" ? (
        <p className="text-xs mt-3 font-medium">
          Notifications are off. You can turn them on in Settings → Notifications → SkyFin; warnings still show in the app.
        </p>
      ) : result === "failed" || result === "unsupported" ? (
        <p className="text-xs mt-3 font-medium">Couldn&apos;t turn on notifications. Warnings still show in the app.</p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[44px] rounded-xl bg-white/80 border border-emerald-200 text-sm font-semibold"
        >
          Not now
        </button>
        <button
          type="button"
          id="btn-enable-notifications"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const outcome = await enableNotifications();
            setPending(false);
            setResult(outcome);
            if (outcome === "enabled") setHidden(true);
          }}
          className="min-h-[44px] rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          Enable notifications
        </button>
      </div>
    </section>
  );
}
