import React from "react";
import { BottomNav } from "@/components/nav/bottom-nav";
import { BudgetStep } from "@/components/onboarding/budget-step";
import { getProfile } from "@/lib/queries/profile";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 pb-20">{children}</div>
      <BottomNav />
      <BudgetStep currentBudgetSen={profile.budgetSen} defaultOpen={profile.budgetSen === 0} />
    </div>
  );
}
