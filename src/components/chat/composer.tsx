"use client";

import React, { useState } from "react";
import { ArrowUp } from "lucide-react";

interface ComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
  /** Extra controls on the left of the input, e.g. the receipt button. */
  leading?: React.ReactNode;
}

export function Composer({ disabled, onSend, leading }: ComposerProps) {
  const [text, setText] = useState("");
  const canSend = !disabled && text.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2 min-w-0">
      {leading}
      <input
        id="chat-input"
        type="text"
        enterKeyHint="send"
        autoComplete="off"
        placeholder="e.g. nasi lemak 8.50 pakai eWallet"
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 min-w-0 min-h-[44px] px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <button
        type="submit"
        id="btn-chat-send"
        disabled={!canSend}
        aria-label="Send"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-900 text-white rounded-full disabled:opacity-40 active:scale-95 transition-transform"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </form>
  );
}
