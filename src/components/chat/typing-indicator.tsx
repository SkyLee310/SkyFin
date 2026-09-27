export function TypingIndicator() {
  return (
    <div
      role="status"
      aria-label="SkyFin is thinking"
      className="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-surface px-4 py-3.5 shadow-card"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-2 animate-bounce rounded-full bg-ink-subtle"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
