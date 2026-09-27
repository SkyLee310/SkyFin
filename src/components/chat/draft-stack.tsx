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
      className="flex flex-col gap-3 rounded-[22px] bg-surface p-4 text-ink shadow-card"
    >
      <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {drafts.length === 1 ? "Draft" : `${drafts.length} drafts`} · not saved yet
      </h2>

      {drafts.map((d) => {
        const category = categories.find((c) => c.id === d.categoryId);
        const title = d.merchant || d.itemLabel || category?.name || "Entry";
        return (
          <div key={d.clientId} data-testid="draft-row" className="flex flex-col gap-2.5 rounded-2xl bg-sunken p-3">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onEdit(d.clientId)}
                className="flex min-h-11 min-w-0 flex-1 flex-col items-start text-left"
                aria-label={`Edit ${title}`}
              >
                <span
                  className={`line-clamp-1 text-sm font-semibold ${!d.merchant && d.itemLabel ? "capitalize" : ""}`}
                >
                  {title}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted">
                    {category?.name ?? "Others"}
                  </span>
                  {d.type === "expense" ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        d.isEssential ? "bg-brand-soft text-brand" : "bg-caution-soft text-caution"
                      }`}
                    >
                      {d.isEssential ? "Needs" : "Wants"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                      Income
                    </span>
                  )}
                  {d.date !== today && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted tabular-nums">
                      {d.date}
                    </span>
                  )}
                </span>
              </button>
              <span
                data-testid="draft-amount"
                className={`flex-shrink-0 pt-0.5 text-base font-bold whitespace-nowrap tabular-nums ${
                  d.type === "income" ? "text-brand" : "text-ink"
                }`}
              >
                {d.type === "income" ? "+" : ""}
                {formatRM(d.amountSen)}
              </span>
            </div>

            {/* Selected looks like the active tab in the tab bar: ink pill, canvas text. */}
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Payment method">
              {METHODS.map(({ id, icon: Icon }) => {
                const selected = d.paymentMethod === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onPaymentChange(d.clientId, id)}
                    className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full text-xs font-semibold ${
                      selected ? "bg-ink text-canvas" : "bg-surface text-ink"
                    }`}
                  >
                    <Icon className={`size-4 ${selected ? "" : "text-ink-muted"}`} />
                    {id}
                  </button>
                );
              })}
            </div>
            {d.paymentMethod === null && (
              <p className="px-1 text-xs font-medium text-caution">Tap how you paid to save.</p>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onDiscard(d.clientId)}
                disabled={busy}
                className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-surface text-xs font-semibold text-ink-muted disabled:opacity-40"
              >
                <X aria-hidden className="size-4" /> Discard
              </button>
              <button
                type="button"
                onClick={() => onEdit(d.clientId)}
                disabled={busy}
                className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-surface text-xs font-semibold text-ink-muted disabled:opacity-40"
              >
                <Pencil aria-hidden className="size-4" /> Edit
              </button>
              <button
                type="button"
                onClick={() => onSave(d.clientId)}
                disabled={busy || d.paymentMethod === null}
                className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-brand text-xs font-semibold text-brand-foreground disabled:opacity-40"
              >
                <Check aria-hidden className="size-4" /> Save
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
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-40"
        >
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
          Save all
        </button>
      )}
    </section>
  );
}
