// M1.18 (F1 criterion 4): fails `npm run build`, locally and on Vercel, if anything server-only
// reached the browser bundle. Runs as the postbuild script. It looks in .next/static for the
// names listed in TECH_SPEC §8 and, when they are set (as on Vercel), for the values of the
// server-only env vars. It reports which file and which name, never a secret's value.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const PATTERNS = [
  "GEMINI",
  "GOOGLE_SERVICE_ACCOUNT_KEY",
  "BEGIN PRIVATE KEY",
  "SUPABASE_SECRET_KEY",
  "sb_secret_",
  "VAPID_PRIVATE",
];

export const SECRET_ENV = ["GOOGLE_SERVICE_ACCOUNT_KEY", "SUPABASE_SECRET_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET"];

function* filesIn(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* filesIn(path);
    else yield path;
  }
}

/**
 * One line per leak, e.g. "chunks/app.js: the value of CRON_SECRET".
 * @param {string} dir
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function findLeaks(dir, env = process.env) {
  const needles = [
    ...PATTERNS.map((text) => ({ label: text, text })),
    // Short values would match by accident; real secrets are long.
    ...SECRET_ENV.filter((name) => (env[name]?.trim().length ?? 0) >= 16).map((name) => ({
      label: `the value of ${name}`,
      text: env[name].trim(),
    })),
  ];
  const leaks = [];
  for (const file of filesIn(dir)) {
    const content = readFileSync(file, "latin1");
    for (const { label, text } of needles) {
      if (content.includes(text)) leaks.push(`${relative(dir, file)}: ${label}`);
    }
  }
  return leaks;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = join(process.cwd(), ".next", "static");
  let leaks;
  try {
    leaks = findLeaks(dir);
  } catch (error) {
    console.error(`check-client-bundle: can't read ${dir}: ${error.message}`);
    process.exit(1);
  }
  if (leaks.length > 0) {
    console.error(`check-client-bundle: server-only strings reached the browser bundle:\n  ${leaks.join("\n  ")}`);
    process.exit(1);
  }
  console.log("check-client-bundle: no server-only strings in .next/static");
}
