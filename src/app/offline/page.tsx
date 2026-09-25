import { WifiOff } from "lucide-react";

// The service worker's fallback when a page can't load offline (A11). Precached, so it has no data.
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <WifiOff className="w-10 h-10 text-slate-400" aria-hidden />
      <h1 className="text-lg font-bold">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        SkyFin needs a connection to load your budget. Reconnect and pull down to try again.
      </p>
    </main>
  );
}
