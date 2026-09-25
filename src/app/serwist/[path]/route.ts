import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Builds src/app/sw.ts with esbuild and serves it as /serwist/sw.js (Service-Worker-Allowed: /).
// The git commit versions the precached /offline page, so each deploy refreshes it.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  additionalPrecacheEntries: [{ url: "/offline", revision }],
});
