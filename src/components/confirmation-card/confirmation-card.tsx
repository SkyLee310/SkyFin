"use client";

import React, { useRef, useState } from "react";
import { Drawer } from "vaul";
import { X, Check, Loader2, Scissors, Trash2, AlertTriangle } from "lucide-react";
import { Category } from "@/actions/categories";
import { Draft, PaymentMethod } from "@/lib/validation/schemas";
import { saveTransactions, updateTransaction } from "@/actions/transactions";
import { discardReceipt } from "@/actions/ai";
import { todayMYT, isFutureDateMYT } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { AmountInput } from "./amount-input";
import { PaymentToggle } from "./payment-toggle";
import { NeedsWantsToggle } from "./needs-wants-toggle";
import { CategorySelector } from "./category-selector";
import { SplitEditor } from "./split-editor";
import { type SplitRow, isSplitComplete } from "./split";

const labelClass = "text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted";

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
    const expense = categories.filter((c) => c.kind === "expense" && !c.archived);
    const first = categoryId || expense[0]?.id || "";
    const other = expense.find((c) => c.id !== first);
    setSplitRows([
      { key: crypto.randomUUID(), amountSen, categoryId: first, isEssential },
      {
        key: crypto.randomUUID(),
        amountSen: 0,
        categoryId: other?.id ?? first,
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
    <div className="flex min-h-0 flex-1 flex-col rounded-t-[28px] bg-surface">
      {/* Fields scroll; the actions below stay pinned at the bottom of the sheet. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-2">
        {/* The sheet drags down to close (vaul), so it keeps a grabber. */}
        <div className="mx-auto mb-3 h-1.5 w-10 flex-shrink-0 rounded-full bg-ink-subtle/50" />

        <div className="flex items-center justify-between">
          <Drawer.Title className="text-xl font-bold tracking-tight text-ink">
            {isEditMode ? "Edit Transaction" : "New Transaction"}
          </Drawer.Title>
          {/* A small iOS-style circle inside a 44 px target. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex size-11 items-center justify-center rounded-full"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-ink-muted">
              <X aria-hidden className="size-4" />
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-5 py-4">
          {receipt && (
            <div className="flex items-center gap-3 rounded-2xl bg-sunken p-2.5 pr-3.5">
              {receipt.previewUrl ? (
                <button
                  type="button"
                  id="receipt-thumbnail"
                  onClick={() => setPhotoOpen(true)}
                  aria-label="Enlarge receipt photo"
                  className="size-14 flex-shrink-0 overflow-hidden rounded-xl bg-surface"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
                  <img src={receipt.previewUrl} alt="Receipt" className="size-full object-cover" />
                </button>
              ) : null}
              <p className="text-sm leading-snug text-ink-muted">
                Check what was read from your receipt. Nothing is saved until you confirm.
              </p>
            </div>
          )}

          {currencyWarning && (
            <div
              id="currency-warning"
              className="flex flex-col gap-1 rounded-2xl bg-caution-soft px-3.5 pt-3 pb-1 text-caution"
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle aria-hidden className="size-4" /> Currency may not be RM
              </p>
              <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
                <input
                  id="confirm-currency-rm"
                  type="checkbox"
                  checked={rmConfirmed}
                  onChange={(e) => setRmConfirmed(e.target.checked)}
                  className="size-5 flex-shrink-0 accent-caution"
                />
                I&apos;ve checked the amount is in RM
              </label>
            </div>
          )}

          {/* Selected looks like the active tab in the tab bar: ink pill, canvas text. */}
          {!splitRows && (
            <div className="grid grid-cols-2 gap-1 rounded-full bg-sunken p-1">
              <button
                type="button"
                id="type-expense-btn"
                aria-pressed={type === "expense"}
                onClick={() => handleTypeChange("expense")}
                className={`min-h-11 rounded-full text-sm font-semibold ${
                  type === "expense" ? "bg-ink text-canvas" : "text-ink-muted"
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                id="type-income-btn"
                aria-pressed={type === "income"}
                onClick={() => handleTypeChange("income")}
                className={`min-h-11 rounded-full text-sm font-semibold ${
                  type === "income" ? "bg-ink text-canvas" : "text-ink-muted"
                }`}
              >
                Income
              </button>
            </div>
          )}

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

          <PaymentToggle value={paymentMethod} onChange={setPaymentMethod} />

          {/* Needs vs Wants (Expenses Only) */}
          {type === "expense" && !splitRows && (
            <NeedsWantsToggle isEssential={isEssential} onChange={setIsEssential} />
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmation-merchant-input" className={labelClass}>
              Merchant / Place
            </label>
            <Input
              id="confirmation-merchant-input"
              type="text"
              placeholder="e.g. 99 Speedmart, Mamak, Shopee"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmation-date-input" className={labelClass}>
              Date
            </label>
            {/* iOS centres a date input's value; keep it left like the other fields. */}
            <Input
              id="confirmation-date-input"
              type="date"
              max={todayMYT()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="font-medium [&::-webkit-date-and-time-value]:text-left"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmation-note-input" className={labelClass}>
              Note
            </label>
            <Input
              id="confirmation-note-input"
              type="text"
              placeholder="Optional details..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      {/* Pinned actions */}
      <div className="flex flex-shrink-0 flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-danger-soft text-sm font-semibold text-danger disabled:opacity-40"
            >
              {isDiscarding ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden className="size-4" />
              )}
              Discard
            </button>
            <button
              type="button"
              id="btn-split"
              disabled={isSubmitting || !!splitRows || amountSen <= 0 || type !== "expense"}
              onClick={startSplit}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-sunken text-sm font-semibold text-ink disabled:opacity-40"
            >
              <Scissors aria-hidden className="size-4" />
              Split
            </button>
          </div>
        )}
        <button
          type="button"
          id="btn-confirm-save"
          disabled={!isValid || isSubmitting}
          onClick={handleSave}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 text-base font-semibold text-brand-foreground disabled:opacity-40"
        >
          {isSubmitting ? (
            <>
              <Loader2 aria-hidden className="size-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check aria-hidden className="size-5" />
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
          <img src={receipt.previewUrl} alt="Receipt, full size" className="max-h-full max-w-full object-contain" />
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
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed right-0 bottom-0 left-0 z-50 flex max-h-[92vh] flex-col rounded-t-[28px] bg-surface text-ink shadow-float focus:outline-none">
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
