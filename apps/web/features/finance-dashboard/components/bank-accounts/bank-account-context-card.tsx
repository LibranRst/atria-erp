import React from "react";

import { MoneyValue } from "@/components/ui";
import type { BankAccount } from "@/features/finance-dashboard/types/bank-account-types";

export function BankAccountContextCard({
  account,
  eyebrow = "Rekening Sumber",
}: {
  readonly account: BankAccount;
  readonly eyebrow?: string;
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
            {eyebrow}
          </p>
          <h3 className="mt-0.5 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
            {account.name}
          </h3>
          <p className="mt-0.5 truncate text-meta font-medium text-on-surface-variant/75">
            {account.bankName}
            {account.accountNumber ? ` · ${account.accountNumber}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Saldo Saat Ini
          </p>
          <div className="mt-0.5">
            <MoneyValue
              amount={Number(account.balance)}
              variant="fullDynamic"
              size="sm"
              align="right"
              className="font-bold text-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
