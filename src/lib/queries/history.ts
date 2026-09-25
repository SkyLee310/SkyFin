import "server-only";

import { createClient } from "@/lib/supabase/server";
import { monthRangeMYT, todayMYT } from "@/lib/dates";
import { toSen } from "@/lib/money";
import { PaymentMethod } from "@/lib/validation/schemas";
import { TransactionRecord } from "@/actions/transactions";
import { RECEIPTS_BUCKET } from "@/lib/receipts";

export interface HistoryItem extends TransactionRecord {
  category_name: string;
}

export interface DayGroup {
  date: string; // YYYY-MM-DD
  totalExpenseSen: number;
  totalIncomeSen: number;
  transactions: HistoryItem[];
}

export interface HistoryFilters {
  month?: string; // YYYY-MM
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  isEssential?: boolean;
}

export async function getTransactionsHistory(
  filters: HistoryFilters = {}
): Promise<DayGroup[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const targetMonth = filters.month || todayMYT().slice(0, 7);
  const range = monthRangeMYT(`${targetMonth}-01`);

  let query = supabase
    .from("transactions")
    .select(`
      *,
      categories!inner(name)
    `)
    .eq("user_id", user.id)
    .gte("date", range.start)
    .lte("date", range.end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (filters.paymentMethod) {
    query = query.eq("payment_method", filters.paymentMethod);
  }

  if (filters.isEssential !== undefined) {
    query = query.eq("is_essential", filters.isEssential);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // Group by day string
  const groupsMap = new Map<string, DayGroup>();

  for (const row of data) {
    const dateStr = row.date;
    const catName = (row.categories as { name: string })?.name || "Unknown";
    const item: HistoryItem = {
      ...row,
      category_name: catName,
    };

    let group = groupsMap.get(dateStr);
    if (!group) {
      group = {
        date: dateStr,
        totalExpenseSen: 0,
        totalIncomeSen: 0,
        transactions: [],
      };
      groupsMap.set(dateStr, group);
    }

    const sen = toSen(row.amount);
    if (row.type === "expense") {
      group.totalExpenseSen += sen;
    } else {
      group.totalIncomeSen += sen;
    }
    group.transactions.push(item);
  }

  return Array.from(groupsMap.values());
}

/**
 * 1-hour signed URLs for the receipt photos on these rows, keyed by object path (TECH_SPEC §4.3).
 * Made with the session client, so RLS still decides which photos the user can see.
 */
export async function getReceiptThumbnails(dayGroups: DayGroup[]): Promise<Record<string, string>> {
  const paths = [
    ...new Set(dayGroups.flatMap((g) => g.transactions.map((t) => t.receipt_url).filter((p): p is string => !!p))),
  ];
  if (paths.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrls(paths, 3600);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
  }
  return urls;
}
