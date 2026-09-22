"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { formatRM } from "@/lib/money";
import type { Category } from "@/actions/categories";
import { deleteTransaction } from "@/actions/transactions";
import type { DayGroup, HistoryItem } from "@/lib/queries/history";
import type { PaymentMethod } from "@/lib/validation/schemas";
import { ConfirmationCard } from "@/components/confirmation-card/confirmation-card";
import { Trash2, AlertCircle, Clock } from "lucide-react";

interface HistoryViewProps {
  initialMonth: string;
  initialCategoryId: string;
  initialPayment: PaymentMethod | "";
  initialEssential: boolean | null;
  categories: Category[];
  dayGroups: DayGroup[];
}

export function HistoryView({
  initialMonth,
  initialCategoryId,
  initialPayment,
  initialEssential,
  categories,
  dayGroups,
}: HistoryViewProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const [selectedPayment, setSelectedPayment] = useState(initialPayment);
  const [selectedEssential, setSelectedEssential] = useState<boolean | null>(initialEssential);

  // Edit / Confirmation Card state
  const [editItem, setEditItem] = useState<HistoryItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Delete dialog state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const applyFilters = (updates: {
    month?: string;
    category?: string;
    payment?: PaymentMethod | "";
    essential?: "needs" | "wants" | "";
  }) => {
    const m = updates.month !== undefined ? updates.month : selectedMonth;
    const c = updates.category !== undefined ? updates.category : selectedCategoryId;
    const p = updates.payment !== undefined ? updates.payment : selectedPayment;

    let e = "";
    if (updates.essential !== undefined) {
      e = updates.essential;
    } else {
      e = selectedEssential === true ? "needs" : selectedEssential === false ? "wants" : "";
    }

    const params = new URLSearchParams();
    if (m) params.set("month", m);
    if (c) params.set("categoryId", c);
    if (p) params.set("payment", p);
    if (e) params.set("essential", e);

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    const res = await deleteTransaction({ id: deleteTargetId });
    setIsDeleting(false);
    setDeleteTargetId(null);
    if (res.ok) {
      router.refresh();
    }
  };

  const handleEditClick = (item: HistoryItem) => {
    setEditItem(item);
    setIsEditOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen p-4 pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            History
          </h1>
          <p className="text-xs text-slate-500">View and edit your expenses</p>
        </div>

        {/* Month Picker */}
        <input
          id="history-month-picker"
          type="month"
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            applyFilters({ month: e.target.value });
          }}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[36px]"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 py-3 border-b border-slate-100">
        {/* Category Filter */}
        <select
          id="filter-category-select"
          value={selectedCategoryId}
          onChange={(e) => {
            setSelectedCategoryId(e.target.value);
            applyFilters({ category: e.target.value });
          }}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[36px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Payment Method Filter */}
        <select
          id="filter-payment-select"
          value={selectedPayment}
          onChange={(e) => {
            const val = e.target.value as PaymentMethod | "";
            setSelectedPayment(val);
            applyFilters({ payment: val });
          }}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[36px]"
        >
          <option value="">All Payment</option>
          <option value="Cash">Cash</option>
          <option value="eWallet">eWallet</option>
          <option value="Card">Card</option>
        </select>

        {/* Needs vs Wants Filter */}
        <select
          id="filter-essential-select"
          value={selectedEssential === null ? "" : selectedEssential ? "needs" : "wants"}
          onChange={(e) => {
            const val = e.target.value;
            let nextEssential: boolean | null = null;
            let essentialParam: "needs" | "wants" | "" = "";
            if (val === "needs") {
              nextEssential = true;
              essentialParam = "needs";
            } else if (val === "wants") {
              nextEssential = false;
              essentialParam = "wants";
            }
            setSelectedEssential(nextEssential);
            applyFilters({ essential: essentialParam });
          }}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[36px]"
        >
          <option value="">All Types</option>
          <option value="needs">Needs (Essential)</option>
          <option value="wants">Wants (Discretionary)</option>
        </select>
      </div>

      {/* Main Content / Day Groups */}
      <div className="flex-1 py-4 flex flex-col gap-5">
        {dayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <Clock className="w-10 h-10 stroke-[1.2] mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No transactions found</p>
            <p className="text-xs mt-1">Tap + on Log tab to record an entry</p>
          </div>
        ) : (
          dayGroups.map((group) => {
            return (
              <div key={group.date} className="flex flex-col gap-2">
                {/* Day Header with Subtotals */}
                <div className="flex items-center justify-between px-1 py-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {group.date}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {group.totalExpenseSen > 0 && (
                      <span className="text-slate-800">
                        -{formatRM(group.totalExpenseSen)}
                      </span>
                    )}
                    {group.totalIncomeSen > 0 && (
                      <span className="text-emerald-600">
                        +{formatRM(group.totalIncomeSen)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rows in Day */}
                <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
                  {group.transactions.map((tx) => {
                    const isIncome = tx.type === "income";
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Tap row to edit */}
                        <div
                          className="flex-1 flex flex-col cursor-pointer mr-3"
                          onClick={() => handleEditClick(tx)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 line-clamp-1">
                              {tx.merchant || tx.category_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-600">
                              {tx.category_name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-slate-100 text-slate-500">
                              {tx.payment_method}
                            </span>
                            {!isIncome && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                                  tx.is_essential
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {tx.is_essential ? "Needs" : "Wants"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-bold text-sm ${
                              isIncome ? "text-emerald-600" : "text-slate-900"
                            }`}
                          >
                            {isIncome ? "+" : "-"}
                            {formatRM(Math.round(tx.amount * 100))}
                          </span>

                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(tx.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            aria-label="Delete transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl border border-slate-100 flex flex-col gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Entry?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="min-h-[40px] px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete"
                disabled={isDeleting}
                onClick={handleDelete}
                className="min-h-[40px] px-3 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Confirmation Card */}
      {editItem && (
        <ConfirmationCard
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) setEditItem(null);
          }}
          categories={categories}
          initialDraft={{
            id: editItem.id,
            type: editItem.type,
            amountSen: Math.round(editItem.amount * 100),
            categoryId: editItem.category_id,
            paymentMethod: editItem.payment_method,
            merchant: editItem.merchant,
            note: editItem.note,
            date: editItem.date,
            isEssential: editItem.is_essential,
          }}
          onSuccess={() => {
            setEditItem(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
