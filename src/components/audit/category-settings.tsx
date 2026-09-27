"use client";

import React, { useState, useEffect } from "react";
import { cn } from "cn";
import {
  Category,
  listCategories,
  createCategory,
  renameCategory,
  archiveCategory,
} from "@/actions/categories";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Edit2,
  Archive,
  Check,
  X,
  Lock,
} from "lucide-react";

/** Custom categories: add, rename, archive (F7). Lives in the AI Audit tab's settings. */
export function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New category state
  const [newCatName, setNewCatName] = useState("");
  const [newCatKind, setNewCatKind] = useState<"expense" | "income">("expense");
  const [isAdding, setIsAdding] = useState(false);

  // Rename category state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    listCategories({ includeArchived: true }).then((res) => {
      if (isMounted) {
        if (res.ok) {
          setCategories(res.data);
        }
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const res = await createCategory({
      name: newCatName.trim(),
      kind: newCatKind,
      defaultEssential: true,
    });

    if (res.ok) {
      setMessage({ type: "success", text: `Category "${res.data.name}" created.` });
      setNewCatName("");
      setIsAdding(false);
      setRefreshTrigger((prev) => prev + 1);
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  const handleStartRename = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleSaveRename = async (id: string) => {
    if (!editName.trim()) return;
    const res = await renameCategory({ id, name: editName.trim() });
    if (res.ok) {
      setMessage({ type: "success", text: `Category renamed to "${res.data.name}".` });
      setEditingId(null);
      setRefreshTrigger((prev) => prev + 1);
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to archive "${name}"? Existing transactions will keep this category, but it will be hidden from new entries.`)) {
      return;
    }

    const res = await archiveCategory({ id });
    if (res.ok) {
      setMessage({ type: "success", text: `Category "${name}" archived.` });
      setRefreshTrigger((prev) => prev + 1);
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  const activeCategories = categories.filter((c) => !c.archived);
  const archivedCategories = categories.filter((c) => c.archived);

  return (
    <div className="flex flex-col gap-2.5 pt-3">
      {/* Notice Banner */}
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl py-1 pr-1 pl-3.5 text-sm font-semibold",
            message.type === "success" ? "bg-brand-soft text-brand" : "bg-danger-soft text-danger",
          )}
        >
          <span className="min-w-0 flex-1 py-2">{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="flex size-11 flex-shrink-0 items-center justify-center rounded-full"
            aria-label="Dismiss"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}

      {/* Category Management Section */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Categories</h2>

        <button
          type="button"
          id="btn-add-category-settings"
          onClick={() => setIsAdding((prev) => !prev)}
          aria-expanded={isAdding}
          className="-mr-3 flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-brand"
        >
          {isAdding ? <X aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" strokeWidth={2.5} />}
          <span>{isAdding ? "Cancel" : "Add Custom"}</span>
        </button>
      </div>

      {/* Add Category Form */}
      {isAdding && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-[22px] bg-surface p-4 text-ink shadow-card">
          <h3 className="px-1 text-sm font-bold tracking-tight">Add New Category</h3>
          <div className="grid grid-cols-2 gap-1 rounded-full bg-sunken p-1">
            <button
              type="button"
              onClick={() => setNewCatKind("expense")}
              aria-pressed={newCatKind === "expense"}
              className={cn(
                "min-h-11 rounded-full text-sm font-semibold",
                newCatKind === "expense" ? "bg-ink text-canvas" : "text-ink-muted",
              )}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setNewCatKind("income")}
              aria-pressed={newCatKind === "income"}
              className={cn(
                "min-h-11 rounded-full text-sm font-semibold",
                newCatKind === "income" ? "bg-ink text-canvas" : "text-ink-muted",
              )}
            >
              Income
            </button>
          </div>

          <div className="flex gap-2">
            <Input
              id="input-category-name"
              type="text"
              placeholder="Category name (e.g. Printing, Mamak)"
              aria-label="Category name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              maxLength={40}
              className="flex-1"
              autoFocus
            />
            <button
              type="submit"
              id="btn-save-category"
              disabled={!newCatName.trim()}
              className="flex min-h-12 min-w-16 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* Active Categories List */}
      <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface text-ink shadow-card">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-ink-muted">Loading categories...</div>
        ) : (
          activeCategories.map((cat) => {
            const isEditing = editingId === cat.id;
            return (
              <div key={cat.id} className="flex min-h-14 items-center gap-3 py-1.5 pr-1.5 pl-4">
                {cat.is_preset ? (
                  <span
                    className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-sunken text-ink-subtle"
                    title="Preset category"
                  >
                    <Lock aria-hidden className="size-3.5" />
                  </span>
                ) : (
                  <span className="flex size-8 flex-shrink-0 items-center justify-center">
                    <span className="size-2 rounded-full bg-brand" />
                  </span>
                )}

                {isEditing ? (
                  <Input
                    type="text"
                    aria-label="New category name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-11 flex-1"
                    maxLength={40}
                    autoFocus
                  />
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-semibold">{cat.name}</span>
                    <span className="flex-shrink-0 rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-ink-muted capitalize">
                      {cat.kind}
                    </span>
                  </div>
                )}

                {/* Actions for custom categories */}
                {!cat.is_preset && (
                  <div className="flex flex-shrink-0 items-center">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSaveRename(cat.id)}
                          className="flex size-11 items-center justify-center rounded-full text-brand"
                          aria-label="Save rename"
                        >
                          <Check aria-hidden className="size-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex size-11 items-center justify-center rounded-full text-ink-muted"
                          aria-label="Cancel rename"
                        >
                          <X aria-hidden className="size-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartRename(cat)}
                          className="flex size-11 items-center justify-center rounded-full text-ink-muted"
                          aria-label="Rename category"
                        >
                          <Edit2 aria-hidden className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(cat.id, cat.name)}
                          className="flex size-11 items-center justify-center rounded-full text-ink-muted"
                          aria-label="Archive category"
                        >
                          <Archive aria-hidden className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Archived Categories List */}
      {archivedCategories.length > 0 && (
        <>
          <h3 className="mt-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Archived Categories ({archivedCategories.length})
          </h3>
          <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-sunken">
            {archivedCategories.map((c) => (
              <div key={c.id} className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm text-ink-muted">
                <span className="truncate line-through">{c.name}</span>
                <span className="flex-shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-medium">Archived</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
