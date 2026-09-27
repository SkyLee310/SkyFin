"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, Loader2, Share, SquarePlus, X } from "lucide-react";
import { type EnableResult, enableNotifications, isIOS, isStandalone, pushSupported } from "@/lib/push-client";

// First run after the budget (PRD §9, F15): in Safari the app shows Add-to-Home-Screen steps and
// never a notification prompt; opened from the Home Screen it offers notifications, asking the
// system only after a tap.

type Step = "install" | "notify" | null;

const DISMISSED = { install: "skyfin:install-dismissed", notify: "skyfin:notify-dismissed" } as const;

const INSTALL_STEPS = [
  { Icon: Share, text: "Tap Share in Safari's toolbar." },
  { Icon: SquarePlus, text: "Choose “Add to Home Screen”, then Add." },
  { Icon: Bell, text: "Open SkyFin from the new icon to turn on alerts." },
];

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
      <section id="install-step" className="relative rounded-[22px] bg-surface p-5 text-ink shadow-card">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide install steps"
          className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full text-ink-muted"
        >
          <X aria-hidden className="size-4" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-info">Get set up</p>
        <h2 className="mt-1 pr-10 text-base font-bold tracking-tight">Add SkyFin to your Home Screen</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Warnings and your Sunday audit can reach you only from the Home Screen app.
        </p>
        <ol role="list" className="mt-4 flex flex-col gap-2 text-sm">
          {INSTALL_STEPS.map(({ Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-sunken p-2.5">
              <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-surface text-info">
                <Icon aria-hidden className="size-4" />
              </span>
              <span>
                <span className="font-semibold tabular-nums">{i + 1}.</span> {text}
              </span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section id="notify-step" className="rounded-[22px] bg-surface p-5 text-ink shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Bell aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight">Get warned before the money runs out</h2>
          <p className="mt-1 text-sm text-ink-muted">
            At most one budget alert an evening, plus your weekly audit on Sunday.
          </p>
        </div>
      </div>
      {result === "denied" ? (
        <p className="mt-4 rounded-2xl bg-caution-soft px-3 py-2.5 text-sm font-medium text-caution">
          Notifications are off. You can turn them on in Settings → Notifications → SkyFin; warnings still show in the app.
        </p>
      ) : result === "failed" || result === "unsupported" ? (
        <p className="mt-4 rounded-2xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
          Couldn&apos;t turn on notifications. Warnings still show in the app.
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 rounded-full bg-sunken px-5 text-sm font-semibold text-ink"
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
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-50"
        >
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          Enable notifications
        </button>
      </div>
    </section>
  );
}
