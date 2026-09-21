"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation/schemas";

const FAILED = "Couldn't start Google sign-in. Try again.";

// Returns the Google sign-in URL for a full-page redirect; a popup can't hand its result back
// to the Home Screen app. The PKCE verifier goes into a cookie for /auth/callback to read.
// There is no user yet and no data is touched, so this action doesn't call getUser().
export async function signInWithGoogle(): Promise<ActionResult<{ url: string }>> {
  // Next rejects Server Actions whose Origin doesn't match the host, so this is our own origin.
  const origin = (await headers()).get("origin");
  if (!origin) return { ok: false, code: "UNAUTHENTICATED", message: FAILED };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) return { ok: false, code: "UNAUTHENTICATED", message: FAILED };

  return { ok: true, data: { url: data.url } };
}
