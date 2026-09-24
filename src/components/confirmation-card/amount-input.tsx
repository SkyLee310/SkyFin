"use client";

import React from "react";

interface AmountInputProps {
  amountSen: number;
  onChange: (sen: number) => void;
  error?: string;
  label?: string;
  /** Amber "Please double-check" for a receipt total read with low confidence (FR-13). */
  highlight?: boolean;
}

export function AmountInput({ amountSen, onChange, error, label = "Amount", highlight = false }: AmountInputProps) {
  // Input raw value formatted as decimal e.g. "12.50"
  const rawValue = amountSen > 0 ? (amountSen / 100).toFixed(2) : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, "");
    if (!val) {
      onChange(0);
      return;
    }
    const parts = val.split(".");
    if (parts.length > 2) return; // Prevent multiple dots
    if (parts[1] && parts[1].length > 2) return; // Max 2 decimal places

    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(Math.round(num * 100));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative flex items-center">
        <span className="absolute left-3 text-2xl font-bold text-slate-400">
          RM
        </span>
        <input
          id="confirmation-amount-input"
          type="text"
          inputMode="decimal"
          value={rawValue}
          onChange={handleChange}
          placeholder="0.00"
          aria-invalid={highlight || undefined}
          data-highlight={highlight ? "low-confidence" : undefined}
          className={`w-full pl-14 pr-4 py-3 text-3xl font-extrabold tracking-tight border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 ${
            highlight ? "bg-amber-50 border-amber-400" : "bg-slate-50 border-slate-200"
          }`}
        />
      </div>
      {highlight && <span className="text-xs font-semibold text-amber-700 mt-0.5">Please double-check</span>}
      {error && <span className="text-xs text-rose-500 mt-0.5">{error}</span>}
    </div>
  );
}
