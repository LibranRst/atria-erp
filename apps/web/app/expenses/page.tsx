import React from "react";

import { redirect } from "next/navigation";

import { resolveActor } from "@/server/actor";

import { ExpenseList } from "@/features/expenses/components/lists/expense-list";
import { getExpensesPageData } from "@/features/expenses/server/get-expenses-page-data";

export const dynamic = "force-dynamic";

export default async function ExpensesPage(): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  const data = await getExpensesPageData(actor);

  // Loader hanya melapor; halaman web yang menerjemahkannya jadi redirect.
  if (data.status === "restricted") redirect("/projects");

  return (
    <section className="space-y-sm select-none">
      <ExpenseList
        initialCosts={data.initialCosts}
        bankAccounts={data.bankAccounts}
        userRole={data.userRole}
        vendorBills={data.vendorBills}
        vendorPayments={data.vendorPayments}
        vendors={data.vendors}
        projects={data.projects}
        pendingApprovalsCount={data.pendingApprovalsCount}
      />
    </section>
  );
}
