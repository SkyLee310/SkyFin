import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md and AGENTS.md are maintained by hand; stop `next dev` from rewriting them.
  agentRules: false,
};

export default nextConfig;
