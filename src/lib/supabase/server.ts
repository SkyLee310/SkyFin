import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// The session client for Server Components, Server Actions and Route Handlers. It acts as the
// signed-in user, so RLS scopes every query to their rows.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components can't set cookies; the proxy has already refreshed the session.
          }
        },
      },
    },
  );
}
