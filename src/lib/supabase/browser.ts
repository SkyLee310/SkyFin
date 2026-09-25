import { createBrowserClient } from "@supabase/ssr";

// Not used: receipts upload through a signed upload URL from createReceiptUpload (D31). Sign-in
// and session refresh stay on the server: iOS caps cookies written by JavaScript at 7 days,
// which would sign the Home Screen app out.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
