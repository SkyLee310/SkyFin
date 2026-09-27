"use client";

import React, { useState } from "react";
import { Category, createCategory } from "@/actions/categories";
import { ChevronDown, Loader2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

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
        <label
          htmlFor="category-selector-dropdown"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted"
        >
          Category <span className="text-danger">*</span>
        </label>
        <button
          type="button"
          id="btn-open-add-category"
          aria-expanded={isAddingNew}
          onClick={() => setIsAddingNew((prev) => !prev)}
          className="-my-2 -mr-3 flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-brand"
        >
          {isAddingNew ? <X aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
          <span>{isAddingNew ? "Cancel" : "Add custom"}</span>
        </button>
      </div>

      {isAddingNew && (
        <form onSubmit={handleCreate} className="mb-1 flex flex-col gap-1 rounded-2xl bg-sunken p-2.5">
          <div className="flex gap-2">
            <Input
              id="new-category-name-input"
              type="text"
              aria-label="New category name"
              placeholder="e.g. Printing, Mamak"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="h-11 flex-1 bg-surface"
              maxLength={40}
              autoFocus
            />
            <button
              type="submit"
              id="btn-submit-new-category"
              disabled={isSubmitting || !newCatName.trim()}
              className="flex min-h-11 min-w-16 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-40"
            >
              {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : "Save"}
            </button>
          </div>
          {kind === "expense" && (
            <label className="flex min-h-11 items-center gap-2.5 px-1 text-sm text-ink">
              <input
                type="checkbox"
                checked={newCatEssential}
                onChange={(e) => setNewCatEssential(e.target.checked)}
                className="size-5 flex-shrink-0 accent-brand"
              />
              <span>Default as Essential (Needs)</span>
            </label>
          )}
          {submitError && (
            <span role="alert" className="px-1 text-xs font-medium text-danger">
              {submitError}
            </span>
          )}
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
          className="h-12 w-full appearance-none rounded-xl border border-transparent bg-sunken pr-10 pl-3.5 text-base font-medium text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
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
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink-muted"
        />
      </div>

      {error && (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
