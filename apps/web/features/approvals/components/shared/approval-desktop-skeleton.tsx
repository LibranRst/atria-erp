"use client";

import React from "react";
import { DesktopTable, GroupedSurface, type DesktopTableColumn } from "@/components/ui";

type PlaceholderRow = { readonly id: string };

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} />;
}

const columns: readonly DesktopTableColumn<PlaceholderRow>[] = [
  "Pengajuan",
  "Jenis",
  "Pengaju / vendor",
  "Nominal",
  "Masuk antrean",
  "Prioritas",
].map((label, index) => ({
  key: `approval-loading-column-${index}`,
  label,
  render: (): React.JSX.Element =>
    index === 0 ? (
      <div className="min-w-32 space-y-2 py-1">
        <Line className="h-3 w-36 max-w-full" />
        <Line className="h-3 w-28 max-w-full bg-surface-container-low" />
      </div>
    ) : (
      <Line className={index === 5 ? "h-6 w-20 max-w-full" : "h-3 w-16 max-w-full"} />
    ),
}));

/** Structural placeholders preserve unknown data as loading rather than healthy zeroes. */
export function ApprovalDesktopSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-label="Memuat persetujuan" className="min-w-0 space-y-4 pb-6">
      <div aria-hidden="true" inert className="min-w-0 space-y-4">
        <div className="space-y-2">
          <Line className="h-7 w-40" />
          <Line className="h-3 w-80 max-w-full" />
        </div>
        <GroupedSurface variant="desktopPanel">
          <div className="grid grid-cols-2 gap-y-4 p-4 min-[1180px]:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="min-w-0 space-y-2 px-4 first:pl-0">
                <Line className="h-3 w-28 max-w-full" />
                <Line className="h-6 w-24 max-w-full" />
              </div>
            ))}
          </div>
        </GroupedSurface>
        <div className="flex w-fit max-w-full gap-1 overflow-hidden rounded-full bg-surface-container p-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <Line key={index} className="h-8 w-24 shrink-0 bg-surface-container-lowest" />
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Line className="h-10 min-w-0 flex-1 basis-60 bg-surface-container-lowest" />
          <Line className="h-10 w-40 bg-surface-container-lowest" />
          <Line className="h-10 w-40 bg-surface-container-lowest" />
        </div>
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
          <DesktopTable
            ariaLabel="Struktur antrean persetujuan sedang dimuat"
            columns={columns}
            rows={Array.from({ length: 10 }, (_, index) => ({
              id: `approval-loading-row-${index}`,
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
          <GroupedSurface variant="desktopPanel" className="hidden min-w-0 space-y-4 p-4 xl:block">
            <Line className="h-5 w-44 max-w-full" />
            <Line className="h-3 w-48 max-w-full" />
            <Line className="h-6 w-20" />
            <Line className="h-7 w-36" />
            <div className="space-y-4 border-t border-ring-subtle pt-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="flex justify-between gap-4">
                  <Line className="h-3 w-16" />
                  <Line className="h-3 w-28 max-w-full" />
                </div>
              ))}
            </div>
            <Line className="h-24 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-2">
              <Line className="h-9 w-full" />
              <Line className="h-9 w-full" />
            </div>
          </GroupedSurface>
        </div>
      </div>
      <span className="sr-only">Antrean persetujuan sedang disiapkan.</span>
    </div>
  );
}
