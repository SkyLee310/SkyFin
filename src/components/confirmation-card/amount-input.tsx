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
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="confirmation-amount-input"
        className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted"
      >
        {label}
      </label>
      {/* The amount is the card's headline: a large figure on a sunken well. */}
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-4 text-2xl font-bold text-ink-muted">
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
          className={`h-16 w-full rounded-2xl border pr-4 pl-16 text-3xl font-bold tracking-tight text-ink tabular-nums outline-none placeholder:text-ink-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 ${
            highlight ? "border-caution bg-caution-soft" : "border-transparent bg-sunken"
          }`}
        />
      </div>
      {highlight && <span className="text-xs font-semibold text-caution">Please double-check</span>}
      {error && (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
