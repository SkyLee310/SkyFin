"use client";

import { useState, useTransition } from "react";
import { AlertOctagon, AlertTriangle, Info, Loader2, X, Zap } from "lucide-react";
import type { Warning, WarningLevel } from "@/lib/agents/accounting";
import { dismissWarnings } from "@/actions/audits";
import { setExcludeFromPace } from "@/actions/transactions";

const STYLE: Record<WarningLevel, { box: string; icon: typeof Info; label: string }> = {
  info: { box: "bg-sky-50 border-sky-200 text-sky-900", icon: Info, label: "Budget update" },
  warning: { box: "bg-amber-50 border-amber-200 text-amber-900", icon: AlertTriangle, label: "Warning" },
  critical: { box: "bg-rose-50 border-rose-200 text-rose-900", icon: AlertOctagon, label: "Critical" },
  spike: { box: "bg-violet-50 border-violet-200 text-violet-900", icon: Zap, label: "Big expense" },
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

  const { box, icon: Icon, label } = STYLE[top.level];
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
      className={`flex flex-col gap-2 p-3.5 border rounded-2xl shadow-sm ${box}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">
            {label}
            {more > 0 && top.level !== "spike" ? ` · +${more} more` : ""}
          </p>
          <p id="warning-banner-message" className="text-sm font-medium leading-snug mt-0.5">
            {top.message}
          </p>
        </div>
        {top.level !== "spike" && (
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            aria-label="Dismiss warning"
            className="-m-2 w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full opacity-60 hover:opacity-100"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
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
            className="min-h-[44px] rounded-xl bg-violet-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            Yes, one-off
          </button>
          <button
            type="button"
            id="btn-spike-no"
            disabled={pending}
            onClick={() => run(() => dismissWarnings({ ids: [top.id] }))}
            className="min-h-[44px] rounded-xl bg-white/70 border border-violet-200 text-sm font-semibold disabled:opacity-50"
          >
            No
          </button>
        </div>
      )}

      {error && <p className="text-xs font-medium text-rose-700">{error}</p>}
    </div>
  );
}
