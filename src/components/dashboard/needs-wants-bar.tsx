import { pctOf } from "@/lib/stats";
import { SERIES } from "./chart-colors";
import { StackedBar } from "./stacked-bar";

/** Needs vs Wants this month, with last month's Wants share as a marker (PRD §9 item 6). */
export function NeedsWantsBar({
  needsSen,
  wantsSen,
  lastMonthWantsPct,
}: {
  needsSen: number;
  wantsSen: number;
  lastMonthWantsPct: number | null;
}) {
  const total = needsSen + wantsSen;
  const wantsPct = pctOf(wantsSen, total);
  return (
    <section id="needs-wants-bar" className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col gap-3">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Needs vs Wants</h3>
      <StackedBar
        id="needs-wants"
        segments={[
          { key: "needs", label: "Needs", sen: needsSen, pct: total > 0 ? 100 - wantsPct : 0, color: SERIES[0] },
          { key: "wants", label: "Wants", sen: wantsSen, pct: wantsPct, color: SERIES[1] },
        ]}
        marker={
          lastMonthWantsPct === null
            ? null
            : // The marker sits where Wants would start had last month's share held.
              { pct: 100 - lastMonthWantsPct, label: `Marker: last month's Wants share, ${lastMonthWantsPct}%` }
        }
      />
    </section>
  );
}
