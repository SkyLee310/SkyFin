"use client";

import React, { useState, useEffect } from "react";
import {
  Category,
  listCategories,
  createCategory,
  renameCategory,
  archiveCategory,
} from "@/actions/categories";
import {
  Plus,
  Edit2,
  Archive,
  Check,
  X,
  Sparkles,
  Layers,
  Lock,
} from "lucide-react";

export default function AuditPage() {
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
    <div className="flex flex-col min-h-screen p-4 pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Settings & Audit
          </h1>
          <p className="text-xs text-slate-500">Category management & AI audits</p>
        </div>
      </div>

      {/* Notice Banner */}
      {message && (
        <div
          className={`p-3 mb-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AI Audit Status Card (Coming in M7) */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl mb-6">
        <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Weekly Financial Audits</span>
        </div>
        <p className="text-xs text-emerald-700/80 leading-relaxed">
          AI audits will automatically analyze your weekly expenses on Sunday evenings (M7). Manage your categories below to help classify your spending accurately.
        </p>
      </div>

      {/* Category Management Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Categories
            </h2>
          </div>

          <button
            type="button"
            id="btn-add-category-settings"
            onClick={() => setIsAdding((prev) => !prev)}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 min-h-[36px]"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isAdding ? "Cancel" : "Add Custom"}</span>
          </button>
        </div>

        {/* Add Category Form */}
        {isAdding && (
          <form
            onSubmit={handleCreate}
            className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3"
          >
            <h3 className="text-xs font-bold text-slate-800">Add New Category</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewCatKind("expense")}
                className={`py-2 text-xs font-semibold rounded-lg border ${
                  newCatKind === "expense"
                    ? "bg-white text-slate-900 border-slate-900 shadow-sm"
                    : "bg-transparent text-slate-600 border-slate-200"
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setNewCatKind("income")}
                className={`py-2 text-xs font-semibold rounded-lg border ${
                  newCatKind === "income"
                    ? "bg-white text-emerald-700 border-emerald-600 shadow-sm"
                    : "bg-transparent text-slate-600 border-slate-200"
                }`}
              >
                Income
              </button>
            </div>

            <div className="flex gap-2">
              <input
                id="input-category-name"
                type="text"
                placeholder="Category name (e.g. Printing, Mamak)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                maxLength={40}
                className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              <button
                type="submit"
                id="btn-save-category"
                disabled={!newCatName.trim()}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 min-h-[40px]"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {/* Active Categories List */}
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Loading categories...
            </div>
          ) : (
            activeCategories.map((cat) => {
              const isEditing = editingId === cat.id;
              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3.5 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5 flex-1 mr-2">
                    {cat.is_preset ? (
                      <span className="p-1 rounded bg-slate-100 text-slate-400" title="Preset category">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}

                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-2 py-1 text-sm bg-slate-50 border border-slate-300 rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        maxLength={40}
                        autoFocus
                      />
                    ) : (
                      <div>
                        <span className="text-sm font-semibold text-slate-800">
                          {cat.name}
                        </span>
                        <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          {cat.kind}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions for custom categories */}
                  {!cat.is_preset && (
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveRename(cat.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50"
                            aria-label="Save rename"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
                            aria-label="Cancel rename"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartRename(cat)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            aria-label="Rename category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(cat.id, cat.name)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            aria-label="Archive category"
                          >
                            <Archive className="w-3.5 h-3.5" />
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
          <div className="mt-4 flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Archived Categories ({archivedCategories.length})
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {archivedCategories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 text-xs text-slate-500"
                >
                  <span className="line-through">{c.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                    Archived
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
