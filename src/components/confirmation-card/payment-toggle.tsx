"use client";

import React, { useId } from "react";
import { PaymentMethod } from "@/lib/validation/schemas";
import { Wallet, CreditCard, Banknote, type LucideIcon } from "lucide-react";

interface PaymentToggleProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  error?: string;
}

const METHODS: { id: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { id: "Cash", label: "Cash", icon: Banknote },
  { id: "eWallet", label: "eWallet", icon: Wallet },
  { id: "Card", label: "Card", icon: CreditCard },
];

export function PaymentToggle({ value, onChange, error }: PaymentToggleProps) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Payment Method <span className="text-danger">*</span>
      </span>
      {/* Selected looks like the active tab in the tab bar: ink pill, canvas text. */}
      <div role="group" aria-labelledby={labelId} className="grid grid-cols-3 gap-2">
        {METHODS.map(({ id, label, icon: Icon }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              id={`payment-method-${id.toLowerCase()}`}
              aria-pressed={selected}
              onClick={() => onChange(id)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold ${
                selected ? "bg-ink text-canvas" : "bg-sunken text-ink"
              }`}
            >
              <Icon aria-hidden className={`size-4 ${selected ? "" : "text-ink-muted"}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
