"use client";

import React from "react";
import { Banknote, Check, CreditCard, Loader2, Pencil, Wallet, X } from "lucide-react";
import type { Category } from "@/actions/categories";
import { formatRM } from "@/lib/money";
import { todayMYT } from "@/lib/dates";
import type { Draft, PaymentMethod } from "@/lib/validation/schemas";

const METHODS: { id: PaymentMethod; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "Cash", icon: Banknote },
  { id: "eWallet", icon: Wallet },
  { id: "Card", icon: CreditCard },
];

interface DraftStackProps {
  drafts: Draft[];
  categories: Category[];
  busy: boolean;
  onPaymentChange: (clientId: string, method: PaymentMethod) => void;
  onEdit: (clientId: string) => void;
  onSave: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onSaveAll: () => void;
}

/** Unsaved drafts from chat (FR-2). Nothing here is in the database until Save. */
export function DraftStack({
  drafts,
  categories,
  busy,
  onPaymentChange,
  onEdit,
  onSave,
  onDiscard,
  onSaveAll,
}: DraftStackProps) {
  if (drafts.length === 0) return null;
  const today = todayMYT();
  const allReady = drafts.every((d) => d.paymentMethod !== null);

  return (
    <section
      id="draft-stack"
      aria-label="Unsaved drafts"
      className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm"
    >
      <h2 className="px-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
        {drafts.length === 1 ? "Draft" : `${drafts.length} drafts`} · not saved yet
      </h2>

      {drafts.map((d) => {
        const category = categories.find((c) => c.id === d.categoryId);
        const title = d.merchant || d.itemLabel || category?.name || "Entry";
        return (
          <div
            key={d.clientId}
            data-testid="draft-row"
            className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => onEdit(d.clientId)}
                className="flex-1 min-h-[44px] flex flex-col items-start text-left"
                aria-label={`Edit ${title}`}
              >
                <span
                  className={`font-semibold text-sm text-slate-900 line-clamp-1 ${!d.merchant && d.itemLabel ? "capitalize" : ""}`}
                >
                  {title}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-white text-slate-600 border border-slate-200">
                    {category?.name ?? "Others"}
                  </span>
                  {d.type === "expense" ? (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        d.isEssential ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {d.isEssential ? "Needs" : "Wants"}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700">
                      Income
                    </span>
                  )}
                  {d.date !== today && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-white text-slate-500 border border-slate-200">
                      {d.date}
                    </span>
                  )}
                </span>
              </button>
              <span
                data-testid="draft-amount"
                className={`font-bold text-sm pt-1 ${d.type === "income" ? "text-emerald-600" : "text-slate-900"}`}
              >
                {d.type === "income" ? "+" : ""}
                {formatRM(d.amountSen)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Payment method">
              {METHODS.map(({ id, icon: Icon }) => {
                const selected = d.paymentMethod === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onPaymentChange(d.clientId, id)}
                    className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold border ${
                      selected
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${selected ? "text-emerald-400" : "text-slate-400"}`} />
                    {id}
                  </button>
                );
              })}
            </div>
            {d.paymentMethod === null && (
              <p className="px-1 text-[11px] text-amber-700">Tap how you paid to save.</p>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onDiscard(d.clientId)}
                disabled={busy}
                className="min-h-[44px] flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
              >
                <X className="w-4 h-4" /> Discard
              </button>
              <button
                type="button"
                onClick={() => onEdit(d.clientId)}
                disabled={busy}
                className="min-h-[44px] flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                type="button"
                onClick={() => onSave(d.clientId)}
                disabled={busy || d.paymentMethod === null}
                className="min-h-[44px] flex items-center justify-center gap-1 text-xs font-semibold text-white bg-slate-900 rounded-lg disabled:opacity-40"
              >
                <Check className="w-4 h-4 text-emerald-400" /> Save
              </button>
            </div>
          </div>
        );
      })}

      {drafts.length > 1 && (
        <button
          type="button"
          id="btn-save-all-drafts"
          onClick={onSaveAll}
          disabled={busy || !allReady}
          className="min-h-[48px] flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save all
        </button>
      )}
    </section>
  );
}
