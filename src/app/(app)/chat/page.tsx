"use client";

import React, { useState, useEffect } from "react";
import { Plus, Sparkles, MessageSquare } from "lucide-react";
import { ConfirmationCard } from "@/components/confirmation-card/confirmation-card";
import { Composer } from "@/components/chat/composer";
import { DraftStack } from "@/components/chat/draft-stack";
import { type ChatMessage, MessageList } from "@/components/chat/message-list";
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
    setIsCardOpen(true);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)] px-4 pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between py-3 border-b border-slate-100">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Log & Chat
          </h1>
          <p className="text-xs text-slate-500">Record spending in seconds</p>
        </div>
        <button
          type="button"
          id="btn-add-manual-plus"
          onClick={openManual}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-transform active:scale-95 shadow-md"
          aria-label="Add transaction manually"
        >
          <Plus className="w-5 h-5 text-emerald-400" />
        </button>
      </div>

      {successNotice && (
        <div className="p-3 mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-3 py-4">
        {messages.length === 0 && drafts.length === 0 && (
          <div className="flex flex-col items-center text-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600 mb-3 border border-slate-100">
              <MessageSquare className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h2 className="text-base font-bold text-slate-800 mb-1">Tell me what you spent</h2>
            <p className="text-xs text-slate-500 max-w-xs mb-4 leading-relaxed">
              Type it in any language. You check every entry before it&apos;s saved.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void send(example)}
                  disabled={pending}
                  className="min-h-[44px] px-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        <MessageList messages={messages} pending={pending} onRetry={retry} />

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
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">{saveError}</div>
        )}
      </div>

      {/* Composer, pinned above the bottom nav */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 px-4 py-3 bg-white/95 backdrop-blur-md border-t border-slate-100">
        <Composer disabled={pending} onSend={(text) => void send(text)} />
      </div>

      <ConfirmationCard
        open={isCardOpen}
        onOpenChange={(open) => {
          setIsCardOpen(open);
          if (!open) setEditingClientId(null);
        }}
        categories={categories}
        initialDraft={editingDraft}
        onSuccess={() => {
          if (editingDraft) removeDrafts([editingDraft.clientId]);
          notify("Transaction recorded successfully!");
        }}
      />
    </div>
  );
}
