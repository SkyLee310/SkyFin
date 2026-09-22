"use client";

import React from "react";
import { PaymentMethod } from "@/lib/validation/schemas";
import { Wallet, CreditCard, Banknote } from "lucide-react";

interface PaymentToggleProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  error?: string;
}

const METHODS: { id: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "Cash", label: "Cash", icon: Banknote },
  { id: "eWallet", label: "eWallet", icon: Wallet },
  { id: "Card", label: "Card", icon: CreditCard },
];

export function PaymentToggle({ value, onChange, error }: PaymentToggleProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        Payment Method <span className="text-rose-500">*</span>
      </label>
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map(({ id, label, icon: Icon }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              id={`payment-method-${id.toLowerCase()}`}
              onClick={() => onChange(id)}
              className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                selected
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className={`w-4 h-4 ${selected ? "text-emerald-400" : "text-slate-400"}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  );
}
