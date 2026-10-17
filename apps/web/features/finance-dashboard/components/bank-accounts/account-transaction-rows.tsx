import React from "react";

import { AppIcon, DuotoneIconTile, MoneyValue, RowGroup } from "@/components/ui";
import type { CashTransaction } from "@/features/finance-dashboard/types/bank-account-types";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

export function AccountTransactionRows({
  transactions,
}: {
  readonly transactions: readonly CashTransaction[];
}): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant/70 ring-1 ring-ring-subtle">
          <AppIcon name="history" className="icon-sm" />
        </span>
        <p className="mt-2.5 text-xs font-semibold text-on-surface">Belum ada mutasi</p>
        <p className="mt-1 text-meta text-on-surface-variant">
          Mutasi kas masuk, keluar, atau transfer akan tercatat di sini.
        </p>
      </div>
    );
  }

  return (
    <RowGroup>
      {transactions.map((transaction) => {
        const txDate = new Date(transaction.createdAt);
        const dateLabel = Number.isNaN(txDate.getTime()) ? "—" : txDate.toLocaleDateString("id-ID");

        return (
          <button
            type="button"
            onClick={() => openActivityDetail({ kind: "CASH_TRANSACTION", id: transaction.id })}
            key={transaction.id}
            className="flex min-h-14.5 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
          >
            <DuotoneIconTile
              name={transaction.type === "INFLOW" ? "south_west" : "north_east"}
              tone={transaction.type === "INFLOW" ? "neutral" : "critical"}
              className="h-9 w-9"
              iconClassName="icon-sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-on-surface">
                {transaction.description}
              </span>
              <span className="mt-0.5 block truncate text-meta text-on-surface-variant">
                {formatBusinessLabel(transaction.category, "FINANCE")} • {dateLabel}
              </span>
            </span>
            <MoneyValue
              amount={transaction.amount}
              variant="fullDynamic"
              prefix={transaction.type === "INFLOW" ? "+" : "-"}
              tone={transaction.type === "INFLOW" ? "primary" : "danger"}
              align="right"
              size="sm"
              className="shrink-0"
            />
            <ActivityDetailChevron />
          </button>
        );
      })}
    </RowGroup>
  );
}
