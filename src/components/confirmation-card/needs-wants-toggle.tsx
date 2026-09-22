"use client";

import React from "react";

interface NeedsWantsToggleProps {
  isEssential: boolean;
  onChange: (val: boolean) => void;
}

export function NeedsWantsToggle({ isEssential, onChange }: NeedsWantsToggleProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        Classification
      </label>
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
        <button
          type="button"
          id="toggle-needs"
          onClick={() => onChange(true)}
          className={`min-h-[40px] flex items-center justify-center font-medium text-sm rounded-lg transition-all ${
            isEssential
              ? "bg-white text-emerald-700 shadow-sm font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Needs (Essential)
        </button>
        <button
          type="button"
          id="toggle-wants"
          onClick={() => onChange(false)}
          className={`min-h-[40px] flex items-center justify-center font-medium text-sm rounded-lg transition-all ${
            !isEssential
              ? "bg-white text-amber-700 shadow-sm font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Wants (Discretionary)
        </button>
      </div>
    </div>
  );
}
