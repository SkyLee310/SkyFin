import type { Metadata } from "next";
import Image from "next/image";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export const metadata: Metadata = { title: "Sign in · SkyFin" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-6 py-10">
      <div className="flex flex-col items-center gap-5 text-center">
        {/* The Home Screen icon: already small, so it skips the optimizer. */}
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={72}
          height={72}
          unoptimized
          className="size-18 rounded-[22px] shadow-card"
        />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-ink">SkyFin</h1>
          <p className="text-base text-ink-muted">Log spending in one line. Know before your budget runs out.</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {error === "auth" && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-sm font-medium text-danger">
            Sign-in didn&apos;t finish. Try again.
          </p>
        )}
        <GoogleSignInButton />
      </div>
    </main>
  );
}
