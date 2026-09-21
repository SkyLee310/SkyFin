import type { Metadata } from "next";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export const metadata: Metadata = { title: "Sign in · SkyFin" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">SkyFin</h1>
        <p className="text-muted-foreground">
          Log spending in one line. Know before your budget runs out.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {error === "auth" && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
          >
            Sign-in didn&apos;t finish. Try again.
          </p>
        )}
        <GoogleSignInButton />
      </div>
    </main>
  );
}
