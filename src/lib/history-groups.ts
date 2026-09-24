import { toSen } from "@/lib/money";

// History shows rows that share a receipt_group_id as one expandable group (FR-24).

interface GroupableRow {
  id: string;
  amount: number;
  type: "expense" | "income";
  merchant: string | null;
  receipt_url: string | null;
  receipt_group_id: string | null;
}

export type HistoryEntry<T extends GroupableRow> =
  | { kind: "row"; row: T }
  | {
      kind: "receipt";
      groupId: string;
      rows: T[];
      totalSen: number;
      merchant: string | null;
      receiptUrl: string | null;
    };

/** Collapses rows with the same receipt_group_id into one entry, placed where its first row was. */
export function groupReceiptRows<T extends GroupableRow>(rows: T[]): HistoryEntry<T>[] {
  const entries: HistoryEntry<T>[] = [];
  const groups = new Map<string, Extract<HistoryEntry<T>, { kind: "receipt" }>>();

  for (const row of rows) {
    if (!row.receipt_group_id) {
      entries.push({ kind: "row", row });
      continue;
    }
    let group = groups.get(row.receipt_group_id);
    if (!group) {
      group = {
        kind: "receipt",
        groupId: row.receipt_group_id,
        rows: [],
        totalSen: 0,
        merchant: row.merchant,
        receiptUrl: row.receipt_url,
      };
      groups.set(row.receipt_group_id, group);
      entries.push(group);
    }
    group.rows.push(row);
    group.totalSen += toSen(row.amount);
    group.merchant ??= row.merchant;
    group.receiptUrl ??= row.receipt_url;
  }

  // A group that a filter or a later edit left with one row reads better as a plain row.
  return entries.map((entry) =>
    entry.kind === "receipt" && entry.rows.length === 1 ? { kind: "row", row: entry.rows[0]! } : entry,
  );
}
