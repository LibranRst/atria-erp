"use client";

import React from "react";

import { EmptyState, MoneyValue } from "@/components/ui/page-primitives";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  ExpensesGroupSurface,
  ExpensesSectionHeader,
  ExpensesSummarySurface,
} from "@/features/expenses/components/expenses-primitives";
import type {
  ExpenseCostItem,
  FilterStatus,
} from "@/features/expenses/components/expense-list-types";
import { FieldClaimHistory, FieldClaimRow } from "@/features/expenses/components/field-claim-rows";

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
  const [resultsMinHeight, setResultsMinHeight] = React.useState<number | null>(null);
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const pendingScrollYRef = React.useRef<number | null>(null);
  const hasNoRows = filter === "ALL" ? initialCosts.length === 0 : filteredCosts.length === 0;
  const visibleCosts = filteredCosts.slice(0, visibleLimit);

  React.useLayoutEffect(() => {
    const pendingScrollY = pendingScrollYRef.current;
    if (pendingScrollY === null) return;
    window.scrollTo({ top: pendingScrollY, behavior: "auto" });
    pendingScrollYRef.current = null;
  }, [filter]);

  function changeFilter(value: FilterStatus): void {
    const currentResultsHeight = resultsRef.current?.getBoundingClientRect().height ?? 0;
    setResultsMinHeight((current) => Math.max(current ?? 0, currentResultsHeight));
    pendingScrollYRef.current = window.scrollY;
    setVisibleLimit(20);
    onFilterChange(value);
  }

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
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

      <div
        ref={resultsRef}
        style={resultsMinHeight === null ? undefined : { minHeight: `${resultsMinHeight}px` }}
      >
        {hasNoRows ? (
          <ExpensesGroupSurface>
            <EmptyState
              icon="receipt_long"
              title="Tidak Ada Pengajuan"
              description="Tidak ada pengajuan pengeluaran biaya lapangan dalam kategori filter ini."
            />
          </ExpensesGroupSurface>
        ) : (
          <div className="space-y-3">
            <ExpensesSectionHeader
              title={
                filter === "ALL"
                  ? "Pengeluaran aktif"
                  : (filterTabs.find((tab) => tab.value === filter)?.label ?? "Pengeluaran")
              }
              meta={`${filteredCosts.length} item`}
            />
            <ExpensesGroupSurface>
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
            </ExpensesGroupSurface>

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
    <ExpensesSummarySurface
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
            className="relative inline-flex h-8 items-center justify-center gap-1 rounded-full bg-[#007AFF]/8 px-3 text-[10px] leading-4 font-semibold text-[#007AFF] outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-[#007AFF]/30 active:bg-[#007AFF]/[0.14]"
          >
            <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">
              add
            </span>
            Tambah
          </button>
        ) : undefined
      }
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] leading-3 font-semibold text-on-surface-variant/60">
            Total aktif
          </p>
          <MoneyValue
            amount={activeClaimTotal}
            variant="compactWithFull"
            size="lg"
            className="mt-1"
          />
        </div>
        <p className="max-w-36.25 text-right text-[10px] leading-4 text-on-surface-variant/70">
          Dana yang masih berada dalam alur verifikasi hingga pencairan.
        </p>
      </div>
      <div className="mt-3.5 grid grid-cols-2 divide-x divide-black/5.5 rounded-[18px] bg-surface-container-low/65 px-3 py-2.5">
        <InboxMetric label="Butuh aksi" value={String(needsActionCount)} />
        <InboxMetric label="Siap dicairkan" value={String(readyToPayCount)} />
      </div>
    </ExpensesSummarySurface>
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
    <div className="min-w-0 px-2.5 first:pl-0 last:pr-0">
      <p className="truncate text-[9px] leading-3 font-semibold text-on-surface-variant/60">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm leading-5 font-bold text-on-surface">{value}</p>
    </div>
  );
}
