"use client";

import React from "react";
import type {
  MaterialMovementView,
  MaterialOperationsDashboard,
} from "@/app/actions/material/operations-dashboard";
import { MoneyValue } from "@/components/ui/page-primitives";
import {
  ApprovalRow,
  MovementRow,
  Section,
} from "@/features/materials/components/material-operation-sheets";
import type { MaterialOperationDecision } from "@/features/materials/components/material-dashboard-types";

type OverviewTabProps = {
  readonly data: MaterialOperationsDashboard;
  readonly totalStockValue: number;
  readonly availableValue: number;
  readonly lowCount: number;
  readonly pendingApprovals: number;
  readonly movements: readonly MaterialMovementView[];
  readonly onDecision: (decision: MaterialOperationDecision) => void;
};

export function MaterialOverviewTab({
  data,
  totalStockValue,
  availableValue,
  lowCount,
  pendingApprovals,
  movements,
  onDecision,
}: OverviewTabProps): React.JSX.Element {
  const shortages = data.shortages.filter((row) => row.needToBuy > 0).length;
  const attention = [
    ...(shortages > 0 ? [{ id: "shortage", label: "Kebutuhan RAP belum tertutup", value: shortages, icon: "production_quantity_limits", tone: "text-error bg-error/10" }] : []),
    ...(lowCount > 0 ? [{ id: "low-stock", label: "Stok menyentuh batas minimum", value: lowCount, icon: "inventory", tone: "text-warning bg-warning-light" }] : []),
    ...(pendingApprovals > 0 ? [{ id: "approval", label: "Keputusan stok menunggu", value: pendingApprovals, icon: "approval", tone: "text-primary bg-primary/8" }] : []),
  ].slice(0, 3);

  return (
    <div className="space-y-md">
      <section className="overflow-hidden rounded-[28px] bg-primary p-md text-on-primary shadow-[0_16px_38px_rgba(17,17,17,0.14)]">
        <div className="grid grid-cols-2 gap-2">
          <StockValue label="Total stock" value={totalStockValue} />
          <StockValue label="Siap dipakai" value={availableValue} />
          <div className="rounded-2xl bg-white/8 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/55">
              Low / Reserved
            </p>
            <p className="mt-1 font-mono text-lg font-bold">{lowCount}</p>
          </div>
          <div className="rounded-2xl bg-white/8 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/55">
              Pending approval
            </p>
            <p className="mt-1 font-mono text-lg font-bold">{pendingApprovals}</p>
          </div>
        </div>
      </section>

      <Section title="Perlu perhatian" contentClassName="divide-y divide-outline-variant/35">
        {attention.length === 0 ? (
          <p className="rounded-2xl bg-surface-container-low p-4 text-xs font-medium text-primary">
            Tidak ada shortage, low stock, atau keputusan tertunda.
          </p>
        ) : attention.map((item) => (
          <div key={item.id} className="flex min-h-14 items-center gap-3 px-1 py-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            </span>
            <p className="min-w-0 flex-1 text-xs font-bold text-on-surface">{item.label}</p>
            <span className="font-mono text-sm font-bold text-on-surface">{item.value}</span>
          </div>
        ))}
      </Section>

      {pendingApprovals > 0 && (
        <Section title="Needs Approval">
          {data.counts
            .filter((row) => row.status === "PENDING_APPROVAL")
            .map((row) => (
              <ApprovalRow
                key={row.id}
                title={row.countNumber}
                description={`${row.locationName} · ${row.items.length} material`}
                onApprove={() =>
                  onDecision({ type: "COUNT_APPROVE", id: row.id })
                }
                onReject={() =>
                  onDecision({ type: "COUNT_REJECT", id: row.id })
                }
              />
            ))}
          {data.receipts
            .filter((row) => row.status === "REVERSAL_REQUESTED")
            .map((row) => (
              <ApprovalRow
                key={row.id}
                title={`Reverse ${row.receiptNumber}`}
                description={row.projectName}
                amount={row.total}
                onApprove={() =>
                  onDecision({ type: "RECEIPT_APPROVE", id: row.id })
                }
                onReject={() =>
                  onDecision({ type: "RECEIPT_REJECT", id: row.id })
                }
              />
            ))}
        </Section>
      )}

      <Section
        title="Recent Activity"
        contentClassName="divide-y divide-outline-variant/35"
      >
        {movements.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-xs leading-5 text-on-surface-variant ring-1 ring-outline-variant/10">
            Belum ada movement stock yang tercatat.
          </p>
        ) : (
          movements.slice(0, 5).map((row) => (
            <MovementRow key={row.id} row={row} />
          ))
        )}
      </Section>
    </div>
  );
}

function StockValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wide text-white/55">
        {label}
      </p>
      <MoneyValue
        amount={value}
        variant="compactWithFull"
        tone="inverse"
        size="lg"
        className="mt-1"
      />
    </div>
  );
}
