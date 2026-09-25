import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { runAccountingCheck, type Warning } from "./accounting";

/**
 * The accounting check after a write (D3), for Server Actions. Returns the most severe new
 * warning. A failed check is logged, not returned: the save itself already succeeded, and the
 * evening cron runs the check again.
 */
export async function checkAfterWrite(
  client: SupabaseClient,
  userId: string,
  newExpenseIds: string[] = [],
): Promise<Warning | undefined> {
  try {
    const [warning] = await runAccountingCheck(client, userId, { newExpenseIds });
    return warning;
  } catch (error) {
    console.error("accounting check", error);
    return undefined;
  }
}
