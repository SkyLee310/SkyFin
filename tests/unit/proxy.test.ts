import { NextRequest } from "next/server";
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/lib/supabase/proxy";
import { config } from "@/proxy";

const ORIGIN = "http://localhost:3000";

describe("proxy matcher", () => {
  it.each(["/", "/login", "/history", "/auth/callback", "/api/cron/daily"])("runs on %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  // iOS fetches the manifest and icons without cookies; a redirect to /login would break
  // Add to Home Screen.
  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image?url=%2Ficons%2Ficon-192.png&w=64&q=75",
    "/favicon.ico",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/apple-touch-icon.png",
  ])("skips %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

// With no auth cookie, getClaims() returns no claims without a network call, so these run
// offline. Signed-in routing needs a real JWT and is covered by tests/e2e/auth.spec.ts.
describe("updateSession for a signed-out visitor", () => {
  const fetchSpy = vi.fn(() => Promise.reject(new Error("unexpected network call")));

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_unit_test");
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => {
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockClear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(["/", "/history", "/loginx", "/authority", "/apix"])("redirects %s to /login", async (path) => {
    const response = await updateSession(new NextRequest(`${ORIGIN}${path}`));
    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/login`);
  });

  it.each(["/login", "/login?error=auth", "/auth/callback?code=abc", "/api/cron/daily"])(
    "lets %s through",
    async (path) => {
      const response = await updateSession(new NextRequest(`${ORIGIN}${path}`));
      expect(getRedirectUrl(response)).toBeNull();
    },
  );
});
