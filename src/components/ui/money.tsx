import { formatRM } from "@/lib/money";
import { cn } from "cn";

const PARTS = /^(-?)(RM )([\d,]+)(\.\d{2})$/;

/**
 * A money figure in the LedgerUI style: large ringgit, with the "RM" and the sen set smaller
 * and the sen muted. It only restyles formatRM's string, and the spans sit side by side with no
 * whitespace between them, so screen readers and tests still read "RM 1,234.50".
 */
export function Money({ sen, id, className }: { sen: number; id?: string; className?: string }) {
  const text = formatRM(sen);
  const parts = PARTS.exec(text);
  if (!parts) {
    return (
      <span id={id} className={cn("tabular-nums", className)}>
        {text}
      </span>
    );
  }
  const [, sign, prefix, ringgit, cents] = parts;
  return (
    <span id={id} className={cn("tabular-nums", className)}>
      {sign}
      <span className="text-[0.55em]">{prefix}</span>
      {ringgit}
      <span className="text-[0.55em] text-ink-muted">{cents}</span>
    </span>
  );
}
