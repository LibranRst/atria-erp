"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { BankAccountsControl } from "@/features/finance-dashboard/components/bank-accounts/bank-accounts-control";

export function AccountsTab({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  return (
    <BankAccountsControl
      accounts={data.bankAccounts}
      role={data.role}
      variant="tab"
      payablesDueSoon={data.summary.payablesDueSoon}
    />
  );
}
