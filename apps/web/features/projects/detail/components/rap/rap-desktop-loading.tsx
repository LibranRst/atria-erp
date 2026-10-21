import React from "react";
import { DesktopTable, GroupedSurface } from "@/components/ui";

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} />;
}

export function RapDesktopLoading({
  showDetail = false,
}: {
  readonly showDetail?: boolean;
}): React.JSX.Element {
  return (
    <div
      className="min-w-0 space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Memuat rencana pelaksanaan"
    >
      <div aria-hidden="true" inert className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Line className="h-5 w-64 max-w-full" />
            <Line className="h-3 w-96 max-w-full" />
          </div>
          <Line className="h-7 w-28" />
        </div>
        <GroupedSurface variant="desktopPanel" className="p-4">
          <div className="grid grid-cols-4 divide-x divide-outline-variant/20">
            {["total", "material", "tukang", "subcon"].map((id) => (
              <div key={id} className="min-w-0 space-y-2 px-4 first:pl-0 last:pr-0">
                <Line className="h-3 w-24 max-w-full" />
                <Line className="h-5 w-28 max-w-full" />
              </div>
            ))}
          </div>
          <Line className="mt-4 h-3 w-96 max-w-full" />
        </GroupedSurface>
        <div className="flex w-fit max-w-full gap-1 rounded-full bg-surface-container p-1">
          {["material", "tukang", "subcon", "review"].map((id) => (
            <Line key={id} className="h-8 w-28 max-w-full bg-surface-container-lowest" />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Line className="h-5 w-40" />
          <Line className="h-8 w-32" />
        </div>
        <div className="flex gap-2">
          <Line className="h-10 min-w-0 flex-1 bg-surface-container-lowest" />
          <Line className="h-10 w-44 bg-surface-container-lowest" />
        </div>
        <div
          className={`grid min-w-0 items-start gap-4 ${showDetail ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
        >
          <DesktopTable
            ariaLabel="Memuat item RAP"
            layout="fixed"
            rows={Array.from({ length: 10 }, (_, index) => ({ id: String(index) }))}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "item",
                label: "Item / lingkup",
                widthPercent: 31,
                render: () => (
                  <div className="space-y-2 py-1">
                    <Line className="h-4 w-4/5" />
                    <Line className="h-3 w-3/5" />
                  </div>
                ),
              },
              ...[
                { key: "quantity", label: "Kebutuhan", widthPercent: 15 },
                { key: "estimate", label: "Estimasi", widthPercent: 18 },
                { key: "actual", label: "Realisasi", widthPercent: 18 },
                { key: "status", label: "Kondisi", widthPercent: 18 },
              ].map((column) => ({
                ...column,
                render: (): React.JSX.Element => <Line className="h-4 w-4/5" />,
              })),
            ]}
            footer={
              <div className="flex items-center justify-between">
                <Line className="h-3 w-44" />
                <Line className="h-8 w-64" />
              </div>
            }
          />
          {showDetail && (
            <GroupedSurface variant="desktopPanel" className="hidden space-y-4 p-4 xl:block">
              <Line className="h-5 w-40" />
              <Line className="h-6 w-24" />
              {["estimate", "actual", "quantity", "available", "need", "reserved"].map((id) => (
                <div
                  key={id}
                  className="flex justify-between gap-4 border-t border-outline-variant/20 pt-3"
                >
                  <Line className="h-3 w-24" />
                  <Line className="h-3 w-20" />
                </div>
              ))}
              <Line className="h-9 w-full" />
            </GroupedSurface>
          )}
        </div>
      </div>
      <span className="sr-only">
        Estimasi, lingkup dan item rencana pelaksanaan sedang disiapkan.
      </span>
    </div>
  );
}
