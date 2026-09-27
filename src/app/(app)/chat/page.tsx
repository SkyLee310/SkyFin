"use client";

import React, { useState, useEffect } from "react";
import { ArrowUpRight, CircleCheck, Loader2, MessageSquare, Plus } from "lucide-react";
import { ConfirmationCard, type ReceiptAttachment } from "@/components/confirmation-card/confirmation-card";
import { Composer } from "@/components/chat/composer";
import { DraftStack } from "@/components/chat/draft-stack";
import { type ChatMessage, MessageList } from "@/components/chat/message-list";
import { ReceiptButtons, type ReceiptOutcome, type ReceiptStage } from "@/components/chat/receipt-button";
import { Category, listCategories } from "@/actions/categories";
import { parseTextEntry } from "@/actions/ai";
import { saveTransactions } from "@/actions/transactions";
import type { Draft, PaymentMethod } from "@/lib/validation/schemas";

const EXAMPLES = ["Makan nasi lemak RM8.50 pakai eWallet", "nasi lemak 8.50, boba 12", "semalam grab RM15"];

// Chat and drafts live in this component's state only (D11): leaving the tab unmounts it,
// which clears both.
export default function ChatPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [receiptStage, setReceiptStage] = useState<ReceiptStage | null>(null);
  const [receipt, setReceipt] = useState<(ReceiptAttachment & { draft?: Draft }) | null>(null);

  useEffect(() => {
    let isMounted = true;
    listCategories().then((res) => {
      if (isMounted && res.ok) {
        setCategories(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const notify = (text: string) => {
    setSuccessNotice(text);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const addMessage = (message: Omit<ChatMessage, "id">) =>
    setMessages((prev) => [...prev, { ...message, id: crypto.randomUUID() }]);

  const send = async (text: string, { echo = true } = {}) => {
    if (echo) addMessage({ role: "user", text });
    setPending(true);
    setSaveError(null);
    const res = await parseTextEntry({ message: text, sessionDrafts: drafts });
    setPending(false);

    if (res.ok) {
      addMessage({ role: "assistant", text: res.data.reply });
      setDrafts(res.data.drafts);
    } else if (res.code === "AI_FAILED") {
      addMessage({ role: "assistant", text: res.message, isError: true, retryText: text });
    } else {
      addMessage({ role: "assistant", text: res.message, isError: true });
    }
  };

  const retry = (text: string) => {
    // Drop the Retry button that was tapped so only the newest failure offers one.
    setMessages((prev) => prev.map((m) => (m.retryText === text ? { ...m, retryText: undefined } : m)));
    void send(text, { echo: false });
  };

  const removeDrafts = (ids: string[]) =>
    setDrafts((prev) => prev.filter((d) => !ids.includes(d.clientId)));

  const saveDrafts = async (toSave: Draft[]) => {
    if (toSave.some((d) => d.paymentMethod === null)) return;
    setSaving(true);
    setSaveError(null);
    const res = await saveTransactions({
      drafts: toSave.map((d) => ({ ...d, paymentMethod: d.paymentMethod as PaymentMethod })),
      receiptPath: null,
    });
    setSaving(false);
    if (res.ok) {
      removeDrafts(toSave.map((d) => d.clientId));
      notify(toSave.length === 1 ? "Transaction recorded successfully!" : `${toSave.length} transactions saved!`);
    } else {
      setSaveError(res.message);
    }
  };

  const editingDraft = drafts.find((d) => d.clientId === editingClientId);

  const openManual = () => {
    setEditingClientId(null);
    setReceipt(null);
    setIsCardOpen(true);
  };

  const handleReceipt = (outcome: ReceiptOutcome) => {
    if (outcome.kind === "error") {
      addMessage({ role: "assistant", text: outcome.message, isError: true });
      return;
    }
    if (outcome.kind === "manual") {
      const lead = outcome.code === "AI_LIMIT" ? "Daily AI limit reached." : outcome.message;
      addMessage({ role: "assistant", text: `${lead} Fill in the card by hand; the photo is attached.`, isError: true });
    }
    setEditingClientId(null);
    setReceipt({
      path: outcome.path,
      previewUrl: outcome.previewUrl,
      draft: outcome.kind === "draft" ? outcome.draft : undefined,
    });
    setIsCardOpen(true);
  };

  const receiptBusy = receiptStage !== null;
  const stageText =
    receiptStage?.stage === "preparing"
      ? "Preparing photo…"
      : receiptStage?.stage === "uploading"
        ? `Uploading receipt… ${receiptStage.percent}%`
        : receiptStage?.stage === "reading"
          ? "Reading receipt…"
          : null;

  return (
    // The negative margin cancels the layout's tab-bar clearance: the composer dock reaches the bottom edge itself.
    <div className="-mb-(--nav-clearance) flex min-h-dvh flex-col px-4">
      <header className="flex items-center justify-between gap-3 pt-6 pb-1">
        <div>
          <h1 className="text-[1.625rem] font-bold tracking-tight text-ink">Log & Chat</h1>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Record spending in seconds</p>
        </div>
        <button
          type="button"
          id="btn-add-manual-plus"
          onClick={openManual}
          aria-label="Add transaction manually"
          className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card"
        >
          <Plus aria-hidden className="size-5" />
        </button>
      </header>

      {successNotice && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-soft px-3.5 py-3 text-sm font-semibold text-brand animate-in fade-in"
        >
          <CircleCheck aria-hidden className="size-4 flex-shrink-0" />
          <span>{successNotice}</span>
        </p>
      )}

      <div className="flex flex-1 flex-col gap-3 py-4">
        {messages.length === 0 && drafts.length === 0 && (
          <div className="flex flex-col items-center rounded-[22px] bg-surface p-6 text-center text-ink shadow-card">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
              <MessageSquare aria-hidden className="size-6" />
            </span>
            <h2 className="mt-3 text-base font-bold tracking-tight">Tell me what you spent</h2>
            <p className="mt-1 max-w-xs text-sm text-ink-muted">
              Type it in any language. You check every entry before it&apos;s saved.
            </p>
            <p className="mt-5 self-stretch text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Try an example
            </p>
            <div className="mt-2 flex w-full flex-col gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void send(example)}
                  disabled={pending}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-sunken px-4 py-2.5 text-left text-sm font-medium text-ink disabled:opacity-50"
                >
                  <span>{example}</span>
                  <ArrowUpRight aria-hidden className="size-4 flex-shrink-0 text-ink-subtle" />
                </button>
              ))}
            </div>
          </div>
        )}

        <MessageList messages={messages} pending={pending} onRetry={retry} />

        {stageText && (
          <div
            id="receipt-progress"
            role="status"
            className="flex min-w-[60%] flex-col gap-2 self-start rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-ink shadow-card"
          >
            <span className="flex items-center gap-2">
              <Loader2 aria-hidden className="size-4 animate-spin text-brand" /> {stageText}
            </span>
            {receiptStage?.stage === "uploading" && (
              <span className="h-1.5 overflow-hidden rounded-full bg-sunken">
                <span
                  className="block h-full rounded-full bg-brand transition-[width] duration-300"
                  style={{ width: `${receiptStage.percent}%` }}
                />
              </span>
            )}
          </div>
        )}

        <DraftStack
          drafts={drafts}
          categories={categories}
          busy={saving}
          onPaymentChange={(clientId, method) =>
            setDrafts((prev) => prev.map((d) => (d.clientId === clientId ? { ...d, paymentMethod: method } : d)))
          }
          onEdit={(clientId) => {
            setEditingClientId(clientId);
            setIsCardOpen(true);
          }}
          onSave={(clientId) => void saveDrafts(drafts.filter((d) => d.clientId === clientId))}
          onDiscard={(clientId) => removeDrafts([clientId])}
          onSaveAll={() => void saveDrafts(drafts)}
        />

        {saveError && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">
            {saveError}
          </p>
        )}
      </div>

      {/* Composer dock, pinned to the bottom edge: the tab bar floats over its lower part, and the
          fade above it lets the conversation scroll away underneath. */}
      <div className="sticky bottom-0 z-10 -mx-4 bg-canvas px-4 pt-3 pb-[calc(var(--nav-bottom)+var(--nav-height)+0.75rem)] before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-linear-to-t before:from-canvas before:to-transparent">
        <Composer
          disabled={pending}
          onSend={(text) => void send(text)}
          leading={<ReceiptButtons disabled={receiptBusy} onStage={setReceiptStage} onOutcome={handleReceipt} />}
        />
      </div>

      <ConfirmationCard
        open={isCardOpen}
        onOpenChange={(open) => {
          setIsCardOpen(open);
          if (!open) {
            setEditingClientId(null);
            if (receipt?.previewUrl) URL.revokeObjectURL(receipt.previewUrl);
            setReceipt(null);
          }
        }}
        categories={categories}
        initialDraft={receipt ? receipt.draft : editingDraft}
        receipt={receipt ?? undefined}
        onSuccess={() => {
          if (editingDraft) removeDrafts([editingDraft.clientId]);
          notify("Transaction recorded successfully!");
        }}
      />
    </div>
  );
}
