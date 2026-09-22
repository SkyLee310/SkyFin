"use client";

import React, { useState, useEffect } from "react";
import { Plus, Sparkles, MessageSquare, Info } from "lucide-react";
import { ConfirmationCard } from "@/components/confirmation-card/confirmation-card";
import { Category, listCategories } from "@/actions/categories";

export default function ChatPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCardOpen, setIsCardOpen] = useState(false);
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

  const handleSaved = () => {
    setSuccessNotice("Transaction recorded successfully!");
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  return (
    <div className="flex flex-col min-h-[85vh] p-4 pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between py-2 mb-4 border-b border-slate-100">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Log & Chat
          </h1>
          <p className="text-xs text-slate-500">Record spending in seconds</p>
        </div>
        <button
          type="button"
          id="btn-add-manual-plus"
          onClick={() => setIsCardOpen(true)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-transform active:scale-95 shadow-md"
          aria-label="Add transaction manually"
        >
          <Plus className="w-5 h-5 text-emerald-400" />
        </button>
      </div>

      {successNotice && (
        <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Main Empty / Manual Entry Prompt */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-3xl my-auto">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600 mb-4 border border-slate-100">
          <MessageSquare className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h2 className="text-base font-bold text-slate-800 mb-1">
          Manual Logging Ready
        </h2>
        <p className="text-xs text-slate-500 max-w-xs mb-6 leading-relaxed">
          Tap the <strong className="text-slate-800">+</strong> button above or below to open the Confirmation Card and log an expense or income by hand.
        </p>

        <button
          type="button"
          id="btn-add-manual-center"
          onClick={() => setIsCardOpen(true)}
          className="min-h-[48px] px-6 py-3 bg-slate-900 text-white font-semibold text-sm rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Log an Expense / Income</span>
        </button>

        <div className="mt-8 flex items-center gap-2 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5" />
          <span>AI chat & receipt parsing coming in M3 & M4</span>
        </div>
      </div>

      {/* Confirmation Card Sheet */}
      <ConfirmationCard
        open={isCardOpen}
        onOpenChange={setIsCardOpen}
        categories={categories}
        onSuccess={handleSaved}
      />
    </div>
  );
}
