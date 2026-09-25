import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The service-role client. It bypasses RLS, so only src/app/api/cron/daily/route.ts may create it
// (TECH_SPEC §3.2); everything else uses the session client from ./server.ts.
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for the cron route.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
