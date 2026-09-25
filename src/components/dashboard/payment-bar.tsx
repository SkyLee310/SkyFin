import type { PaymentStat } from "@/lib/stats";
import { SERIES } from "./chart-colors";
import { StackedBar } from "./stacked-bar";

/** Cash vs eWallet vs Card this month (PRD §9 item 5). */
export function PaymentBar({ payments }: { payments: PaymentStat[] }) {
  return (
    <section id="payment-bar" className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col gap-3">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paid with</h3>
      <StackedBar
        id="payment"
        segments={payments.map((p, i) => ({ key: p.method, label: p.method, sen: p.sen, pct: p.pct, color: SERIES[i]! }))}
      />
    </section>
  );
}
