"use client";

import React, { useState } from "react";
import { Drawer } from "vaul";
import { X, Check, Loader2 } from "lucide-react";
import { Category } from "@/actions/categories";
import { Draft, PaymentMethod } from "@/lib/validation/schemas";
import { saveTransactions, updateTransaction } from "@/actions/transactions";
import { todayMYT, isFutureDateMYT } from "@/lib/dates";
import { AmountInput } from "./amount-input";
import { PaymentToggle } from "./payment-toggle";
import { NeedsWantsToggle } from "./needs-wants-toggle";
import { CategorySelector } from "./category-selector";

export interface ConfirmationCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  initialDraft?: Partial<Draft> & { id?: string };
  onSuccess?: () => void;
}

interface FormProps {
  categories: Category[];
  initialDraft?: Partial<Draft> & { id?: string };
  onClose: () => void;
  onSuccess?: () => void;
}

function ConfirmationCardForm({
  categories: initialCategories,
  initialDraft,
  onClose,
  onSuccess,
}: FormProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [type, setType] = useState<"expense" | "income">(initialDraft?.type || "expense");
  const [amountSen, setAmountSen] = useState(initialDraft?.amountSen || 0);
  const [categoryId, setCategoryId] = useState(initialDraft?.categoryId || "");

  // Chat's "+" button can open this form before its client-side category fetch resolves.
  // Adjust state during this render (not in an effect) when the list arrives late, so
  // there's no extra commit; default categoryId then without clobbering a choice the
  // user (or an edit draft) already made.
  const [prevInitialCategories, setPrevInitialCategories] = useState(initialCategories);
  if (initialCategories !== prevInitialCategories) {
    setPrevInitialCategories(initialCategories);
    setCategories(initialCategories);
    setCategoryId((prev) => {
      if (prev || initialDraft?.categoryId) return prev;
      const firstCat = initialCategories.find((c) => c.kind === type && !c.archived);
      return firstCat ? firstCat.id : prev;
    });
  }

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(initialDraft?.paymentMethod || null);
  const [merchant, setMerchant] = useState(initialDraft?.merchant || "");
  const [note, setNote] = useState(initialDraft?.note || "");
  const [date, setDate] = useState(initialDraft?.date || todayMYT());
  const [isEssential, setIsEssential] = useState(
    initialDraft?.isEssential !== undefined ? initialDraft.isEssential : true
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCategoryCreated = (newCat: Category) => {
    setCategories((prev) => [...prev, newCat]);
    setCategoryId(newCat.id);
  };

  const handleTypeChange = (newType: "expense" | "income") => {
    setType(newType);
    const matching = categories.find((c) => c.kind === newType && !c.archived);
    if (matching) {
      setCategoryId(matching.id);
      setIsEssential(matching.default_essential);
    } else {
      setCategoryId("");
    }
  };

  const isValid =
    amountSen > 0 &&
    !!categoryId &&
    paymentMethod !== null &&
    !isFutureDateMYT(date);

  const handleSave = async () => {
    if (!isValid || !paymentMethod) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const isEdit = !!initialDraft?.id;

    if (isEdit && initialDraft.id) {
      const res = await updateTransaction({
        id: initialDraft.id,
        patch: {
          type,
          amountSen,
          categoryId,
          paymentMethod,
          merchant: merchant.trim() || null,
          note: note.trim() || null,
          date,
          isEssential: type === "expense" ? isEssential : true,
        },
      });

      setIsSubmitting(false);
      if (res.ok) {
        onClose();
        onSuccess?.();
      } else {
        setErrorMessage(res.message);
      }
    } else {
      const draftObj = {
        clientId: crypto.randomUUID(),
        type,
        amountSen,
        categoryId,
        paymentMethod,
        merchant: merchant.trim() || null,
        itemLabel: null,
        note: note.trim() || null,
        date,
        isEssential: type === "expense" ? isEssential : true,
      };

      const res = await saveTransactions({
        drafts: [draftObj],
        receiptPath: null,
      });

      setIsSubmitting(false);
      if (res.ok) {
        onClose();
        onSuccess?.();
      } else {
        setErrorMessage(res.message);
      }
    }
  };

  const isEditMode = !!initialDraft?.id;

  return (
    <div className="p-4 bg-white rounded-t-[28px] flex-1 overflow-y-auto">
      {/* Grab Handle */}
      <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-300 mb-4" />

      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <Drawer.Title className="text-lg font-bold text-slate-900">
          {isEditMode ? "Edit Transaction" : "New Transaction"}
        </Drawer.Title>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Fields */}
      <div className="flex flex-col gap-4 py-4">
        {/* Type Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            id="type-expense-btn"
            onClick={() => handleTypeChange("expense")}
            className={`min-h-[40px] text-sm font-semibold rounded-lg transition-all ${
              type === "expense"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            id="type-income-btn"
            onClick={() => handleTypeChange("income")}
            className={`min-h-[40px] text-sm font-semibold rounded-lg transition-all ${
              type === "income"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Income
          </button>
        </div>

        {/* Amount */}
        <AmountInput amountSen={amountSen} onChange={setAmountSen} />

        {/* Category */}
        <CategorySelector
          categories={categories}
          selectedId={categoryId}
          kind={type}
          onSelect={(cat) => {
            setCategoryId(cat.id);
            if (type === "expense") {
              setIsEssential(cat.default_essential);
            }
          }}
          onCategoryCreated={handleCategoryCreated}
        />

        {/* Payment Method */}
        <PaymentToggle value={paymentMethod} onChange={setPaymentMethod} />

        {/* Needs vs Wants (Expenses Only) */}
        {type === "expense" && (
          <NeedsWantsToggle
            isEssential={isEssential}
            onChange={setIsEssential}
          />
        )}

        {/* Merchant / Store */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Merchant / Place
          </label>
          <input
            id="confirmation-merchant-input"
            type="text"
            placeholder="e.g. 99 Speedmart, Mamak, Shopee"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            maxLength={80}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Date
          </label>
          <div className="relative">
            <input
              id="confirmation-date-input"
              type="date"
              max={todayMYT()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Note */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Note
          </label>
          <input
            id="confirmation-note-input"
            type="text"
            placeholder="Optional details..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Pinned Save Button */}
      <div className="sticky bottom-0 pt-3 pb-safe bg-white border-t border-slate-100 mt-2">
        <button
          type="button"
          id="btn-confirm-save"
          disabled={!isValid || isSubmitting}
          onClick={handleSave}
          className="w-full min-h-[48px] px-4 py-3 bg-slate-900 text-white font-semibold text-base rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-5 h-5 text-emerald-400" />
              <span>{isEditMode ? "Update Transaction" : "Confirm & Save"}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function ConfirmationCard({
  open,
  onOpenChange,
  categories,
  initialDraft,
  onSuccess,
}: ConfirmationCardProps) {
  const formKey = open ? (initialDraft?.id || "new-entry") : "closed";

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" />
        <Drawer.Content className="bg-white flex flex-col rounded-t-[28px] max-h-[92vh] fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 shadow-2xl focus:outline-none">
          {open && (
            <ConfirmationCardForm
              key={formKey}
              categories={categories}
              initialDraft={initialDraft}
              onClose={() => onOpenChange(false)}
              onSuccess={onSuccess}
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
