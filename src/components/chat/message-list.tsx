"use client";

import React, { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { TypingIndicator } from "./typing-indicator";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Set on an assistant message that reports a failed parse; Retry re-sends this user text. */
  retryText?: string;
  isError?: boolean;
}

interface MessageListProps {
  messages: ChatMessage[];
  pending: boolean;
  onRetry: (text: string) => void;
}

export function MessageList({ messages, pending, onRetry }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <div id="chat-message-list" className="flex flex-col gap-2" aria-live="polite">
      {messages.map((m) => (
        <div
          key={m.id}
          data-role={m.role}
          className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl whitespace-pre-wrap break-words ${
            m.role === "user"
              ? "self-end bg-slate-900 text-white rounded-br-md"
              : m.isError
                ? "self-start bg-rose-50 text-rose-800 border border-rose-200 rounded-bl-md"
                : "self-start bg-slate-100 text-slate-800 rounded-bl-md"
          }`}
        >
          {m.text}
          {m.retryText !== undefined && (
            <button
              type="button"
              onClick={() => onRetry(m.retryText!)}
              disabled={pending}
              className="mt-2 min-h-[44px] px-4 flex items-center gap-2 text-xs font-semibold text-rose-700 bg-white border border-rose-200 rounded-xl hover:bg-rose-100 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
          )}
        </div>
      ))}
      {pending && <TypingIndicator />}
      <div ref={endRef} />
    </div>
  );
}
