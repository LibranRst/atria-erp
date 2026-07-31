import React from "react";

import { ExpenseForm } from "@/features/expenses/components/forms/expense-form";
import { getNewExpensePageData } from "@/features/expenses/server/get-new-expense-page-data";

export const dynamic = "force-dynamic";

export default async function NewExpensePage(): Promise<React.JSX.Element> {
  const data = await getNewExpensePageData();

  return (
    <section className="space-y-sm select-none">
      <ExpenseForm projects={data.projects} inventoryLocations={data.inventoryLocations} />
    </section>
  );
}
