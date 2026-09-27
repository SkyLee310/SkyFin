import type { PaymentStat } from "@/lib/stats";
import { SERIES } from "./chart-colors";
import { StackedBar } from "./stacked-bar";

/** Cash vs eWallet vs Card this month (PRD §9 item 5). */
export function PaymentBar({ payments }: { payments: PaymentStat[] }) {
  return (
    <section id="payment-bar" className="flex flex-col gap-4 rounded-[22px] bg-surface p-5 text-ink shadow-card">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Paid with</h3>
      <StackedBar
        id="payment"
        segments={payments.map((p, i) => ({ key: p.method, label: p.method, sen: p.sen, pct: p.pct, color: SERIES[i]! }))}
      />
    </section>
  );
}
