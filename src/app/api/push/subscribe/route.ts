import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Stores or removes this device's Web Push subscription (TECH_SPEC §5.3). The session client
// runs the write, so RLS pins each row to the signed-in user.

const SubscribeBody = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
const UnsubscribeBody = z.object({ endpoint: z.string().url().max(1000) });

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function POST(request: Request) {
  const session = await signedIn();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });

  const parsed = SubscribeBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid subscription" }, { status: 400 });

  const { endpoint, keys } = parsed.data;
  // A re-subscribe replaces the keys; an endpoint that moved to another account is taken over
  // by deleting the old row first (RLS hides it, so the delete below only reaches our own).
  const { supabase, user } = session;
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth });
  if (error) {
    // 23505: the endpoint belongs to another user's row that RLS kept us from seeing.
    return Response.json({ error: "Couldn't save the subscription" }, { status: error.code === "23505" ? 409 : 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await signedIn();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });

  const parsed = UnsubscribeBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid endpoint" }, { status: 400 });

  const { error } = await session.supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  if (error) return Response.json({ error: "Couldn't remove the subscription" }, { status: 500 });
  return Response.json({ ok: true });
}
