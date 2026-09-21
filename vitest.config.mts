import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Vercel runs in UTC. On a machine set to MYT, a helper that reads local time
    // would pass the MYT date tests by accident.
    env: { TZ: "UTC" },
  },
});
