"use client";

import { useState, useTransition } from "react";
import { AlertOctagon, AlertTriangle, Info, Loader2, X, Zap } from "lucide-react";
import { cn } from "cn";
import type { Warning, WarningLevel } from "@/lib/agents/accounting";
import { dismissWarnings } from "@/actions/audits";
import { setExcludeFromPace } from "@/actions/transactions";

// Each level keeps its hue on a soft card; the message itself stays in ink for contrast.
const STYLE: Record<WarningLevel, { box: string; accent: string; icon: typeof Info; label: string }> = {
  info: { box: "bg-info-soft", accent: "text-info", icon: Info, label: "Budget update" },
  warning: { box: "bg-caution-soft", accent: "text-caution", icon: AlertTriangle, label: "Warning" },
  critical: { box: "bg-danger-soft", accent: "text-danger", icon: AlertOctagon, label: "Critical" },
  spike: { box: "bg-spike-soft", accent: "text-spike", icon: Zap, label: "Big expense" },
};

/**
 * The Accounting Agent's in-app warning (PRD §8.1, §9): the most severe unread one, coloured by
 * level. A spike asks "Is this a one-off purchase?"; Yes takes it out of the pace average (D16).
 */
export function WarningBanner({ warnings }: { warnings: Warning[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const top = warnings[0];
  if (!top) return null;

  const { box, accent, icon: Icon, label } = STYLE[top.level];
  const more = warnings.length - 1;

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) setError(res.message ?? "Something went wrong. Try again.");
    });

  // Dismiss clears every unread non-spike warning at once; unanswered spikes still ask.
  const dismiss = () =>
    run(() =>
      dismissWarnings({
        ids: [...new Set([top.id, ...warnings.filter((w) => w.level !== "spike").map((w) => w.id)])],
      }),
    );

  return (
    <div
      id="warning-banner"
      role="status"
      data-level={top.level}
      className={cn("flex flex-col gap-3 rounded-[22px] p-4 text-ink shadow-card", box)}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-surface", accent)}>
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={cn("text-xs font-semibold uppercase tracking-[0.12em]", accent)}>
            {label}
            {more > 0 && top.level !== "spike" ? ` · +${more} more` : ""}
          </p>
          <p id="warning-banner-message" className="mt-1 text-sm leading-snug font-medium">
            {top.message}
          </p>
        </div>
        {top.level !== "spike" && (
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            aria-label="Dismiss warning"
            className="-mt-1.5 -mr-1.5 flex size-11 flex-shrink-0 items-center justify-center rounded-full text-ink-muted"
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <X aria-hidden className="size-4" />}
          </button>
        )}
      </div>

      {top.level === "spike" && top.transactionId && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            id="btn-spike-yes"
            disabled={pending}
            onClick={() => run(() => setExcludeFromPace({ id: top.transactionId!, value: true }))}
            className="min-h-11 rounded-full bg-ink text-sm font-semibold text-canvas disabled:opacity-50"
          >
            Yes, one-off
          </button>
          <button
            type="button"
            id="btn-spike-no"
            disabled={pending}
            onClick={() => run(() => dismissWarnings({ ids: [top.id] }))}
            className="min-h-11 rounded-full bg-surface text-sm font-semibold text-ink disabled:opacity-50"
          >
            No
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="px-1 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
