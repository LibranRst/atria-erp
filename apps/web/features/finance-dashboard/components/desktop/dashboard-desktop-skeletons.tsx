"use client";

import React from "react";
import {
  DesktopTable,
  GroupedSurface,
  SegmentedTabs,
  type DesktopTableColumn,
} from "@/components/ui";
import type { DashboardPageTab } from "@atria/core/finance/dashboard-overview";

type PlaceholderRow = { readonly id: string };
type SkeletonColumn = Pick<DesktopTableColumn<PlaceholderRow>, "key" | "label" | "align">;

const TAB_LABELS: Readonly<Record<DashboardPageTab, string>> = {
  overview: "Ringkasan",
  approvals: "Persetujuan",
  budget: "Budget",
  cash: "Jatuh Tempo",
  accounts: "Rekening",
  materials: "Material",
};
const TAB_ORDER: readonly DashboardPageTab[] = [
  "overview",
  "approvals",
  "budget",
  "cash",
  "accounts",
  "materials",
];
export function resolveDashboardSkeletonTab(value: string | null): DashboardPageTab {
  return TAB_ORDER.find((tab) => tab === value) ?? "overview";
}
const TABLE_LABELS: Readonly<Record<DashboardPageTab, readonly string[]>> = {
  overview: ["Proyek", "Budget", "Terpakai", "Sisa", "Margin", "Kondisi"],
  budget: ["Proyek", "Budget", "Terpakai", "Sisa", "Margin", "Kondisi"],
  approvals: ["Pengajuan", "Jenis", "Pemohon", "Nominal", "Diajukan", "Prioritas"],
  cash: ["Jatuh tempo", "Dokumen / pihak", "Jenis", "Total", "Dibayar", "Sisa", "Status"],
  accounts: ["Rekening", "Pemilik", "Saldo", "Status", "Aktivitas terakhir"],
  materials: [
    "Material / dokumen",
    "Perhatian",
    "Tersedia",
    "Kebutuhan / jumlah",
    "Kondisi",
    "Tanggal",
  ],
};

function Line({ className = "h-3 w-24" }: { readonly className?: string }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={`max-w-full rounded-full bg-surface-container ${className}`}
    />
  );
}

function columnsFor(labels: readonly string[]): readonly SkeletonColumn[] {
  return labels.map((label, index): SkeletonColumn => ({
    key: String(index),
    label,
    align: [
      "Budget",
      "Terpakai",
      "Sisa",
      "Margin",
      "Nominal",
      "Total",
      "Dibayar",
      "Saldo",
      "Tersedia",
      "Kebutuhan / jumlah",
      "Alokasi",
      "Menunggu",
    ].includes(label)
      ? "end"
      : "start",
  }));
}

/** Native table geometry, with no focusable fake rows, data totals or actions. */
export function DashboardTableSkeleton({
  columns,
  rowCount = 10,
  footer = true,
  label = "Memuat tabel Dashboard",
}: {
  readonly columns: readonly SkeletonColumn[];
  readonly rowCount?: number;
  readonly footer?: boolean;
  readonly label?: string;
}): React.JSX.Element {
  const placeholderColumns: readonly DesktopTableColumn<PlaceholderRow>[] = columns.map(
    (column, index) => {
      const identity =
        column.label === "Dokumen / pihak" || (index === 0 && column.label !== "Jatuh tempo");
      return {
        ...column,
        render: (): React.JSX.Element => (
          <div
            className={`space-y-2 py-1 ${identity ? "min-w-36" : "min-w-16"} ${column.align === "end" ? "flex flex-col items-end" : ""}`}
          >
            <Line className={identity ? "h-4 w-40" : "h-3 w-16"} />
            {identity || index === 0 || index === columns.length - 1 ? (
              <Line className={identity ? "h-3 w-28" : "h-2.5 w-12"} />
            ) : null}
          </div>
        ),
      };
    },
  );
  return (
    <div role="status" aria-label={label} aria-busy="true" data-dashboard-skeleton="table">
      <div inert aria-hidden="true" className="pointer-events-none">
        <DesktopTable
          ariaLabel={label}
          columns={placeholderColumns}
          rows={Array.from({ length: Math.max(1, Math.min(50, rowCount)) }, (_, index) => ({
            id: `skeleton-row-${index}`,
          }))}
          rowKey={(row): string => row.id}
          footer={
            footer ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Line className="h-3 w-40" />
                <div className="flex items-center gap-2">
                  <Line className="h-10 w-24" />
                  <Line className="h-8 w-24" />
                  <Line className="h-8 w-24" />
                </div>
              </div>
            ) : undefined
          }
        />
      </div>
      <span className="sr-only">{label}. Baris dan rincian sedang disiapkan.</span>
    </div>
  );
}

function Metrics({
  count = 3,
  budget = false,
}: {
  readonly count?: number;
  readonly budget?: boolean;
}): React.JSX.Element {
  return (
    <GroupedSurface variant="desktopPanel">
      <div
        className={
          count === 4
            ? "grid grid-cols-4 divide-x divide-outline-variant/20"
            : "grid grid-cols-3 divide-x divide-outline-variant/20"
        }
      >
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="min-w-0 space-y-2 p-4">
            <Line className="h-4 w-28" />
            <Line className="h-6 w-32" />
            {budget ? <Line className="h-4 w-36" /> : null}
          </div>
        ))}
      </div>
      {budget ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-outline-variant/20 px-4 py-2.5">
          <div className="space-y-1">
            <Line className="h-3 w-24" />
            <Line className="h-4 w-20" />
          </div>
          <div className="space-y-1">
            <Line className="h-3 w-24" />
            <Line className="h-4 w-20" />
          </div>
          <Line className="my-auto h-3 w-56" />
        </div>
      ) : null}
    </GroupedSurface>
  );
}

export function DashboardCashFlowSkeleton({
  months = 6,
}: {
  readonly months?: 6 | 12;
}): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="Memuat tren kas"
      aria-busy="true"
      data-dashboard-skeleton="cashflow"
    >
      <div inert aria-hidden="true">
        <div className="space-y-3">
          <div className="flex gap-4">
            <Line className="h-5 w-20" />
            <Line className="h-5 w-20" />
          </div>
          <div className="relative flex h-40 gap-4">
            <div className="flex w-10 shrink-0 flex-col justify-between py-3">
              <Line className="h-2 w-10" />
              <Line className="h-2 w-9" />
              <Line className="h-2 w-7" />
            </div>
            <div className="flex min-w-0 flex-1 items-end justify-between gap-3 border-b border-outline-variant/20 pb-2">
              {Array.from({ length: months }, (_, index) => (
                <div
                  key={index}
                  className="flex h-24 min-w-0 flex-1 items-end justify-center gap-1.5"
                >
                  <Line className="h-full w-3 rounded-icon" />
                  <Line className="h-full w-3 rounded-icon" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between gap-3 pl-14">
            {Array.from({ length: months }, (_, index) => (
              <Line key={index} className="h-5 w-7" />
            ))}
          </div>
          <Line className="h-4 w-3/4" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/20 pt-3">
          <Line className="h-3 w-48" />
          <Line className="h-8 w-36" />
        </div>
      </div>
      <span className="sr-only">Arus kas masuk dan keluar sedang disiapkan.</span>
    </div>
  );
}

function Toolbar({
  filters = 1,
  search = true,
}: {
  readonly filters?: number;
  readonly search?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Line className="h-5 w-44" />
      <div className="flex flex-wrap gap-2">
        {search ? <Line className="h-10 w-60" /> : null}
        {Array.from({ length: filters }, (_, index) => (
          <Line key={index} className="h-10 w-40" />
        ))}
      </div>
    </div>
  );
}

function Categories(): React.JSX.Element {
  return (
    <GroupedSurface variant="desktopPanel" className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <Line className="h-5 w-36" />
        <Line className="h-8 w-20" />
      </div>
      <div className="divide-y divide-outline-variant/20">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex items-center justify-between gap-3 py-1.5">
            <div className="space-y-1.5">
              <Line className="h-4 w-24" />
              <Line className="h-3 w-32" />
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Line className="h-4 w-20" />
              <Line className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-outline-variant/20 pt-3">
        <Line className="h-5 w-40" />
      </div>
    </GroupedSurface>
  );
}

function Operations(): React.JSX.Element {
  return (
    <GroupedSurface variant="desktopPanel" className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Line className="h-5 w-52" />
        <div className="flex gap-4">
          {[0, 1, 2].map((index) => (
            <Line key={index} className="h-4 w-20" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="space-y-3">
            <Line className="h-4 w-32" />
            {[0, 1, 2].map((row) => (
              <div key={row} className="space-y-1.5">
                <Line className="h-4 w-4/5" />
                <Line className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </GroupedSurface>
  );
}

function Body({
  tab,
  pageSize,
  months,
}: {
  readonly tab: DashboardPageTab;
  readonly pageSize: 10 | 25 | 50;
  readonly months: 6 | 12;
}): React.JSX.Element {
  if (tab === "overview")
    return (
      <div className="space-y-4">
        <Metrics count={4} budget />
        <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)] items-start gap-4">
          <GroupedSurface variant="desktopPanel" className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="space-y-2">
                <Line className="h-5 w-40" />
                <Line className="h-4 w-52" />
              </div>
              <Line className="h-10 w-24" />
            </div>
            <DashboardCashFlowSkeleton months={months} />
          </GroupedSurface>
          <Categories />
        </div>
        <div className="space-y-3">
          <Toolbar filters={0} search={false} />
          <DashboardTableSkeleton
            columns={columnsFor(TABLE_LABELS.overview)}
            rowCount={5}
            footer={false}
          />
        </div>
        <Operations />
      </div>
    );
  return (
    <div className="space-y-4">
      {tab === "budget" ? (
        <Metrics count={4} budget />
      ) : tab === "accounts" ? (
        <GroupedSurface
          variant="desktopPanel"
          className="flex items-center justify-between gap-4 p-4"
        >
          <div className="space-y-2">
            <Line className="h-4 w-44" />
            <Line className="h-6 w-32" />
          </div>
          <Line className="h-4 w-52" />
          <Line className="h-8 w-32" />
        </GroupedSurface>
      ) : tab === "approvals" ? (
        <GroupedSurface
          variant="desktopPanel"
          className="flex items-center justify-between gap-4 p-4"
        >
          <div className="space-y-2">
            <Line className="h-4 w-32" />
            <Line className="h-6 w-10" />
          </div>
          <div className="space-y-2">
            <Line className="h-4 w-24" />
            <Line className="h-6 w-28" />
          </div>
          <Line className="h-4 w-48" />
        </GroupedSurface>
      ) : (
        <Metrics />
      )}
      <div className="space-y-3">
        <Toolbar search={tab !== "accounts"} filters={tab === "cash" ? 2 : 1} />
        <DashboardTableSkeleton columns={columnsFor(TABLE_LABELS[tab])} rowCount={pageSize} />
      </div>
      {tab === "budget" ? (
        <div className="space-y-3">
          <Line className="h-5 w-40" />
          <DashboardTableSkeleton
            columns={columnsFor([
              "Kategori",
              "Alokasi",
              "Menunggu",
              "Terpakai",
              "Dibayar",
              "Sisa",
              "Penggunaan",
            ])}
            rowCount={5}
            footer={false}
          />
        </div>
      ) : null}
    </div>
  );
}

export function DashboardDesktopSkeleton({
  tab = "overview",
  pageSize = 10,
  months = 6,
}: {
  readonly tab?: DashboardPageTab;
  readonly pageSize?: 10 | 25 | 50;
  readonly months?: 6 | 12;
}): React.JSX.Element {
  const options = TAB_ORDER.map((value) => ({
    value,
    label: TAB_LABELS[value],
    icon: <Line className="size-4 rounded-icon" />,
  }));
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Memuat Dashboard desktop"
      data-dashboard-skeleton={tab}
      className="space-y-4 pb-8"
    >
      <div aria-hidden="true" inert className="pointer-events-none space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Line className="h-7 w-44" />
            <Line className="h-4 w-40" />
          </div>
          <div className="flex items-center gap-3">
            <Line className="h-3 w-28" />
            <Line className="h-8 w-20" />
          </div>
        </div>
        <SegmentedTabs
          value={tab}
          options={options}
          onChange={(): void => undefined}
          ariaLabel="Tab Dashboard"
          animated={false}
        />
        <Body tab={tab} pageSize={pageSize} months={months} />
      </div>
      <span className="sr-only">
        {tab === "overview"
          ? "Posisi budget, arus kas, kategori, dan proyek prioritas sedang disiapkan."
          : `${TAB_LABELS[tab]}: ringkasan dan daftar sedang disiapkan.`}
      </span>
    </div>
  );
}
