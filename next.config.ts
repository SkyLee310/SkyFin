import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  // CLAUDE.md and AGENTS.md are maintained by hand; stop `next dev` from rewriting them.
  agentRules: false,
};

// Keeps esbuild (which bundles src/app/sw.ts) out of the server bundle.
export default withSerwist(nextConfig);
