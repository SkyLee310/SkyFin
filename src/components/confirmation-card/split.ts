// Receipt split rows (FR-15–FR-17). All sums are integer sen, so no phantom RM 0.01 remainder.

export interface SplitRow {
  key: string;
  amountSen: number;
  categoryId: string;
  isEssential: boolean;
}

/** Receipt total minus the rows so far: 0 when fully split, negative when over. */
export function remainingSen(totalSen: number, rows: SplitRow[]): number {
  return rows.reduce((left, row) => left - row.amountSen, totalSen);
}

/** Save is allowed only when every row has an amount and a category and nothing is left over. */
export function isSplitComplete(totalSen: number, rows: SplitRow[]): boolean {
  return (
    totalSen > 0 &&
    rows.length >= 2 &&
    rows.every((r) => r.amountSen > 0 && r.categoryId !== "") &&
    remainingSen(totalSen, rows) === 0
  );
}
