"use client";

import React from "react";
import { DesktopTable, GroupedSurface, type DesktopTableColumn } from "@/components/ui";
import { useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";

export type ExpensesSkeletonVariant = "claims" | "bills" | "payments";
type PlaceholderRow = { readonly id: string };

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} />;
}

function TablePlaceholder({
  variant,
  embedded = false,
}: {
  readonly variant: ExpensesSkeletonVariant;
  readonly embedded?: boolean;
}): React.JSX.Element {
  const labels =
    variant === "claims"
      ? ["Pengeluaran", "Kategori", "Diajukan", "Nominal", "Status"]
      : variant === "bills"
        ? ["Tagihan", "Proyek", "Nominal", "Jatuh tempo", "Status"]
        : ["Pembayaran", "Proyek", "Nominal", "Tanggal", "Status"];
  const displayedLabels = embedded ? labels.filter((label) => label !== "Proyek") : labels;
  const columns: readonly DesktopTableColumn<PlaceholderRow>[] = displayedLabels.map(
    (label, index) => ({
      key: `expenses-${variant}-skeleton-column-${index}`,
      label,
      render: (): React.JSX.Element =>
        index === 0 ? (
          <div className="min-w-32 space-y-2 py-1">
            <Line className="h-3 w-36 max-w-full" />
            <Line className="h-3 w-24 max-w-full bg-surface-container-low" />
            {variant === "claims" ? (
              <Line className="h-3 w-20 max-w-full bg-surface-container-low" />
            ) : null}
          </div>
        ) : (
          <Line className={index === 4 ? "h-6 w-20 max-w-full" : "h-3 w-16 max-w-full"} />
        ),
    }),
  );
  return (
    <DesktopTable
      ariaLabel="Struktur tabel Pengeluaran sedang dimuat"
      columns={columns}
      rows={Array.from({ length: 10 }, (_, index) => ({
        id: `expenses-${variant}-skeleton-row-${index}`,
      }))}
      rowKey={(row): string => row.id}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Line className="h-3 w-40" />
          <Line className="h-9 w-24" />
          <Line className="h-8 w-24" />
          <Line className="h-8 w-24" />
        </div>
      }
    />
  );
}

function DetailPlaceholder(): React.JSX.Element {
  return (
    <GroupedSurface variant="desktopPanel" className="space-y-4 p-4">
      <div className="space-y-2">
        <Line className="h-5 w-44 max-w-full" />
        <Line className="h-3 w-52 max-w-full" />
      </div>
      <Line className="h-7 w-20" />
      <Line className="h-7 w-36" />
      <div className="space-y-4 border-t border-ring-subtle pt-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Line className="h-3 w-16" />
            <Line className="h-3 w-28 max-w-full" />
          </div>
        ))}
      </div>
      <Line className="h-9 w-full" />
    </GroupedSurface>
  );
}

/** The same route scaffold loads without presenting unknown totals as healthy zeroes. */
export function ExpensesDesktopSkeleton({
  variant: explicitVariant,
  projectId,
  showDetail = false,
}: {
  readonly variant?: ExpensesSkeletonVariant;
  readonly projectId?: string;
  readonly showDetail?: boolean;
}): React.JSX.Element {
  const view = useBrowserUrlSearchParam(projectId ? `project-${projectId}-expenses-view` : "view");
  const vendorView = useBrowserUrlSearchParam(
    `project-${projectId ?? "inbox"}-expenses-vendor-view`,
  );
  const variant =
    explicitVariant ??
    (view === "vendor-bills" ? (vendorView === "PAYMENTS" ? "payments" : "bills") : "claims");
  return (
    <div role="status" aria-label="Memuat Pengeluaran" className="min-w-0 space-y-4 pb-6">
      <div aria-hidden="true" inert className="min-w-0 space-y-4">
        {!projectId ? (
          <div className="space-y-2">
            <Line className="h-7 w-44" />
            <Line className="h-3 w-72 max-w-full" />
          </div>
        ) : null}
        <div className="flex w-fit max-w-full gap-1 overflow-hidden rounded-full bg-surface-container p-1">
          <Line className="h-8 w-44 bg-surface-container-lowest" />
          <Line className="h-8 w-36 bg-surface-container-lowest" />
        </div>
        <GroupedSurface variant="desktopPanel">
          <div className="grid grid-cols-2 gap-y-4 p-4 min-[1180px]:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="min-w-0 space-y-2 px-4 first:pl-0">
                <Line className="h-3 w-32 max-w-full" />
                <Line className="h-6 w-24 max-w-full" />
              </div>
            ))}
          </div>
        </GroupedSurface>
        <div className="flex w-fit max-w-full gap-1 overflow-hidden rounded-full bg-surface-container p-1">
          {Array.from({ length: variant === "claims" ? 6 : 2 }, (_, index) => (
            <Line key={index} className="h-8 w-24 shrink-0 bg-surface-container-lowest" />
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Line className="h-10 min-w-0 flex-1 basis-60 bg-surface-container-lowest" />
          {Array.from({ length: projectId ? 2 : 3 }, (_, index) => (
            <Line key={index} className="h-10 w-36 bg-surface-container-lowest" />
          ))}
          <Line className="h-10 w-40" />
        </div>
        <div
          className={`grid min-w-0 items-start gap-4 ${showDetail ? "xl:grid-cols-[minmax(0,1fr)_288px]" : ""}`}
        >
          <div className={showDetail ? "hidden min-w-0 xl:block" : "min-w-0"}>
            <TablePlaceholder variant={variant} embedded={Boolean(projectId)} />
          </div>
          {showDetail ? (
            <div data-expenses-skeleton-detail className="min-w-0">
              <DetailPlaceholder />
            </div>
          ) : null}
        </div>
      </div>
      <span className="sr-only">Data pengeluaran dan tagihan sedang disiapkan.</span>
    </div>
  );
}
