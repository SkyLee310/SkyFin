import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

// E2E always runs against the local Supabase stack, never the cloud project in .env.local:
// values in process.env win over .env files, and the dev server and workers inherit them.
// Workers inherit the main process's env, so only the main process asks the CLI.
if (!process.env.TEST_WORKER_INDEX) {
  let status: { API_URL?: string; PUBLISHABLE_KEY?: string; MAILPIT_URL?: string } = {};
  try {
    status = JSON.parse(
      execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
    );
  } catch {
    // Reported below.
  }
  if (!status.API_URL || !status.PUBLISHABLE_KEY || !status.MAILPIT_URL) {
    throw new Error("E2E needs the local Supabase stack. Run `npx supabase start`, then try again.");
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.PUBLISHABLE_KEY;
  // The local stack's mail catcher, where sign-in emails land (tests/e2e/support/session.ts).
  process.env.MAILPIT_URL = status.MAILPIT_URL;
}

// Not 3000, so a dev server you started against the cloud project is never reused.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "iphone-15", use: { ...devices["iPhone 15"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    // Wait for the port, not a URL: a URL check follows the proxy's redirects, so readiness
    // would depend on app routes.
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
