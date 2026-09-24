"use client";

import React, { useRef, useState } from "react";
import { Drawer } from "vaul";
import { X, Check, Loader2, Scissors, Trash2, AlertTriangle } from "lucide-react";
import { Category } from "@/actions/categories";
import { Draft, PaymentMethod } from "@/lib/validation/schemas";
import { saveTransactions, updateTransaction } from "@/actions/transactions";
import { discardReceipt } from "@/actions/ai";
import { todayMYT, isFutureDateMYT } from "@/lib/dates";
import { AmountInput } from "./amount-input";
import { PaymentToggle } from "./payment-toggle";
import { NeedsWantsToggle } from "./needs-wants-toggle";
import { CategorySelector } from "./category-selector";
import { SplitEditor } from "./split-editor";
import { type SplitRow, isSplitComplete } from "./split";

/** An uploaded receipt photo the card is logging; previewUrl is a local object URL. */
export interface ReceiptAttachment {
  path: string;
  previewUrl: string | null;
}

export interface ConfirmationCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  initialDraft?: Partial<Draft> & { id?: string };
  /** New entry from a receipt: shows the photo, Split and Discard; Discard deletes the upload. */
  receipt?: ReceiptAttachment;
  onSuccess?: () => void;
}

interface FormProps {
  categories: Category[];
  initialDraft?: Partial<Draft> & { id?: string };
  receipt?: ReceiptAttachment;
  onClose: () => void;
  onSaved: () => void;
  onDiscard: () => Promise<void>;
  onSuccess?: () => void;
}

function ConfirmationCardForm({
  categories: initialCategories,
  initialDraft,
  receipt,
  onClose,
  onSaved,
  onDiscard,
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

  // Receipt mode (M4.8, M4.9)
  const [splitRows, setSplitRows] = useState<SplitRow[] | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [rmConfirmed, setRmConfirmed] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const initialAmountSen = initialDraft?.amountSen;
  const lowConfidence =
    initialDraft?.confidence !== undefined && initialDraft.confidence < 0.7 && amountSen === initialAmountSen;
  const currencyWarning = !!initialDraft?.currencyWarning;

  const startSplit = () => {
    const other = categories.find((c) => c.kind === "expense" && !c.archived && c.id !== categoryId);
    setSplitRows([
      { key: crypto.randomUUID(), amountSen, categoryId, isEssential },
      {
        key: crypto.randomUUID(),
        amountSen: 0,
        categoryId: other?.id ?? categoryId,
        isEssential: other?.default_essential ?? true,
      },
    ]);
  };

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
    (splitRows ? isSplitComplete(amountSen, splitRows) : !!categoryId) &&
    paymentMethod !== null &&
    !isFutureDateMYT(date) &&
    (!currencyWarning || rmConfirmed);

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
        onSaved();
        onClose();
        onSuccess?.();
      } else {
        setErrorMessage(res.message);
      }
    } else {
      const draftObj = {
        clientId: initialDraft?.clientId || crypto.randomUUID(),
        type,
        amountSen,
        categoryId,
        paymentMethod,
        merchant: merchant.trim() || null,
        itemLabel: initialDraft?.itemLabel ?? null,
        note: note.trim() || null,
        date,
        isEssential: type === "expense" ? isEssential : true,
      };

      // Split rows share merchant, date, payment method, note and the photo (FR-16) and are
      // saved in one insert, which gives them one receipt_group_id (FR-18).
      const drafts = splitRows
        ? splitRows.map((row) => ({
            ...draftObj,
            clientId: crypto.randomUUID(),
            type: "expense" as const,
            amountSen: row.amountSen,
            categoryId: row.categoryId,
            isEssential: row.isEssential,
          }))
        : [draftObj];

      const res = await saveTransactions({
        drafts,
        receiptPath: receipt?.path ?? null,
      });

      setIsSubmitting(false);
      if (res.ok) {
        onSaved();
        onClose();
        onSuccess?.();
      } else {
        setErrorMessage(res.message);
      }
    }
  };

  const isEditMode = !!initialDraft?.id;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white rounded-t-[28px]">
      {/* Fields scroll; the actions below stay pinned at the bottom of the sheet. */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 pb-2">
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
          aria-label="Close"
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Fields */}
      <div className="flex flex-col gap-4 py-4">
        {receipt && (
          <div className="flex items-center gap-3">
            {receipt.previewUrl ? (
              <button
                type="button"
                id="receipt-thumbnail"
                onClick={() => setPhotoOpen(true)}
                aria-label="Enlarge receipt photo"
                className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
                <img src={receipt.previewUrl} alt="Receipt" className="w-full h-full object-cover" />
              </button>
            ) : null}
            <p className="text-xs text-slate-500 leading-relaxed">
              Check what was read from your receipt. Nothing is saved until you confirm.
            </p>
          </div>
        )}

        {currencyWarning && (
          <div id="currency-warning" className="flex flex-col gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-800">
              <AlertTriangle className="w-4 h-4" /> Currency may not be RM
            </p>
            <label className="flex items-center gap-2 min-h-[44px] text-xs text-amber-900">
              <input
                id="confirm-currency-rm"
                type="checkbox"
                checked={rmConfirmed}
                onChange={(e) => setRmConfirmed(e.target.checked)}
                className="w-5 h-5 accent-amber-600"
              />
              I&apos;ve checked the amount is in RM
            </label>
          </div>
        )}

        {/* Type Switcher */}
        {!splitRows && (
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
        )}

        {/* Amount */}
        <AmountInput
          amountSen={amountSen}
          onChange={setAmountSen}
          highlight={lowConfidence}
          label={splitRows ? "Receipt total" : "Amount"}
        />

        {splitRows && (
          <SplitEditor
            totalSen={amountSen}
            rows={splitRows}
            categories={categories}
            onChange={setSplitRows}
            onCancel={() => setSplitRows(null)}
          />
        )}

        {/* Category */}
        {!splitRows && (
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
        )}

        {/* Payment Method */}
        <PaymentToggle value={paymentMethod} onChange={setPaymentMethod} />

        {/* Needs vs Wants (Expenses Only) */}
        {type === "expense" && !splitRows && (
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

      </div>

      {/* Pinned actions */}
      <div className="flex-shrink-0 px-4 pt-3 pb-safe mb-3 bg-white border-t border-slate-100 flex flex-col gap-2">
        {receipt && !isEditMode && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="btn-discard-receipt"
              disabled={isSubmitting || isDiscarding}
              onClick={async () => {
                setIsDiscarding(true);
                await onDiscard();
                setIsDiscarding(false);
              }}
              className="min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl disabled:opacity-40"
            >
              {isDiscarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Discard
            </button>
            <button
              type="button"
              id="btn-split"
              disabled={isSubmitting || !!splitRows || amountSen <= 0 || type !== "expense"}
              onClick={startSplit}
              className="min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-40"
            >
              <Scissors className="w-4 h-4" />
              Split
            </button>
          </div>
        )}
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
      {photoOpen && receipt?.previewUrl && (
        <button
          type="button"
          onClick={() => setPhotoOpen(false)}
          aria-label="Close receipt photo"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
          <img src={receipt.previewUrl} alt="Receipt, full size" className="max-w-full max-h-full object-contain" />
        </button>
      )}
    </div>
  );
}

export function ConfirmationCard({
  open,
  onOpenChange,
  categories,
  initialDraft,
  receipt,
  onSuccess,
}: ConfirmationCardProps) {
  const formKey = open ? (initialDraft?.id || receipt?.path || initialDraft?.clientId || "new-entry") : "closed";

  // F5-3: a receipt card closed without saving (Discard, X or swipe down) deletes the upload.
  // The receipt path already saved or discarded, so each upload is handled once.
  const handledPathRef = useRef<string | null>(null);
  const discard = async () => {
    if (receipt && !initialDraft?.id && handledPathRef.current !== receipt.path) {
      handledPathRef.current = receipt.path;
      await discardReceipt({ path: receipt.path });
    }
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) void discard();
    onOpenChange(next);
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" />
        <Drawer.Content className="bg-white flex flex-col rounded-t-[28px] max-h-[92vh] fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 shadow-2xl focus:outline-none">
          {open && (
            <ConfirmationCardForm
              key={formKey}
              categories={categories}
              initialDraft={initialDraft}
              receipt={receipt}
              onClose={() => handleOpenChange(false)}
              onSaved={() => {
                handledPathRef.current = receipt?.path ?? null;
              }}
              onDiscard={async () => {
                await discard();
                onOpenChange(false);
              }}
              onSuccess={onSuccess}
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
