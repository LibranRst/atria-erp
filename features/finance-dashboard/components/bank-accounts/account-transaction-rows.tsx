import React from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { MoneyValue, RowGroup } from "@/components/ui";
import { DashboardTabEmpty } from "@/features/finance-dashboard/components/shared/dashboard-row-primitives";
import type { CashTransaction } from "@/features/finance-dashboard/types/bank-account-types";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";

function transactionIcon(transaction: CashTransaction): React.ReactNode {
  if (transaction.type === "INFLOW") {
    return <ArrowDownLeft className="h-4 w-4" />;
  }
  return <ArrowUpRight className="h-4 w-4" />;
}

export function AccountTransactionRows({
  transactions,
}: {
  readonly transactions: readonly CashTransaction[];
}): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  if (transactions.length === 0) {
    return <DashboardTabEmpty>Belum ada mutasi pada rekening ini.</DashboardTabEmpty>;
  }

  return (
    <RowGroup>
      {transactions.map((transaction) => (
        <button
          type="button"
          onClick={() => openActivityDetail({ kind: "CASH_TRANSACTION", id: transaction.id })}
          key={transaction.id}
          className="flex min-h-14.5 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              transaction.type === "INFLOW" ? "bg-primary/8 text-primary" : "bg-error/8 text-error"
            }`}
          >
            {transactionIcon(transaction)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-on-surface">
              {transaction.description}
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-on-surface-variant">
              {formatBusinessLabel(transaction.category, "FINANCE")} •{" "}
              {transaction.createdAt.toLocaleDateString("id-ID")}
            </span>
          </span>
          <MoneyValue
            amount={transaction.amount}
            variant="compactWithFull"
            prefix={transaction.type === "INFLOW" ? "+" : "-"}
            tone={transaction.type === "INFLOW" ? "primary" : "danger"}
            align="right"
            size="sm"
            className="shrink-0"
          />
          <ActivityDetailChevron />
        </button>
      ))}
    </RowGroup>
  );
}
