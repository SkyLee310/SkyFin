"use client";

import React, { useId, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { formatRM, toSen } from "@/lib/money";
import { dayLabelMYT } from "@/lib/dates";
import type { Category } from "@/actions/categories";
import { deleteTransaction, setExcludeFromPace } from "@/actions/transactions";
import type { DayGroup, HistoryItem } from "@/lib/queries/history";
import type { PaymentMethod } from "@/lib/validation/schemas";
import { ConfirmationCard } from "@/components/confirmation-card/confirmation-card";
import { Trash2, AlertCircle, Clock, ChevronDown, Receipt, Zap, ImageOff } from "lucide-react";
import { groupReceiptRows } from "@/lib/history-groups";

interface HistoryViewProps {
  /** Today's MYT date, so day headings can say "Today" and "Yesterday". */
  today: string;
  initialMonth: string;
  initialCategoryId: string;
  initialPayment: PaymentMethod | "";
  initialEssential: boolean | null;
  categories: Category[];
  dayGroups: DayGroup[];
  /** Signed thumbnail URLs keyed by receipt path. */
  receiptUrls: Record<string, string>;
}

/** The receipt photo; `expired` once the daily sweep has deleted it (FR-26, D17). */
function ReceiptThumb({ url, expired = false }: { url?: string; expired?: boolean }) {
  if (expired) {
    return (
      <span
        data-testid="image-expired"
        className="flex size-10 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line bg-sunken text-ink-muted"
      >
        <ImageOff aria-hidden className="size-3.5" />
        <span className="text-center text-[8px] leading-none font-semibold">Image expired</span>
      </span>
    );
  }
  return (
    <span className="flex size-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sunken text-ink-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed Storage URL
        <img src={url} alt="Receipt" className="size-full object-cover" />
      ) : (
        <Receipt aria-hidden className="size-4" />
      )}
    </span>
  );
}

/** A filter pill: ink when it narrows the list, like the selected tab in the tab bar. */
function filterPill(active: boolean) {
  return {
    select: `h-11 appearance-none rounded-full pr-9 pl-4 text-base font-medium shadow-card outline-none field-sizing-content focus-visible:ring-3 focus-visible:ring-ring/25 ${
      active ? "bg-ink text-canvas" : "bg-surface text-ink"
    }`,
    chevron: `pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 ${
      active ? "text-canvas" : "text-ink-muted"
    }`,
  };
}

export function HistoryView({
  today,
  initialMonth,
  initialCategoryId,
  initialPayment,
  initialEssential,
  categories,
  dayGroups,
  receiptUrls,
}: HistoryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dialogTitleId = useId();
  const dialogBodyId = useId();

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

  // "One-off purchase" (FR-25, D16): leaves the pace average; the server re-runs the check.
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const toggleOneOff = async (tx: HistoryItem) => {
    setTogglingId(tx.id);
    const res = await setExcludeFromPace({ id: tx.id, value: !tx.exclude_from_pace });
    setTogglingId(null);
    if (res.ok) router.refresh();
  };

  const handleEditClick = (item: HistoryItem) => {
    setEditItem(item);
    setIsEditOpen(true);
  };

  // Receipt groups start collapsed; tap to expand.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (groupId: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  const renderRow = (tx: HistoryItem, { nested = false } = {}) => {
    const isIncome = tx.type === "income";
    const title = nested ? tx.category_name : tx.merchant || tx.item_label || tx.category_name;
    // The category moves to the sub-line unless it is already the title.
    const meta = title === tx.category_name ? [tx.payment_method] : [tx.category_name, tx.payment_method];
    return (
      <div key={tx.id} data-testid="history-row" className="flex items-center gap-2 py-2.5 pr-2 pl-4">
        {!nested && (tx.receipt_url || tx.receipt_group_id) && (
          <span className="mr-1">
            <ReceiptThumb
              url={tx.receipt_url ? receiptUrls[tx.receipt_url] : undefined}
              expired={!tx.receipt_url}
            />
          </span>
        )}
        {/* Tap the row to edit it */}
        <button
          type="button"
          onClick={() => handleEditClick(tx)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {/* item_label is lowercase ("nasi lemak"); merchant names keep their own casing. */}
            <span
              className={`line-clamp-1 text-sm font-semibold text-ink ${
                !nested && !tx.merchant && tx.item_label ? "capitalize" : ""
              }`}
            >
              {title}
            </span>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-tight font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {meta.map((part, i) => (
                <React.Fragment key={part}>
                  {i > 0 && <span aria-hidden>·</span>}
                  <span>{part}</span>
                </React.Fragment>
              ))}
              {!isIncome && tx.exclude_from_pace && (
                <span data-testid="one-off-badge" className="rounded-full bg-spike-soft px-1.5 py-px text-spike">
                  One-off
                </span>
              )}
            </span>
          </span>

          <span className="flex flex-shrink-0 flex-col items-end gap-1">
            <span className={`text-sm font-bold tabular-nums ${isIncome ? "text-brand" : "text-ink"}`}>
              {isIncome ? "+" : "-"}
              {formatRM(toSen(tx.amount))}
            </span>
            {!isIncome && (
              <span
                className={`rounded-full px-1.5 py-px text-[10px] leading-tight font-bold uppercase tracking-[0.08em] ${
                  tx.is_essential ? "bg-brand-soft text-brand" : "bg-caution-soft text-caution"
                }`}
              >
                {tx.is_essential ? "Needs" : "Wants"}
              </span>
            )}
          </span>
        </button>

        <div className="flex flex-shrink-0 items-center">
          {isIncome ? (
            // Keeps income amounts in the same column as expenses.
            <span aria-hidden className="size-11" />
          ) : (
            <button
              type="button"
              onClick={() => void toggleOneOff(tx)}
              disabled={togglingId === tx.id}
              aria-pressed={tx.exclude_from_pace}
              aria-label={tx.exclude_from_pace ? "Count in pace again" : "Mark as one-off purchase"}
              title="One-off purchase"
              className={`flex size-11 items-center justify-center rounded-full disabled:opacity-40 ${
                tx.exclude_from_pace ? "bg-spike-soft text-spike" : "text-ink-muted"
              }`}
            >
              <Zap aria-hidden className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setDeleteTargetId(tx.id)}
            className="flex size-11 items-center justify-center rounded-full text-ink-muted"
            aria-label="Delete transaction"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    );
  };

  const categoryPill = filterPill(selectedCategoryId !== "");
  const paymentPill = filterPill(selectedPayment !== "");
  const essentialPill = filterPill(selectedEssential !== null);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3 pt-2 pb-1">
        <div>
          <h1 className="text-[1.625rem] font-bold tracking-tight text-ink">History</h1>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Tap an entry to edit</p>
        </div>

        <input
          id="history-month-picker"
          type="month"
          aria-label="Month"
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            applyFilters({ month: e.target.value });
          }}
          className="min-h-11 appearance-none rounded-full bg-surface px-4 text-base font-semibold text-ink shadow-card outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
        />
      </header>

      {/* Filters scroll sideways past the screen edge; the padding keeps the pills' shadow unclipped. */}
      <div className="-mx-4 -my-3 flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative flex-shrink-0">
          <select
            id="filter-category-select"
            aria-label="Filter by category"
            value={selectedCategoryId}
            onChange={(e) => {
              setSelectedCategoryId(e.target.value);
              applyFilters({ category: e.target.value });
            }}
            className={categoryPill.select}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className={categoryPill.chevron} />
        </div>

        <div className="relative flex-shrink-0">
          <select
            id="filter-payment-select"
            aria-label="Filter by payment method"
            value={selectedPayment}
            onChange={(e) => {
              const val = e.target.value as PaymentMethod | "";
              setSelectedPayment(val);
              applyFilters({ payment: val });
            }}
            className={paymentPill.select}
          >
            <option value="">All Payment</option>
            <option value="Cash">Cash</option>
            <option value="eWallet">eWallet</option>
            <option value="Card">Card</option>
          </select>
          <ChevronDown aria-hidden className={paymentPill.chevron} />
        </div>

        <div className="relative flex-shrink-0">
          <select
            id="filter-essential-select"
            aria-label="Filter by needs or wants"
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
            className={essentialPill.select}
          >
            <option value="">All Types</option>
            <option value="needs">Needs (Essential)</option>
            <option value="wants">Wants (Discretionary)</option>
          </select>
          <ChevronDown aria-hidden className={essentialPill.chevron} />
        </div>
      </div>

      {/* Day groups */}
      {dayGroups.length === 0 ? (
        <div className="flex flex-col items-center rounded-[22px] bg-surface px-6 py-12 text-center text-ink shadow-card">
          <span className="flex size-12 items-center justify-center rounded-full bg-sunken text-ink-muted">
            <Clock aria-hidden className="size-6" />
          </span>
          <h2 className="mt-3 text-base font-bold tracking-tight">No transactions found</h2>
          <p className="mt-1 text-sm text-ink-muted">Tap + on Log tab to record an entry</p>
        </div>
      ) : (
        dayGroups.map((group) => (
          <section key={group.date} className="flex flex-col gap-2">
            {/* Day heading with subtotals */}
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {dayLabelMYT(group.date, today)}
              </h2>
              <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
                {group.totalExpenseSen > 0 && <span className="text-ink">-{formatRM(group.totalExpenseSen)}</span>}
                {group.totalIncomeSen > 0 && <span className="text-brand">+{formatRM(group.totalIncomeSen)}</span>}
              </div>
            </div>

            {/* Rows in the day; split receipts collapse into one group (FR-24) */}
            <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-card">
              {groupReceiptRows(group.transactions).map((entry) => {
                if (entry.kind === "row") return renderRow(entry.row);
                const isOpen = expandedGroups.has(entry.groupId);
                return (
                  <div key={entry.groupId} data-testid="receipt-group">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleGroup(entry.groupId)}
                      className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left"
                    >
                      <ReceiptThumb
                        url={entry.receiptUrl ? receiptUrls[entry.receiptUrl] : undefined}
                        expired={!entry.receiptUrl}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="line-clamp-1 text-sm font-semibold text-ink">
                          {entry.merchant || "Receipt"}
                        </span>
                        <span className="text-[11px] leading-tight font-semibold uppercase tracking-[0.06em] text-ink-muted">
                          {entry.rows.length} items · {entry.rows[0]!.payment_method}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-ink tabular-nums">-{formatRM(entry.totalSen)}</span>
                      <ChevronDown
                        aria-hidden
                        className={`size-4 flex-shrink-0 text-ink-subtle transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-line border-t border-line bg-sunken/60 pl-4">
                        {entry.rows.map((tx) => renderRow(tx, { nested: true }))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* Delete confirmation */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogBodyId}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDeleteTargetId(null);
            }}
            className="flex w-full max-w-xs flex-col items-center gap-3 rounded-[22px] bg-surface p-5 text-center text-ink shadow-float"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
              <AlertCircle aria-hidden className="size-6" />
            </span>
            <h2 id={dialogTitleId} className="text-lg font-bold tracking-tight">
              Delete Entry?
            </h2>
            <p id={dialogBodyId} className="text-sm text-ink-muted">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </p>
            <div className="mt-2 grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setDeleteTargetId(null)}
                className="min-h-11 rounded-full bg-sunken px-3 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete"
                disabled={isDeleting}
                onClick={handleDelete}
                className="min-h-11 rounded-full bg-danger px-3 text-sm font-semibold text-danger-foreground disabled:opacity-40"
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
            amountSen: toSen(editItem.amount),
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
