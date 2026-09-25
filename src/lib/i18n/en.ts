import { formatRM } from "@/lib/money";

// Text for warnings, pushes and stats-only audits (PRD §8), chosen by preferred_language. UI
// chrome stays English. Every figure is computed before it gets here; templates only place it.

function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export const en = {
  locale: "en-MY",
  warning: {
    half: (budgetSen: number, daysLeft: number) =>
      `Half your ${formatRM(budgetSen)} budget is used, ${days(daysLeft)} left.`,
    eighty: (budgetSen: number, daysLeft: number) =>
      `80% of your ${formatRM(budgetSen)} budget is used, with ${days(daysLeft)} left.`,
    usedUp: (budgetSen: number) => `You've used your whole ${formatRM(budgetSen)} budget for this month.`,
    exceeded: (overSen: number) => `Budget exceeded by ${formatRM(overSen)}. Consider a no-spend weekend.`,
    pace: (fasterPct: number, outOfCashDay: number) =>
      `You're spending ${fasterPct}% faster than planned. At this pace you run out on the ${ordinal(outOfCashDay)}.`,
    spike: (amountSen: number, where: string | null, pct: number) =>
      `${formatRM(amountSen)}${where ? ` at ${where}` : ""} is ${pct}% of this month's budget. Is this a one-off purchase?`,
  },
  push: {
    warningTitle: "SkyFin budget alert",
    weeklyTitle: "Your weekly audit is ready",
    monthlyTitle: "Your monthly review is ready",
    budgetAppliedTitle: "New monthly budget",
    budgetApplied: (month: string, budgetSen: number) =>
      `Your budget for ${month} is ${formatRM(budgetSen)} — tap to change`,
  },
  // Stats-only audit text, used when the model's answer can't be used (TECH_SPEC §5.4).
  audit: {
    headline: (totalSen: number, wantsPct: number) =>
      `You spent ${formatRM(totalSen)}, and ${wantsPct}% of it went on wants.`,
    tipMicro: (label: string) => ({
      title: `Halve the ${label} runs`,
      detail: `Small ${label} buys add up fast. Skip every other one, or bring your own from home.`,
    }),
    tipCategory: (name: string) => ({
      title: `Trim ${name}`,
      detail: `Give ${name} a weekly cap and check what's left before you pay.`,
    }),
    tipOverall: () => ({
      title: "Plan a no-spend day each week",
      detail: "Eat at the mamak or kolej café instead of a café, and take the campus bus.",
    }),
    tipCheck: () => ({
      title: "Pause before you tap",
      detail: "Before each eWallet or card payment, ask yourself: need or want?",
    }),
  },
};

export type Messages = typeof en;
