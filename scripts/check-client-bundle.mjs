// postbuild (M1.18, F1-4, TECH_SPEC §8): fails the build, locally and on Vercel, if anything the
// browser downloads mentions a server-only secret. Scans .next/static and the service worker
// that /serwist/sw.js serves.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PATTERNS = [
  "GEMINI",
  "GOOGLE_SERVICE_ACCOUNT_KEY",
  "BEGIN PRIVATE KEY",
  "SUPABASE_SECRET_KEY",
  "sb_secret_",
  "VAPID_PRIVATE",
  "CRON_SECRET",
];

// Real secret values too, when they are set in this build's environment.
for (const name of ["SUPABASE_SECRET_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "GOOGLE_SERVICE_ACCOUNT_KEY"]) {
  const value = process.env[name]?.trim();
  if (value && value.length >= 16) PATTERNS.push(value);
}

function* files(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

const roots = [".next/static", ".next/server/app/serwist"];
const findings = [];
let scanned = 0;
for (const root of roots) {
  for (const file of files(root)) {
    if (root.includes("serwist") && !/sw\.js/.test(file)) continue;
    scanned++;
    const text = readFileSync(file, "utf8");
    for (const pattern of PATTERNS) {
      if (text.includes(pattern)) findings.push(`${file}: contains ${pattern.length > 30 ? "a secret value" : pattern}`);
    }
  }
}

if (scanned === 0) {
  console.error("check-client-bundle: no client files found; run it after `next build`.");
  process.exit(1);
}
if (findings.length > 0) {
  console.error(`check-client-bundle: server-only secrets in the client bundle:\n  ${findings.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-client-bundle: ${scanned} client files, no server-only secrets.`);
