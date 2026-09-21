import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Spike page for the M1 sign-in check; M1.12 replaces it with the Dashboard in (app)/page.tsx.
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-4">
      <h1 className="text-2xl font-semibold">SkyFin</h1>
      <p className="text-muted-foreground">Signed in as {data.user.email}</p>
    </main>
  );
}
