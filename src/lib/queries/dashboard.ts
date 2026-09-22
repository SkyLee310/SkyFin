import { createClient } from "@/lib/supabase/server";
import { monthRangeMYT, todayMYT } from "@/lib/dates";
import { toSen } from "@/lib/money";

export interface DashboardBudgetResult {
  budgetSen: number;
  spentSen: number;
  remainingSen: number;
  daysRemaining: number;
}

export interface NetCashFlowResult {
  incomeSen: number;
  expenseSen: number;
  netSen: number;
}

export async function getDashboardBudget(): Promise<DashboardBudgetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { budgetSen: 0, spentSen: 0, remainingSen: 0, daysRemaining: 0 };
  }

  // 1. Fetch user budget
  const { data: profile } = await supabase
    .from("profiles")
    .select("monthly_budget")
    .eq("id", user.id)
    .single();

  const budgetSen = profile?.monthly_budget ? toSen(profile.monthly_budget) : 0;

  // 2. Fetch current month expenses
  const range = monthRangeMYT();
  const { data: txs } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .gte("date", range.start)
    .lte("date", range.end);

  const spentSen = (txs || []).reduce((sum, r) => sum + toSen(r.amount), 0);
  const remainingSen = Math.max(0, budgetSen - spentSen);

  // 3. Days remaining in current MYT month
  const today = todayMYT();
  const todayDay = parseInt(today.slice(8, 10), 10);
  const endDay = parseInt(range.end.slice(8, 10), 10);
  const daysRemaining = Math.max(0, endDay - todayDay + 1);

  return {
    budgetSen,
    spentSen,
    remainingSen,
    daysRemaining,
  };
}

export async function getNetCashFlow(): Promise<NetCashFlowResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { incomeSen: 0, expenseSen: 0, netSen: 0 };
  }

  const range = monthRangeMYT();
  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, type")
    .eq("user_id", user.id)
    .gte("date", range.start)
    .lte("date", range.end);

  let incomeSen = 0;
  let expenseSen = 0;

  for (const t of txs || []) {
    const sen = toSen(t.amount);
    if (t.type === "income") {
      incomeSen += sen;
    } else {
      expenseSen += sen;
    }
  }

  return {
    incomeSen,
    expenseSen,
    netSen: incomeSen - expenseSen,
  };
}
