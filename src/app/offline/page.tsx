import { WifiOff } from "lucide-react";

// The service worker's fallback when a page can't load offline (A11). Precached, so it has no data.
// Try again is a plain link: it works without JS, and offline it lands back here. The Home Screen
// app has no pull-to-refresh, so the page offers its own way out.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-sunken text-ink-muted">
        <WifiOff aria-hidden className="size-7" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[1.375rem] font-bold tracking-tight text-ink">You&apos;re offline</h1>
        <p className="text-sm text-ink-muted">SkyFin needs a connection to load your budget. Reconnect, then try again.</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load, so the service worker decides again */}
      <a
        href="/"
        className="flex min-h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-brand-foreground"
      >
        Try again
      </a>
    </main>
  );
}
