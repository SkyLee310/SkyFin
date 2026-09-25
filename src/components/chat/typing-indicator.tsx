export function TypingIndicator() {
  return (
    <div
      role="status"
      aria-label="SkyFin is thinking"
      className="self-start flex items-center gap-1 px-4 py-3 bg-slate-100 rounded-2xl rounded-bl-md"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
