"use client";

import { DesktopTable, GroupedSurface, type DesktopTableColumn } from "@/components/ui";

type ReconciliationSkeletonView = "statement" | "cash" | "history";
type PlaceholderRow = { readonly id: string };

const columnLabels: Record<ReconciliationSkeletonView, readonly string[]> = {
  statement: ["Mutasi bank", "Rekening", "Tanggal", "Arah", "Nominal", "Status"],
  cash: ["Catatan Paduna Build", "Rekening", "Tanggal", "Arah", "Nominal", "Status"],
  history: ["Catatan cocok", "Rekening", "Dikonfirmasi", "Arah", "Nominal", "Status"],
};

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} />;
}

function DetailPlaceholder(): React.JSX.Element {
  return (
    <GroupedSurface variant="desktopPanel" className="hidden min-w-0 space-y-4 p-4 xl:block">
      <Line className="h-5 w-40 max-w-full" />
      <Line className="h-3 w-48 max-w-full" />
      <Line className="h-6 w-24" />
      <Line className="h-7 w-36" />
      <div className="space-y-4 border-t border-ring-subtle pt-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="space-y-2">
            <Line className="h-3 w-20" />
            <Line className="h-3 w-44 max-w-full bg-surface-container-low" />
          </div>
        ))}
      </div>
      <Line className="h-10 w-full" />
    </GroupedSurface>
  );
}

/** Passive placeholders follow the actual collection without inventing financial totals. */
export function ReconciliationDesktopSkeleton({
  view = "statement",
  showDetail = false,
  region = "page",
}: {
  readonly view?: ReconciliationSkeletonView;
  readonly showDetail?: boolean;
  readonly region?: "page" | "body" | "table";
}): React.JSX.Element {
  const columns: readonly DesktopTableColumn<PlaceholderRow>[] = columnLabels[view].map(
    (label, index) => ({
      key: `reconciliation-loading-column-${index}`,
      label,
      render: (): React.JSX.Element =>
        index === 0 ? (
          <div className="min-w-0 space-y-2 py-1">
            <Line className="h-3 w-36 max-w-full" />
            <Line className="h-3 w-28 max-w-full bg-surface-container-low" />
          </div>
        ) : (
          <Line className={index === 5 ? "h-6 w-20 max-w-full" : "h-3 w-16 max-w-full"} />
        ),
    }),
  );

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Memuat rekonsiliasi"
      data-reconciliation-skeleton={view}
      className="min-w-0 space-y-4 pb-6"
    >
      <div aria-hidden="true" inert className="pointer-events-none min-w-0 space-y-4">
        {region === "page" ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <Line className="h-7 w-44" />
              <Line className="h-3 w-96 max-w-full" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Line className="h-8 w-28" />
              <Line className="h-8 w-32" />
            </div>
          </div>
        ) : null}
        {region !== "table" ? (
          <>
            <GroupedSurface variant="desktopPanel">
              <div className="grid grid-cols-4 divide-x divide-ring-subtle px-4 py-4">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="min-w-0 space-y-2 px-4 first:pl-0 last:pr-0">
                    <Line className="h-3 w-28 max-w-full" />
                    <Line className="h-6 w-20 max-w-full" />
                    <Line className="h-3 w-32 max-w-full bg-surface-container-low" />
                  </div>
                ))}
              </div>
            </GroupedSurface>
            <div className="flex w-fit max-w-full gap-1 overflow-hidden rounded-full bg-surface-container p-1">
              {["w-28", "w-32", "w-24"].map((width) => (
                <Line key={width} className={`h-8 shrink-0 bg-surface-container-lowest ${width}`} />
              ))}
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <Line className="h-10 min-w-0 flex-1 basis-60 bg-surface-container-lowest" />
              <Line className="h-10 w-40 bg-surface-container-lowest" />
              <Line className="h-10 w-32 bg-surface-container-lowest" />
            </div>
          </>
        ) : null}
        <div
          className={`grid min-w-0 items-start gap-4 ${showDetail ? "xl:grid-cols-[minmax(0,1fr)_288px]" : ""}`}
        >
          <DesktopTable
            ariaLabel="Struktur daftar rekonsiliasi sedang dimuat"
            columns={columns}
            rows={Array.from({ length: 5 }, (_, index) => ({
              id: `reconciliation-loading-row-${index}`,
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
          {showDetail ? <DetailPlaceholder /> : null}
        </div>
      </div>
      <span className="sr-only">
        {view === "history"
          ? "Riwayat pencocokan sedang disiapkan."
          : "Antrean mutasi bank dan catatan Paduna Build sedang disiapkan."}
      </span>
    </div>
  );
}
