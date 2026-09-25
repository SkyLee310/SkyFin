import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Web Push to a user's Home Screen app (F11; iOS 16.4+). Called by the daily cron with the admin
// client. A 404 or 410 from the push service means the subscription is gone, so its row is
// deleted (F11-2).

export interface PushPayload {
  title: string;
  body: string;
  /** Opened when the notification is tapped. */
  url: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag?: string;
}

export interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one payload to one subscription; resolves to the push service's HTTP status. */
export type PushSender = (subscription: Subscription, payload: string) => Promise<number>;

let vapidReady = false;

const webPushSender: PushSender = async (subscription, payload) => {
  if (!vapidReady) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      throw new Error("Web Push is not configured: set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.");
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
  }
  try {
    const result = await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      payload,
      { TTL: 12 * 60 * 60, urgency: "normal" },
    );
    return result.statusCode;
  } catch (error) {
    if (error instanceof webpush.WebPushError) return error.statusCode;
    throw error;
  }
};

// Like D30's fake AI: with PUSH_FAKE=1 outside production, the payload is POSTed as plain JSON to
// the endpoint, so E2E can count pushes with a local HTTP server. The real sender encrypts for
// Apple's push service; NODE_ENV=production always uses it.
const fakeSender: PushSender = async (subscription, payload) => {
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  return response.status;
};

export function defaultPushSender(): PushSender {
  return process.env.PUSH_FAKE === "1" && process.env.NODE_ENV !== "production" ? fakeSender : webPushSender;
}

/** Sends to every subscription the user has; returns how many were delivered. */
export async function sendPush(
  client: SupabaseClient,
  userId: string,
  payload: PushPayload,
  send: PushSender = defaultPushSender(),
): Promise<number> {
  const { data: subscriptions, error } = await client
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw new Error(`push: ${error.message}`);

  const body = JSON.stringify(payload);
  let delivered = 0;
  for (const subscription of subscriptions ?? []) {
    let status: number;
    try {
      status = await send(subscription, body);
    } catch (sendError) {
      console.error("push send", sendError);
      continue;
    }
    if (status === 404 || status === 410) {
      await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    } else if (status >= 200 && status < 300) {
      delivered += 1;
    } else {
      console.error("push send: HTTP", status);
    }
  }
  return delivered;
}
