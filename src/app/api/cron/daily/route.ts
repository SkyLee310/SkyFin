import "server-only";

import { timingSafeEqual } from "node:crypto";
import { monthRangeMYT, todayMYT } from "@/lib/dates";
import { runDailyJobs } from "@/lib/jobs/daily";
import { createAdminClient } from "@/lib/supabase/admin";

// The one daily cron (vercel.json, 0 14 * * * UTC = 22:00 MYT; TECH_SPEC §3.3). The only code
// that uses the service-role client. Vercel sends `Authorization: Bearer ${CRON_SECRET}`.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** ?date= and ?user= let a test run the cron as another day or for one user; never in production. */
function overridesAllowed(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  const user = params.get("user");
  if ((date || user) && !overridesAllowed()) {
    return Response.json({ error: "Overrides are only accepted outside production" }, { status: 400 });
  }
  if (date) {
    try {
      monthRangeMYT(date);
    } catch {
      return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
  }
  if (user && !UUID.test(user)) return Response.json({ error: "user must be a uuid" }, { status: 400 });

  const result = await runDailyJobs(createAdminClient(), {
    today: date ?? todayMYT(),
    ...(user ? { userId: user } : {}),
  });
  return Response.json(result);
}
