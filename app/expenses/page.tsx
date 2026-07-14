import React from "react";

import { ExpenseList } from "@/features/expenses/components/expense-list";
import { getExpensesPageData } from "@/features/expenses/server/expenses-page-data";

export default async function ExpensesPage(): Promise<React.JSX.Element> {
  const data = await getExpensesPageData();

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
