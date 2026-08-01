"use client";

import React from "react";

import {
  AppIcon,
  EmptyState,
  GroupedSurface,
  MoneyValue,
  SectionHeader,
  SegmentedTabs,
  SummaryFact,
  SummarySurface,
} from "@/components/ui";
import { usePreservedScrollHeight } from "@/lib/hooks/use-preserved-scroll-height";
import type { ExpenseCostItem, FilterStatus } from "@/features/expenses/types/expense-list-types";
import { FieldClaimHistory } from "@/features/expenses/components/lists/field-claim-rows";
import { FieldClaimRow } from "@/features/expenses/components/lists/field-claim-rows";
type FilterTab = {
  readonly label: string;
  readonly value: FilterStatus;
  readonly count: number;
};

type FieldClaimsPanelProps = {
  readonly leadingContent?: React.ReactNode;
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
  leadingContent,
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
  const {
    containerRef: resultsRef,
    containerStyle: resultsStyle,
    preserveScrollPosition,
  } = usePreservedScrollHeight(filter);
  const hasNoRows = filter === "ALL" ? initialCosts.length === 0 : filteredCosts.length === 0;
  const visibleCosts = filteredCosts.slice(0, visibleLimit);

  function changeFilter(value: FilterStatus): void {
    preserveScrollPosition();
    setVisibleLimit(20);
    onFilterChange(value);
  }

  return (
    <div className="space-y-sm">
      <div className="space-y-3" data-expense-overview-cluster>
        {leadingContent}
        <FieldClaimsSummary
          projectId={projectId}
          needsActionCount={needsActionCount}
          readyToPayCount={readyToPayCount}
          activeClaimTotal={activeClaimTotal}
          onOpenExpenseDrawer={onOpenExpenseDrawer}
        />
      </div>

      <SegmentedTabs
        value={filter}
        onChange={changeFilter}
        ariaLabel="Filter pengeluaran"
        scrollable
        density="compact"
        options={filterTabs.map((tab) => ({
          value: tab.value,
          label: tab.label,
          count: tab.count,
        }))}
      />

      <div ref={resultsRef} style={resultsStyle}>
        {hasNoRows ? (
          <GroupedSurface>
            <EmptyState
              icon="receipt_long"
              title="Tidak Ada Pengajuan"
              description="Tidak ada pengajuan pengeluaran biaya lapangan dalam kategori filter ini."
            />
          </GroupedSurface>
        ) : (
          <div className="space-y-3">
            <SectionHeader
              title={
                filter === "ALL"
                  ? "Pengeluaran aktif"
                  : (filterTabs.find((tab) => tab.value === filter)?.label ?? "Pengeluaran")
              }
              count={filteredCosts.length}
              countLabel="Pengajuan"
            />
            <GroupedSurface>
              <div className="divide-y divide-black/5.5">
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
            </GroupedSurface>

            {filteredCosts.length > visibleLimit ? (
              <button
                type="button"
                onClick={() => setVisibleLimit((current) => current + 20)}
                className="min-h-12 w-full rounded-full bg-surface-container text-xs leading-4 font-bold text-on-surface"
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
      </div>
    </div>
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
  return (
    <SummarySurface
      ariaLabel="Posisi pengeluaran lapangan"
      eyebrow="Pengeluaran lapangan"
      icon="receipt_long"
      status={needsActionCount > 0 ? `${needsActionCount} perlu aksi` : "Terkendali"}
      statusTone={needsActionCount > 0 ? "warning" : "positive"}
      action={
        projectId ? (
          <button
            type="button"
            onClick={onOpenExpenseDrawer}
            className="relative inline-flex h-8 items-center justify-center gap-1 rounded-full bg-accent/8 px-3 text-meta font-semibold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-accent/[0.14]"
          >
            <AppIcon name="add" className="icon-xs leading-none" />
            Tambah
          </button>
        ) : undefined
      }
    >
      <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
        <div className="min-w-0">
          <p className="text-eyebrow font-semibold text-on-surface-variant/60">Total aktif</p>
          <MoneyValue
            amount={activeClaimTotal}
            variant="compactWithFull"
            size="lg"
            className="mt-1"
          />
        </div>
        <p className="max-w-36.25 text-right text-meta text-on-surface-variant/70">
          Dana yang masih berada dalam alur verifikasi hingga pencairan.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-2">
        <SummaryFact
          label="Butuh aksi"
          value={String(needsActionCount)}
          tone={needsActionCount > 0 ? "warning" : "default"}
        />
        <SummaryFact
          label="Siap dicairkan"
          value={String(readyToPayCount)}
          tone={readyToPayCount > 0 ? "positive" : "default"}
        />
      </div>
    </SummarySurface>
  );
}
