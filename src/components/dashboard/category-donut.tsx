"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart } from "recharts";
import { formatRM } from "@/lib/money";
import type { CategoryStat } from "@/lib/stats";
import { OTHER, SERIES } from "./chart-colors";

interface Slice {
  key: string;
  categoryId: string | null;
  name: string;
  sen: number;
  pct: number;
  color: string;
}

function slices(categories: CategoryStat[], totalSen: number): Slice[] {
  const shown = categories.length > SERIES.length ? categories.slice(0, SERIES.length - 1) : categories;
  const out: Slice[] = shown.map((c, i) => ({
    key: c.categoryId,
    categoryId: c.categoryId,
    name: c.name,
    sen: c.sen,
    pct: c.pct,
    color: SERIES[i]!,
  }));
  const rest = categories.slice(shown.length);
  if (rest.length > 0) {
    const sen = rest.reduce((sum, c) => sum + c.sen, 0);
    out.push({
      key: "other",
      categoryId: null,
      name: `Other (${rest.length})`,
      sen,
      pct: totalSen > 0 ? Math.round((sen * 100) / totalSen) : 0,
      color: OTHER,
    });
  }
  return out;
}

/** Expense categories this month (PRD §9 item 4). Tapping a slice or its row opens History filtered to it (F9-3). */
export function CategoryDonut({
  categories,
  totalSen,
  month,
}: {
  categories: CategoryStat[];
  totalSen: number;
  month: string;
}) {
  const router = useRouter();
  const data = slices(categories, totalSen);
  const hrefFor = (s: Slice) =>
    s.categoryId ? `/history?month=${month}&categoryId=${s.categoryId}` : `/history?month=${month}`;

  return (
    <section
      id="category-donut"
      aria-labelledby="category-donut-title"
      className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm"
    >
      <h3 id="category-donut-title" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
        Where it went
      </h3>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No expenses yet this month.</p>
      ) : (
        <>
          <div className="relative mx-auto my-3 w-[180px] h-[180px]">
            <PieChart width={180} height={180} accessibilityLayer>
              <Pie
                data={data}
                dataKey="sen"
                nameKey="name"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={data.length > 1 ? 2 : 0}
                stroke="#ffffff"
                strokeWidth={2}
                isAnimationActive={false}
                onClick={(_, index) => {
                  const slice = data[index];
                  if (slice) router.push(hrefFor(slice));
                }}
                className="cursor-pointer"
              >
                {data.map((s) => (
                  <Cell key={s.key} fill={s.color} name={s.name} data-testid={`donut-slice-${s.name}`} />
                ))}
              </Pie>
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] text-slate-400">Spent</span>
              <span id="donut-total" className="text-sm font-extrabold text-slate-900">
                {formatRM(totalSen)}
              </span>
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-slate-100">
            {data.map((s) => (
              <li key={s.key}>
                <Link
                  href={hrefFor(s)}
                  data-testid="donut-legend-row"
                  className="flex items-center gap-2.5 min-h-[44px] text-sm"
                >
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} aria-hidden />
                  <span className="flex-1 text-slate-700 truncate">{s.name}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{s.pct}%</span>
                  <span className="w-24 text-right font-semibold text-slate-900 tabular-nums">{formatRM(s.sen)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
