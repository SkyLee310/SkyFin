"use client";

import { useState, useTransition } from "react";
import { signInWithGoogle } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function signIn() {
    setError(null);
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (result.ok) window.location.assign(result.data.url);
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" className="w-full text-base" onClick={signIn} disabled={pending}>
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
