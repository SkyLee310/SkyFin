import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatRow } from "@/lib/stats";

export interface PeriodRow extends StatRow {
  id: string;
  date: string;
  note: string | null;
  exclude_from_pace: boolean;
}

/**
 * A user's rows dated start..end (inclusive), with category names, for lib/stats.ts. Takes the
 * client so the Dashboard (session client) and the cron's audits (admin client) share it.
 */
export async function loadPeriodRows(
  client: SupabaseClient,
  userId: string,
  start: string,
  end: string,
): Promise<PeriodRow[]> {
  const { data, error } = await client
    .from("transactions")
    .select(
      "id, amount, type, category_id, payment_method, is_essential, merchant, item_label, note, date, exclude_from_pace, categories!inner(name)",
    )
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) throw new Error(`stats: ${error?.message ?? "no rows"}`);

  return data.map(({ categories, ...row }) => ({
    ...row,
    category_name: (categories as unknown as { name: string } | null)?.name ?? "Others",
  })) as PeriodRow[];
}
