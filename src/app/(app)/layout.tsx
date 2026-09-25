import React from "react";
import { BottomNav } from "@/components/nav/bottom-nav";
import { BudgetStep } from "@/components/onboarding/budget-step";
import { WarningBanner } from "@/components/banner/warning-banner";
import { BudgetAppliedBanner } from "@/components/banner/budget-applied-banner";
import { PushResubscribe } from "@/components/onboarding/push-resubscribe";
import { monthName } from "@/lib/i18n";
import { getProfile } from "@/lib/queries/profile";
import { getShellState } from "@/lib/queries/shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, shell] = await Promise.all([getProfile(), getShellState()]);
  const hasBanner = shell.warnings.length > 0 || shell.budgetApplied !== null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Banner slot: warnings show on every tab, so one raised by a save in Chat is seen there. */}
      {hasBanner && (
        <div className="flex flex-col gap-2 px-4 pt-4">
          {shell.budgetApplied && (
            <BudgetAppliedBanner
              notice={shell.budgetApplied}
              monthLabel={monthName(shell.budgetApplied.month, "en")}
            />
          )}
          <WarningBanner warnings={shell.warnings} />
        </div>
      )}
      <div className="flex-1 pb-20">{children}</div>
      <BottomNav unreadAudits={shell.unreadAudits} />
      <BudgetStep currentBudgetSen={profile.budgetSen} defaultOpen={profile.budgetSen === 0} />
      <PushResubscribe />
    </div>
  );
}
