"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart } from "recharts";
import { formatRM } from "@/lib/money";
import type { CategoryStat } from "@/lib/stats";
import { Money } from "@/components/ui/money";
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
      className="rounded-[22px] bg-surface p-5 text-ink shadow-card"
    >
      <h3 id="category-donut-title" className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Where it went
      </h3>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No expenses yet this month.</p>
      ) : (
        <>
          <div className="relative mx-auto my-4 h-[188px] w-[188px]">
            <PieChart width={188} height={188} accessibilityLayer>
              <Pie
                data={data}
                dataKey="sen"
                nameKey="name"
                innerRadius={70}
                outerRadius={92}
                paddingAngle={data.length > 1 ? 2 : 0}
                cornerRadius={4}
                stroke="var(--surface)"
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
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Spent</span>
              <Money id="donut-total" sen={totalSen} className="mt-0.5 text-xl font-bold tracking-tight" />
            </div>
          </div>

          <ul className="flex flex-col">
            {data.map((s) => (
              <li key={s.key}>
                <Link
                  href={hrefFor(s)}
                  data-testid="donut-legend-row"
                  className="flex min-h-[52px] flex-col justify-center gap-1.5 py-2 text-sm"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="size-2.5 flex-shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                    <span className="flex-1 truncate font-medium">{s.name}</span>
                    <span className="text-xs text-ink-muted tabular-nums">{s.pct}%</span>
                    <span className="w-24 text-right font-semibold tabular-nums">{formatRM(s.sen)}</span>
                  </span>
                  <span className="block h-1 w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
