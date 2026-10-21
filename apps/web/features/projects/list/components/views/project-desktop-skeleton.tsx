"use client";

import { DesktopTable, GroupedSurface, type DesktopTableColumn } from "@/components/ui";

type Placeholder = { readonly id: string };

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} />;
}

/** Passive placeholders follow the portfolio's four facts, full table and optional context. */
export function ProjectDesktopSkeleton({
  region = "page",
  showDetail = false,
}: {
  readonly region?: "page" | "body" | "table";
  readonly showDetail?: boolean;
}): React.JSX.Element {
  const columns: readonly DesktopTableColumn<Placeholder>[] = [
    "Proyek",
    "Nilai proyek",
    "Budget internal",
    "Terpakai",
    "Sisa budget",
    "Kondisi",
  ].map((label, index) => ({
    key: `project-loading-${index}`,
    label,
    widthPercent: index === 0 ? 27 : index === 5 ? 17 : 14,
    render: (): React.JSX.Element =>
      index === 0 ? (
        <div className="min-w-0 space-y-2 py-2">
          <Line className="h-4 w-44 max-w-full" />
          <Line className="h-3 w-32 max-w-full bg-surface-container-low" />
        </div>
      ) : (
        <Line className={index === 5 ? "h-6 w-20 max-w-full" : "h-4 w-20 max-w-full"} />
      ),
  }));

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Memuat Proyek"
      data-project-skeleton={region}
      className="min-w-0 space-y-4 pb-6"
    >
      <div aria-hidden="true" inert className="pointer-events-none min-w-0 space-y-4">
        {region === "page" ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <Line className="h-7 w-32" />
              <Line className="h-3 w-96 max-w-full" />
            </div>
            <Line className="h-8 w-32 shrink-0" />
          </div>
        ) : null}
        {region !== "table" ? (
          <>
            <GroupedSurface variant="desktopPanel">
              <div className="grid grid-cols-4 divide-x divide-ring-subtle px-4 py-4">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="min-w-0 space-y-2 px-4 first:pl-0 last:pr-0">
                    <Line className="h-3 w-28 max-w-full" />
                    <Line className="h-6 w-24 max-w-full" />
                    <Line className="h-3 w-36 max-w-full bg-surface-container-low" />
                  </div>
                ))}
              </div>
            </GroupedSurface>
            <div className="flex w-fit max-w-full gap-1 overflow-hidden rounded-full bg-surface-container p-1">
              {["w-24", "w-20", "w-20", "w-24", "w-24"].map((width, index) => (
                <Line key={index} className={`h-8 shrink-0 bg-surface-container-lowest ${width}`} />
              ))}
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <Line className="h-10 min-w-0 flex-1 basis-60 bg-surface-container-lowest" />
              <Line className="h-10 w-36 bg-surface-container-lowest" />
              <Line className="h-10 w-36 bg-surface-container-lowest" />
              <Line className="h-10 w-36 bg-surface-container-lowest" />
            </div>
          </>
        ) : null}
        <div
          className={`grid min-w-0 items-start gap-4 ${showDetail ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
        >
          <DesktopTable
            ariaLabel="Struktur daftar proyek sedang dimuat"
            columns={columns}
            rows={Array.from({ length: 6 }, (_, index) => ({ id: `project-${index}` }))}
            rowKey={(row) => row.id}
            layout="fixed"
            footer={
              <div className="flex items-center gap-2">
                <Line className="h-3 w-32" />
                <Line className="h-9 w-24 bg-surface-container-lowest" />
                <Line className="h-8 w-24 bg-surface-container-lowest" />
                <Line className="h-8 w-24 bg-surface-container-lowest" />
              </div>
            }
          />
          {showDetail ? (
            <GroupedSurface variant="desktopPanel" className="hidden space-y-4 p-4 xl:block">
              <Line className="h-5 w-44 max-w-full" />
              <Line className="h-3 w-36 bg-surface-container-low" />
              <Line className="h-6 w-20" />
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-2 border-t border-ring-subtle pt-4">
                  <Line className="h-3 w-28" />
                  <Line className="h-4 w-40 max-w-full bg-surface-container-low" />
                </div>
              ))}
              <Line className="h-9 w-full" />
            </GroupedSurface>
          ) : null}
        </div>
      </div>
      <span className="sr-only">Portfolio dan daftar proyek sedang disiapkan.</span>
    </div>
  );
}
