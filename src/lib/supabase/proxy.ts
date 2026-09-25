import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Signed-out visitors may open these. Route handlers under /api check auth themselves (the cron
// route uses CRON_SECRET), so they answer 401 instead of redirecting to a page.
// /offline is the service worker's precached fallback page.
const PUBLIC_PATHS = ["/login", "/auth", "/api", "/offline"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// Refreshes the session cookie on every matched request and routes by sign-in state. The proxy
// is only a convenience: Server Actions and queries still call getUser(), and RLS is the boundary.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const written = {
    cookies: [] as { name: string; value: string; options: CookieOptions }[],
    headers: {} as Record<string, string>,
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          // Pages rendered for this request read the refreshed cookies from the request.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          written.cookies.push(...cookiesToSet);
          Object.assign(written.headers, headers);
        },
      },
    },
  );

  // Nothing between createServerClient and getClaims: getClaims refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  const response =
    !signedIn && !isPublicPath(pathname)
      ? NextResponse.redirect(new URL("/login", request.url))
      : signedIn && pathname === "/login"
        ? NextResponse.redirect(new URL("/", request.url))
        : NextResponse.next({ request });

  // Built after getClaims so refreshed cookies and their no-store headers reach the browser
  // whichever response goes out; dropping them would sign the user out on the next request.
  written.cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  Object.entries(written.headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
