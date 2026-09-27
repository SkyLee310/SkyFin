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

/**
 * How to bring the newest entry into view, or null while the list is empty: nothing needs
 * revealing then, and a scroll would only nudge the page as it opens. An explicit smooth scroll
 * ignores the stylesheet's Reduce Motion rule, so Reduce Motion gets an instant one.
 */
export function newestEntryScroll(
  messageCount: number,
  pending: boolean,
  reduceMotion: boolean,
): ScrollIntoViewOptions | null {
  if (messageCount === 0 && !pending) return null;
  return { behavior: reduceMotion ? "auto" : "smooth", block: "end" };
}

export function MessageList({ messages, pending, onRetry }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroll = newestEntryScroll(messages.length, pending, reduceMotion);
    if (scroll) endRef.current?.scrollIntoView(scroll);
  }, [messages.length, pending]);

  return (
    <div id="chat-message-list" className="flex flex-col gap-2" aria-live="polite">
      {messages.map((m) => (
        <div
          key={m.id}
          data-role={m.role}
          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            m.role === "user"
              ? "self-end rounded-br-md bg-brand text-brand-foreground"
              : m.isError
                ? "self-start rounded-bl-md bg-danger-soft text-danger"
                : "self-start rounded-bl-md bg-surface text-ink shadow-card"
          }`}
        >
          {m.text}
          {m.retryText !== undefined && (
            <button
              type="button"
              onClick={() => onRetry(m.retryText!)}
              disabled={pending}
              className="mt-2 flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-danger disabled:opacity-50"
            >
              <RotateCcw aria-hidden className="size-4" />
              Retry
            </button>
          )}
        </div>
      ))}
      {pending && <TypingIndicator />}
      {/* Scrolling here stops short of the bottom by the composer's height (the page's scroll
          padding already clears the tab bar), so the newest message stays above the composer. */}
      <div ref={endRef} className="scroll-mb-20" />
    </div>
  );
}
