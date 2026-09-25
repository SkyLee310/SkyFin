"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">RM</span>
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
        className="w-full min-h-[44px] pl-11 pr-3 bg-white border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
    <div id="split-editor" className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Split receipt</span>
        <button type="button" onClick={onCancel} className="min-h-[44px] px-2 text-xs font-semibold text-slate-500">
          Cancel split
        </button>
      </div>

      {rows.map((row, index) => (
        <div key={row.key} data-testid="split-row" className="flex flex-col gap-2 p-2.5 bg-white border border-slate-100 rounded-xl">
          <div className="flex items-center gap-2">
            <RowAmount index={index} amountSen={row.amountSen} onChange={(amountSen) => update(row.key, { amountSen })} />
            <button
              type="button"
              aria-label={`Remove row ${index + 1}`}
              disabled={rows.length <= 2}
              onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-xl disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <select
            id={`split-category-${index}`}
            aria-label={`Row ${index + 1} category`}
            value={row.categoryId}
            onChange={(e) => {
              const category = expenseCategories.find((c) => c.id === e.target.value);
              update(row.key, { categoryId: e.target.value, isEssential: category?.default_essential ?? row.isEssential });
            }}
            className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-base text-slate-900"
          >
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={`Row ${index + 1} needs or wants`}>
            {[true, false].map((essential) => (
              <button
                key={String(essential)}
                type="button"
                aria-pressed={row.isEssential === essential}
                onClick={() => update(row.key, { isEssential: essential })}
                className={`min-h-[44px] text-xs font-semibold rounded-lg border ${
                  row.isEssential === essential
                    ? essential
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-white text-slate-500 border-slate-200"
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
        className="min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-dashed border-slate-300 rounded-xl"
      >
        <Plus className="w-4 h-4" /> Add row
      </button>

      <p
        id="split-remaining"
        aria-live="polite"
        className={`px-1 text-sm font-bold ${left === 0 ? "text-emerald-700" : "text-amber-700"}`}
      >
        Remaining: {formatRM(left)}
      </p>
    </div>
  );
}
