import React from "react";

import { redirect } from "next/navigation";

import { resolveActor } from "@/server/actor";

import { ExpenseForm } from "@/features/expenses/components/forms/expense-form";
import { getNewExpensePageData } from "@/features/expenses/server/get-new-expense-page-data";

export const dynamic = "force-dynamic";

export default async function NewExpensePage(): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  const data = await getNewExpensePageData(actor);

  return (
    <section className="space-y-sm select-none">
      <ExpenseForm projects={data.projects} inventoryLocations={data.inventoryLocations} />
    </section>
  );
}
