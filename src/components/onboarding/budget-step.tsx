"use client";

import { useState, useTransition } from "react";
import { updateBudget } from "@/actions/profile";
import { parseRMToSen, senToNumeric } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface BudgetStepProps {
  currentBudgetSen: number;
  defaultOpen?: boolean;
  trigger?: React.ReactNode;
}

export function BudgetStep({ currentBudgetSen, defaultOpen = false, trigger }: BudgetStepProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [value, setValue] = useState(currentBudgetSen > 0 ? senToNumeric(currentBudgetSen) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The layout and the card each mount their own BudgetStep, and useState only reads its initial
  // value once. Re-seed the field every time the sheet opens so it always shows the current budget.
  function handleOpenChange(next: boolean) {
    if (next) {
      setValue(currentBudgetSen > 0 ? senToNumeric(currentBudgetSen) : "");
      setError(null);
    }
    setOpen(next);
  }

  function save() {
    const budgetSen = parseRMToSen(value);
    if (budgetSen === null) {
      setError("Enter a valid amount, like 800 or 800.50.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateBudget({ budgetSen });
      if (result.ok) setOpen(false);
      else setError(result.message);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="bottom">
        <SheetHeader className="px-5 pt-6">
          <SheetTitle className="text-xl font-bold tracking-tight">
            {currentBudgetSen > 0 ? "Edit monthly budget" : "Set your monthly budget"}
          </SheetTitle>
          <SheetDescription>
            You can change this anytime — it applies to the rest of this month right away.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-5">
          <Label htmlFor="budget-input" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Monthly budget (RM)
          </Label>
          <Input
            id="budget-input"
            inputMode="decimal"
            placeholder="800.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="text-lg font-semibold tabular-nums"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <SheetFooter className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button size="lg" className="w-full" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
