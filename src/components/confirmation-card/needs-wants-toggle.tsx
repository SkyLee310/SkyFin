"use client";

import React, { useId } from "react";

interface NeedsWantsToggleProps {
  isEssential: boolean;
  onChange: (val: boolean) => void;
}

export function NeedsWantsToggle({ isEssential, onChange }: NeedsWantsToggleProps) {
  const labelId = useId();
  const option = (selected: boolean) =>
    `min-h-11 rounded-full px-2 text-sm leading-tight font-semibold ${
      selected ? "bg-ink text-canvas" : "text-ink-muted"
    }`;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Classification
      </span>
      <div role="group" aria-labelledby={labelId} className="grid grid-cols-2 gap-1 rounded-full bg-sunken p-1">
        <button
          type="button"
          id="toggle-needs"
          aria-pressed={isEssential}
          onClick={() => onChange(true)}
          className={option(isEssential)}
        >
          Needs (Essential)
        </button>
        <button
          type="button"
          id="toggle-wants"
          aria-pressed={!isEssential}
          onClick={() => onChange(false)}
          className={option(!isEssential)}
        >
          Wants (Discretionary)
        </button>
      </div>
    </div>
  );
}
