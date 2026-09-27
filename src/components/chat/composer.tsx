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
    // One pill holds the whole composer; the ring on the pill is the input's focus indicator.
    <form
      onSubmit={submit}
      className="flex min-w-0 items-center gap-1 rounded-full bg-surface p-1.5 shadow-float focus-within:ring-2 focus-within:ring-ring/40"
    >
      {leading}
      <input
        id="chat-input"
        type="text"
        enterKeyHint="send"
        autoComplete="off"
        aria-label="What did you spend?"
        placeholder="e.g. nasi lemak 8.50 pakai eWallet"
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-base text-ellipsis text-ink placeholder:text-ink-muted focus:outline-none"
      />
      <button
        type="submit"
        id="btn-chat-send"
        disabled={!canSend}
        aria-label="Send"
        className="flex size-11 flex-shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground disabled:opacity-40"
      >
        <ArrowUp aria-hidden className="size-5" strokeWidth={2.5} />
      </button>
    </form>
  );
}
