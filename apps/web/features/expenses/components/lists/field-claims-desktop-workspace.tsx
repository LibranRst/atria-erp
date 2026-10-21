"use client";

import React from "react";
import {
  AppIcon,
  Button,
  DesktopTable,
  DesktopTablePagination,
  FilterSelect,
  GroupedSurface,
  SearchInput,
  SegmentedTabs,
  useListDetailFocus,
  type DesktopTableColumn,
  type SelectOption,
} from "@/components/ui";
import type { ExpenseCostItem, FilterStatus } from "@/features/expenses/types/expense-list-types";
import type { DesktopTableState } from "@/components/ui";
import type { FieldClaimDesktopFilters } from "@/features/expenses/utils/field-claims-desktop";
import { FieldClaimDesktopAmount, FieldClaimsDesktopDetail } from "./field-claims-desktop-detail";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

export function FieldClaimsDesktopWorkspace({
  projectId,
  initialCosts,
  activeClaimTotal,
  readyToPayCount,
  filter,
  filterTabs,
  onFilterChange,
  filters,
  onFiltersChange,
  projectOptions,
  categoryOptions,
  columns,
  table,
  selectedId,
  onSelect,
  pending,
  canVerify,
  canPay,
  canCreate,
  onOpenExpenseDrawer,
  onScanReceipt,
  onVerify,
  onDisburse,
  onOpenReceipt,
}: {
  readonly projectId?: string;
  readonly initialCosts: readonly ExpenseCostItem[];
  readonly filteredCosts: readonly ExpenseCostItem[];
  readonly activeClaimTotal: number;
  readonly readyToPayCount: number;
  readonly filter: FilterStatus;
  readonly filterTabs: readonly {
    readonly value: FilterStatus;
    readonly label: string;
    readonly count: number;
  }[];
  readonly onFilterChange: (filter: FilterStatus) => void;
  readonly filters: FieldClaimDesktopFilters;
  readonly onFiltersChange: (filters: FieldClaimDesktopFilters) => void;
  readonly projectOptions: readonly SelectOption[];
  readonly categoryOptions: readonly SelectOption[];
  readonly columns: readonly DesktopTableColumn<ExpenseCostItem>[];
  readonly table: DesktopTableState<ExpenseCostItem>;
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly pending: boolean;
  readonly canVerify: boolean;
  readonly canPay: boolean;
  readonly canCreate: boolean;
  readonly onOpenExpenseDrawer: () => void;
  readonly onScanReceipt?: () => void;
  readonly onVerify: (cost: ExpenseCostItem) => void;
  readonly onDisburse: (cost: ExpenseCostItem) => void;
  readonly onOpenReceipt: (imageUrl: string) => void;
}): React.JSX.Element {
  const detailAsideVisible = useWorkspaceViewportAtLeast(1280);
  const explicitSelectedCost = table.rows.find((cost) => cost.id === selectedId);
  const selectedCost = explicitSelectedCost;
  const { listRef, detailRef } = useListDetailFocus({
    active: useWorkspacePresentation() === "desktop",
    narrow: !detailAsideVisible,
    selectionKey: selectedCost?.id ?? null,
  });
  const verificationCount = initialCosts.filter((cost) => cost.status === "SUBMITTED").length;
  const approvalCount = initialCosts.filter((cost) => cost.status === "VERIFIED").length;
  const readyAmount = initialCosts
    .filter((cost) => cost.status === "APPROVED")
    .reduce((sum, cost) => sum + Number(cost.amount), 0);
  return (
    <div className="min-w-0 space-y-4">
      <GroupedSurface variant="desktopPanel">
        <dl className="grid grid-cols-2 gap-y-4 p-4 min-[1180px]:grid-cols-4">
          <div className="min-w-0 pr-4">
            <dt className="text-support text-on-surface-variant">Nilai pengeluaran aktif</dt>
            <dd className="mt-1">
              <FieldClaimDesktopAmount amount={activeClaimTotal} variant="compact" size="lg" />
            </dd>
          </div>
          <div className="min-w-0 border-l border-ring-subtle px-4">
            <dt className="text-support text-on-surface-variant">Perlu verifikasi</dt>
            <dd className="mt-1 text-title font-semibold tabular-nums">{verificationCount}</dd>
          </div>
          <div className="min-w-0 pr-4 min-[1180px]:border-l min-[1180px]:border-ring-subtle min-[1180px]:px-4">
            <dt className="text-support text-on-surface-variant">Menunggu persetujuan</dt>
            <dd className="mt-1 text-title font-semibold tabular-nums">{approvalCount}</dd>
          </div>
          <div className="min-w-0 border-l border-ring-subtle pl-4">
            <dt className="text-support text-on-surface-variant">
              Siap dicairkan · {readyToPayCount} pengajuan
            </dt>
            <dd className="mt-1">
              <FieldClaimDesktopAmount amount={readyAmount} variant="compact" size="lg" />
            </dd>
          </div>
        </dl>
      </GroupedSurface>
      <SegmentedTabs
        value={filter}
        onChange={onFilterChange}
        ariaLabel="Filter pengeluaran"
        density="compact"
        scrollable
        options={filterTabs.map((tab) => ({
          ...tab,
          label: tab.value === "NEEDS_APPROVAL" ? "Persetujuan" : tab.label,
          countLabel: `${tab.count} pengeluaran, ${tab.value === "NEEDS_APPROVAL" ? "Persetujuan" : tab.label}`,
        }))}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          value={filters.query}
          onChange={(query): void => onFiltersChange({ ...filters, query })}
          ariaLabel="Cari pengeluaran lapangan"
          placeholder={
            projectId ? "Cari pengeluaran atau pemohon…" : "Cari pengeluaran, proyek, atau pemohon"
          }
          showClear={false}
          className="min-w-0 flex-1 basis-64"
        />
        {!projectId ? (
          <FilterSelect
            label="Proyek pengeluaran"
            value={filters.project}
            onChange={(project): void => onFiltersChange({ ...filters, project })}
            options={projectOptions}
            searchable
          />
        ) : null}
        <FilterSelect
          label="Kategori pengeluaran"
          value={filters.category}
          onChange={(category): void => onFiltersChange({ ...filters, category })}
          options={categoryOptions}
          searchable={false}
        />
        <FilterSelect
          label="Tanggal pengajuan"
          value={filters.date}
          onChange={(date): void => onFiltersChange({ ...filters, date })}
          options={[
            { value: "all", label: "Semua tanggal" },
            { value: "this-month", label: "Bulan ini" },
            { value: "last-month", label: "Bulan lalu" },
          ]}
          searchable={false}
        />
        {canCreate ? (
          <div className="flex shrink-0 items-center gap-2">
            {onScanReceipt ? (
              <Button type="button" variant="secondary" size="compact" onClick={onScanReceipt}>
                <AppIcon name="photo_camera" className="icon-sm" /> Scan nota
              </Button>
            ) : null}
            <Button type="button" variant="primary" size="compact" onClick={onOpenExpenseDrawer}>
              <AppIcon name="add" className="icon-sm" /> Tambah pengeluaran
            </Button>
          </div>
        ) : null}
      </div>
      <div
        className={`grid min-w-0 items-start gap-4 ${selectedCost ? "xl:grid-cols-[minmax(0,1fr)_288px]" : ""}`}
      >
        <div ref={listRef} className={`min-w-0 ${explicitSelectedCost ? "hidden xl:block" : ""}`}>
          <DesktopTable
            ariaLabel="Pengeluaran lapangan"
            rows={table.rows}
            columns={columns}
            rowKey={(cost) => cost.id}
            selectedRowKey={detailAsideVisible ? (selectedCost?.id ?? null) : null}
            onRowSelectionChange={(cost): void => {
              if (!pending) onSelect(cost?.id ?? null);
            }}
            sortDescriptor={table.sortDescriptor}
            onSortChange={table.onSortChange}
            emptyTitle={initialCosts.length === 0 ? "Belum ada pengeluaran" : "Tidak ada hasil"}
            emptyDescription={
              initialCosts.length === 0
                ? "Pengajuan pengeluaran akan tampil di sini."
                : "Sesuaikan pencarian atau filter pengeluaran."
            }
            footer={
              <DesktopTablePagination
                ariaLabel="Halaman pengeluaran lapangan"
                page={table.page}
                pageSize={table.pageSize}
                total={table.total}
                onPageChange={table.onPageChange}
                onPageSizeChange={table.onPageSizeChange}
              />
            }
          />
        </div>
        {selectedCost ? (
          <div
            ref={detailRef}
            className={`min-w-0 ${explicitSelectedCost ? "" : "hidden xl:block"}`}
          >
            <FieldClaimsDesktopDetail
              cost={selectedCost}
              pending={pending}
              canVerify={canVerify}
              canPay={canPay}
              onVerify={onVerify}
              onDisburse={onDisburse}
              onOpenReceipt={onOpenReceipt}
              onBack={(): void => {
                if (!pending) onSelect(null);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
