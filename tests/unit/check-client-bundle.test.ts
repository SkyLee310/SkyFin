import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findLeaks } from "../../scripts/check-client-bundle.mjs";

let dir: string;
const bundle = (files: Record<string, string>) => {
  dir = mkdtempSync(join(tmpdir(), "bundle-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
};

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("findLeaks (M1.18)", () => {
  it("passes a clean bundle", () => {
    expect(findLeaks(bundle({ "chunks/app.js": 'const url = "NEXT_PUBLIC_SUPABASE_URL";' }), {})).toEqual([]);
  });

  it("flags every TECH_SPEC §8 name, with the file it is in", () => {
    const leaks = findLeaks(
      bundle({
        "chunks/a.js": "process.env.GEMINI_MODEL",
        "chunks/nested/b.js": "-----BEGIN PRIVATE KEY-----",
        "css/c.css": "sb_secret_abc",
      }),
      {},
    );
    expect(leaks.sort()).toEqual([
      "chunks/a.js: GEMINI",
      "chunks/nested/b.js: BEGIN PRIVATE KEY",
      "css/c.css: sb_secret_",
    ]);
  });

  it("flags a server-only value without printing it", () => {
    const secret = "cron-secret-0123456789abcdef";
    const leaks = findLeaks(bundle({ "chunks/a.js": `fetch("/x", { headers: { a: "${secret}" } })` }), {
      CRON_SECRET: secret,
    });
    expect(leaks).toEqual(["chunks/a.js: the value of CRON_SECRET"]);
    expect(leaks.join()).not.toContain(secret);
  });

  it("ignores values too short to be secrets", () => {
    expect(findLeaks(bundle({ "chunks/a.js": "abc" }), { CRON_SECRET: "abc" })).toEqual([]);
  });
});
