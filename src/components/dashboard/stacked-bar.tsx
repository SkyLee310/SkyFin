import { formatRM } from "@/lib/money";

export interface BarSegment {
  key: string;
  label: string;
  sen: number;
  pct: number;
  color: string;
}

/**
 * A 100% stacked bar with its legend below, where every segment's RM and % is always shown, so
 * nothing waits on a hover or a tap (PRD §9). The bar itself is a picture of the legend and
 * isn't a tap target.
 */
export function StackedBar({
  id,
  segments,
  marker,
}: {
  id: string;
  segments: BarSegment[];
  /** Optional marker along the bar, e.g. last month's Wants %. */
  marker?: { pct: number; label: string } | null;
}) {
  const total = segments.reduce((sum, s) => sum + s.sen, 0);
  const visible = segments.filter((s) => s.sen > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative pt-1" aria-hidden>
        <div className="flex h-4 w-full gap-[2px] rounded-full overflow-hidden bg-slate-100" data-testid={`${id}-bar`}>
          {visible.map((s) => (
            <span
              key={s.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${total > 0 ? (s.sen * 100) / total : 0}%`, background: s.color }}
            />
          ))}
        </div>
        {marker && (
          <div
            data-testid={`${id}-marker`}
            className="absolute top-0 bottom-[-6px] w-[2px] bg-slate-900"
            style={{ left: `calc(${Math.min(100, Math.max(0, marker.pct))}% - 1px)` }}
          />
        )}
      </div>
      {marker && <p className="text-[11px] text-slate-500 -mt-1">{marker.label}</p>}
      <ul className="flex flex-col">
        {segments.map((s) => (
          <li key={s.key} data-testid={`${id}-row`} className="flex items-center gap-2.5 min-h-[36px] text-sm px-1">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} aria-hidden />
            <span className="flex-1 text-slate-700">{s.label}</span>
            <span className="text-xs text-slate-400 tabular-nums">{s.pct}%</span>
            <span className="w-24 text-right font-semibold text-slate-900 tabular-nums">{formatRM(s.sen)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
