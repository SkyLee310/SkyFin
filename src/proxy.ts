import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except build assets, images and the manifest: iOS fetches the manifest and
    // icons without cookies, so a redirect to /login there would break Add to Home Screen. The
    // service worker script (/serwist/sw.js) is public too.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|serwist/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
