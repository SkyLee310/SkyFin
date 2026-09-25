"use client";

import React, { useState } from "react";
import { Category, createCategory } from "@/actions/categories";
import { Plus, Loader2 } from "lucide-react";

interface CategorySelectorProps {
  categories: Category[];
  selectedId: string;
  kind: "expense" | "income";
  onSelect: (category: Category) => void;
  onCategoryCreated: (category: Category) => void;
  error?: string;
}

export function CategorySelector({
  categories,
  selectedId,
  kind,
  onSelect,
  onCategoryCreated,
  error,
}: CategorySelectorProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEssential, setNewCatEssential] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filtered = categories.filter((c) => c.kind === kind && !c.archived);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const res = await createCategory({
      name: newCatName.trim(),
      kind,
      defaultEssential: newCatEssential,
    });

    setIsSubmitting(false);

    if (res.ok) {
      onCategoryCreated(res.data);
      onSelect(res.data);
      setNewCatName("");
      setIsAddingNew(false);
    } else {
      setSubmitError(res.message);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Category <span className="text-rose-500">*</span>
        </label>
        <button
          type="button"
          id="btn-open-add-category"
          onClick={() => setIsAddingNew((prev) => !prev)}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 min-h-[44px] px-2"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAddingNew ? "Cancel" : "Add custom"}</span>
        </button>
      </div>

      {isAddingNew && (
        <form
          onSubmit={handleCreate}
          className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col gap-2 mb-1"
        >
          <div className="flex gap-2">
            <input
              id="new-category-name-input"
              type="text"
              placeholder="e.g. Printing, Mamak"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 min-h-[44px] px-3 py-2 text-base bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              maxLength={40}
              autoFocus
            />
            <button
              type="submit"
              id="btn-submit-new-category"
              disabled={isSubmitting || !newCatName.trim()}
              className="px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
          </div>
          {kind === "expense" && (
            <label className="flex items-center gap-2 min-h-[44px] text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={newCatEssential}
                onChange={(e) => setNewCatEssential(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 accent-emerald-600 focus:ring-emerald-500"
              />
              <span>Default as Essential (Needs)</span>
            </label>
          )}
          {submitError && <span className="text-xs text-rose-600">{submitError}</span>}
        </form>
      )}

      <div className="relative">
        <select
          id="category-selector-dropdown"
          value={selectedId}
          onChange={(e) => {
            const found = filtered.find((c) => c.id === e.target.value);
            if (found) onSelect(found);
          }}
          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
        >
          <option value="" disabled>
            Select a category...
          </option>
          {filtered.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} {!cat.is_preset ? "(Custom)" : ""}
            </option>
          ))}
        </select>
      </div>

      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  );
}
