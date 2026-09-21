import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google returns here through Supabase with a one-time code. The exchange needs the PKCE verifier
// cookie that signInWithGoogle set, and writes the session cookies onto the redirect.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  // No code (the user cancelled at Google) or a failed exchange.
  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}
