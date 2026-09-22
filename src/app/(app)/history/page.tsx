import "server-only";

import React from "react";
import { todayMYT } from "@/lib/dates";
import { listCategories } from "@/actions/categories";
import { getTransactionsHistory } from "@/lib/queries/history";
import type { PaymentMethod } from "@/lib/validation/schemas";
import { HistoryView } from "./history-view";

export const dynamic = "force-dynamic";

interface HistoryPageProps {
  searchParams: Promise<{
    month?: string;
    categoryId?: string;
    payment?: string;
    essential?: string;
  }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const selectedMonth = params.month || todayMYT().slice(0, 7);
  const selectedCategoryId = params.categoryId || undefined;
  const selectedPayment = (params.payment as PaymentMethod) || undefined;
  const selectedEssential =
    params.essential === "needs"
      ? true
      : params.essential === "wants"
      ? false
      : undefined;

  const [categoriesRes, dayGroups] = await Promise.all([
    listCategories({ includeArchived: true }),
    getTransactionsHistory({
      month: selectedMonth,
      categoryId: selectedCategoryId,
      paymentMethod: selectedPayment,
      isEssential: selectedEssential,
    }),
  ]);

  const categories = categoriesRes.ok ? categoriesRes.data : [];

  return (
    <HistoryView
      key={`${selectedMonth}-${selectedCategoryId || ""}-${selectedPayment || ""}-${params.essential || ""}`}
      initialMonth={selectedMonth}
      initialCategoryId={selectedCategoryId || ""}
      initialPayment={selectedPayment || ""}
      initialEssential={selectedEssential === undefined ? null : selectedEssential}
      categories={categories}
      dayGroups={dayGroups}
    />
  );
}
