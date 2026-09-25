"use client";

import React, { useState } from "react";
import { parseRMToSen, senToNumeric } from "@/lib/money";

interface AmountInputProps {
  amountSen: number;
  onChange: (sen: number) => void;
  error?: string;
  label?: string;
  /** Amber "Please double-check" for a receipt total read with low confidence (FR-13). */
  highlight?: boolean;
}

// What may sit in the field while typing: digits, then at most one "." and 2 decimals.
const PARTIAL_AMOUNT = /^\d*(\.\d{0,2})?$/;

export function AmountInput({ amountSen, onChange, error, label = "Amount", highlight = false }: AmountInputProps) {
  // Keeps exactly what was typed ("12.", ".5") while the parent holds sen. Reformatting to
  // "12.00" on every key would turn the next digit into a third decimal and swallow it.
  const [text, setText] = useState(amountSen > 0 ? senToNumeric(amountSen) : "");
  const textSen = parseRMToSen(text) ?? 0;
  if (textSen !== amountSen) {
    // The amount changed from outside (a new draft), so show that instead.
    setText(amountSen > 0 ? senToNumeric(amountSen) : "");
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Some iOS regions put "," on the decimal keypad.
    const next = e.target.value.replace(",", ".");
    if (!PARTIAL_AMOUNT.test(next)) return;
    const sen = next === "" || next === "." ? 0 : parseRMToSen(next);
    if (sen === null) return;
    setText(next);
    onChange(sen);
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
          value={text}
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
