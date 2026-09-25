// Browser-side Web Push helpers (F11, F15). iOS delivers push only to a Home Screen app on
// iOS 16.4+, and asks for permission only from a tap.

export const SW_URL = "/serwist/sw.js";

export function isStandalone(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function vapidKey(): Uint8Array<ArrayBuffer> {
  const base64 = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

/** Gets or creates this device's push subscription and stores it on the server. */
export async function syncSubscription(): Promise<boolean> {
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey() }));
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  return response.ok;
}

export type EnableResult = "enabled" | "denied" | "unsupported" | "failed";

/** Call straight from a tap: iOS shows the permission prompt only in response to one (F15-2). */
export async function enableNotifications(): Promise<EnableResult> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    return (await syncSubscription()) ? "enabled" : "failed";
  } catch (error) {
    console.error("push subscribe", error);
    return "failed";
  }
}
