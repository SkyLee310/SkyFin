"use client";

import React, { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Category } from "@/actions/categories";
import { formatRM, parseRMToSen, senToNumeric } from "@/lib/money";
import { type SplitRow, remainingSen } from "./split";

interface SplitEditorProps {
  totalSen: number;
  rows: SplitRow[];
  categories: Category[];
  onChange: (rows: SplitRow[]) => void;
  onCancel: () => void;
}

function RowAmount({ index, amountSen, onChange }: { index: number; amountSen: number; onChange: (sen: number) => void }) {
  // Keeps what the user typed ("30.", "12.3") while the row holds sen.
  const [text, setText] = useState(amountSen > 0 ? senToNumeric(amountSen) : "");
  return (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-ink-muted">
        RM
      </span>
      <input
        id={`split-amount-${index}`}
        aria-label={`Row ${index + 1} amount`}
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== "" && parseRMToSen(next) === null) return;
          setText(next);
          onChange(parseRMToSen(next) ?? 0);
        }}
        className="h-11 w-full rounded-xl border border-transparent bg-sunken pr-3 pl-11 text-base font-bold text-ink tabular-nums outline-none placeholder:text-ink-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
      />
    </div>
  );
}

/** Split one receipt into rows with their own amount, category and Needs/Wants (FR-15–FR-17). */
export function SplitEditor({ totalSen, rows, categories, onChange, onCancel }: SplitEditorProps) {
  const expenseCategories = categories.filter((c) => c.kind === "expense" && !c.archived);
  const left = remainingSen(totalSen, rows);

  const update = (key: string, patch: Partial<SplitRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => {
    const first = expenseCategories[0];
    onChange([
      ...rows,
      {
        key: crypto.randomUUID(),
        amountSen: Math.max(0, left),
        categoryId: first?.id ?? "",
        isEssential: first?.default_essential ?? true,
      },
    ]);
  };

  return (
    <div id="split-editor" className="flex flex-col gap-2 rounded-2xl bg-sunken p-2.5">
      <div className="flex items-center justify-between pl-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Split receipt</span>
        <button
          type="button"
          onClick={onCancel}
          className="-my-1 flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink-muted"
        >
          Cancel split
        </button>
      </div>

      {rows.map((row, index) => (
        <div key={row.key} data-testid="split-row" className="flex flex-col gap-2 rounded-xl bg-surface p-2.5">
          <div className="flex items-center gap-1">
            <RowAmount index={index} amountSen={row.amountSen} onChange={(amountSen) => update(row.key, { amountSen })} />
            <button
              type="button"
              aria-label={`Remove row ${index + 1}`}
              disabled={rows.length <= 2}
              onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              className="flex size-11 flex-shrink-0 items-center justify-center rounded-full text-ink-muted disabled:opacity-30"
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          </div>
          <div className="relative">
            <select
              id={`split-category-${index}`}
              aria-label={`Row ${index + 1} category`}
              value={row.categoryId}
              onChange={(e) => {
                const category = expenseCategories.find((c) => c.id === e.target.value);
                update(row.key, { categoryId: e.target.value, isEssential: category?.default_essential ?? row.isEssential });
              }}
              className="h-11 w-full appearance-none rounded-xl border border-transparent bg-sunken pr-10 pl-3 text-base text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
            />
          </div>
          <div
            role="group"
            aria-label={`Row ${index + 1} needs or wants`}
            className="grid grid-cols-2 gap-1 rounded-full bg-sunken p-1"
          >
            {[true, false].map((essential) => (
              <button
                key={String(essential)}
                type="button"
                aria-pressed={row.isEssential === essential}
                onClick={() => update(row.key, { isEssential: essential })}
                className={`min-h-11 rounded-full text-sm font-semibold ${
                  row.isEssential === essential ? "bg-ink text-canvas" : "text-ink-muted"
                }`}
              >
                {essential ? "Needs" : "Wants"}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        id="btn-split-add-row"
        onClick={addRow}
        disabled={rows.length >= 20}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-surface text-sm font-semibold text-brand disabled:opacity-40"
      >
        <Plus aria-hidden className="size-4" /> Add row
      </button>

      <p
        id="split-remaining"
        aria-live="polite"
        className={`px-1.5 text-sm font-bold tabular-nums ${left === 0 ? "text-brand" : "text-caution"}`}
      >
        Remaining: {formatRM(left)}
      </p>
    </div>
  );
}
