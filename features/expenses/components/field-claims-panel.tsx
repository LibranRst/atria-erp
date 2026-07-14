"use client";

import React from "react";

import {
  EmptyState,
  MoneyValue,
  NativeSection,
  PillTabs,
} from "@/components/ui/page-primitives";
import type {
  ExpenseCostItem,
  FilterStatus,
} from "@/features/expenses/components/expense-list-types";
import {
  FieldClaimHistory,
  FieldClaimRow,
} from "@/features/expenses/components/field-claim-rows";

type FilterTab = {
  readonly label: string;
  readonly value: FilterStatus;
  readonly count: number;
};

type FieldClaimsPanelProps = {
  readonly projectId?: string;
  readonly initialCosts: readonly ExpenseCostItem[];
  readonly filteredCosts: readonly ExpenseCostItem[];
  readonly filter: FilterStatus;
  readonly filterTabs: readonly FilterTab[];
  readonly needsActionCount: number;
  readonly readyToPayCount: number;
  readonly activeClaimTotal: number;
  readonly isOwnerOrFinance: boolean;
  readonly pending: boolean;
  readonly historyExpanded: boolean;
  readonly onFilterChange: (value: FilterStatus) => void;
  readonly onHistoryExpandedChange: (value: boolean) => void;
  readonly onOpenExpenseDrawer: () => void;
  readonly onVerify: (cost: ExpenseCostItem) => void;
  readonly onDisburse: (cost: ExpenseCostItem) => void;
  readonly onOpenReceipt: (imageUrl: string) => void;
};

export function FieldClaimsPanel({
  projectId,
  initialCosts,
  filteredCosts,
  filter,
  filterTabs,
  needsActionCount,
  readyToPayCount,
  activeClaimTotal,
  isOwnerOrFinance,
  pending,
  historyExpanded,
  onFilterChange,
  onHistoryExpandedChange,
  onOpenExpenseDrawer,
  onVerify,
  onDisburse,
  onOpenReceipt,
}: FieldClaimsPanelProps): React.JSX.Element {
  const [visibleLimit, setVisibleLimit] = React.useState(20);
  const hasNoRows =
    filter === "ALL" ? initialCosts.length === 0 : filteredCosts.length === 0;
  const visibleCosts = filteredCosts.slice(0, visibleLimit);

  return (
    <>
      <FieldClaimsSummary
        projectId={projectId}
        needsActionCount={needsActionCount}
        readyToPayCount={readyToPayCount}
        activeClaimTotal={activeClaimTotal}
        onOpenExpenseDrawer={onOpenExpenseDrawer}
      />

      <PillTabs
        value={filter}
        onChange={(value) => {
          setVisibleLimit(20);
          onFilterChange(value);
        }}
        ariaLabel="Filter pengeluaran"
        options={filterTabs.map((tab) => ({
          value: tab.value,
          label: tab.label,
          count: tab.count,
        }))}
      />

      {hasNoRows ? (
        <EmptyState
          icon="receipt_long"
          title="Tidak Ada Pengajuan"
          description="Tidak ada pengajuan pengeluaran biaya lapangan dalam kategori filter ini."
        />
      ) : (
        <div className="space-y-md">
          <div className="space-y-2.5">
            {visibleCosts.map((cost) => (
              <FieldClaimRow
                key={cost.id}
                cost={cost}
                isOwnerOrFinance={isOwnerOrFinance}
                pending={pending}
                onVerify={onVerify}
                onDisburse={onDisburse}
                onOpenReceipt={onOpenReceipt}
              />
            ))}
          </div>

          {filteredCosts.length > visibleLimit ? (
            <button
              type="button"
              onClick={() => setVisibleLimit((current) => current + 20)}
              className="min-h-12 w-full rounded-full bg-surface-container text-xs font-bold text-on-surface"
            >
              Tampilkan 20 berikutnya
            </button>
          ) : null}

          {filter === "ALL" && (
            <FieldClaimHistory
              costs={initialCosts}
              expanded={historyExpanded}
              onExpandedChange={onHistoryExpandedChange}
              onOpenReceipt={onOpenReceipt}
            />
          )}
        </div>
      )}
    </>
  );
}

function FieldClaimsSummary({
  projectId,
  needsActionCount,
  readyToPayCount,
  activeClaimTotal,
  onOpenExpenseDrawer,
}: {
  readonly projectId?: string;
  readonly needsActionCount: number;
  readonly readyToPayCount: number;
  readonly activeClaimTotal: number;
  readonly onOpenExpenseDrawer: () => void;
}): React.JSX.Element {
  const metrics = (
    <div className="grid grid-cols-[0.8fr_0.8fr_1.4fr] divide-x divide-outline-variant/12 rounded-[22px] bg-surface-container-low px-1 py-2.5">
      <InboxMetric label="Butuh aksi" value={String(needsActionCount)} />
      <InboxMetric label="Siap cair" value={String(readyToPayCount)} />
      <div className="min-w-0 px-2.5">
        <p className="text-[8px] font-bold uppercase tracking-wide text-on-surface-variant">Total aktif</p>
        <MoneyValue amount={activeClaimTotal} variant="compactWithFull" size="xs" className="mt-1" />
      </div>
    </div>
  );

  if (!projectId) {
    return <NativeSection>{metrics}</NativeSection>;
  }

  return (
    <NativeSection
      eyebrow="Field Claims"
      title="Pengeluaran Lapangan"
      action={
        <button
          type="button"
          onClick={onOpenExpenseDrawer}
          className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-on-primary shadow-sm active:scale-95"
        >
          <span className="material-symbols-outlined text-[16px]">
            add_circle
          </span>
          Tambah
        </button>
      }
    >
      {metrics}
    </NativeSection>
  );
}

function InboxMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="min-w-0 px-2.5">
      <p className="truncate text-[8px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-on-surface">{value}</p>
    </div>
  );
}
