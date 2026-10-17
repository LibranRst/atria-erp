import React from "react";
import { DesktopTable, GroupedSurface, type DesktopTableColumn } from "@/components/ui";

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} />;
}
/** Body-only scaffold; the project route owns identity and peer navigation. */
export function ProjectPaymentsDesktopLoading({
  receipts = false,
}: {
  readonly receipts?: boolean;
}): React.JSX.Element {
  const labels = receipts
    ? ["Diterima", "Invoice / termin", "Referensi", "Dana diterima"]
    : ["Invoice / termin", "Tagihan", "Diterima", "Sisa", "Jatuh tempo", "Status"];
  const widths = receipts ? [21, 30, 29, 20] : [25, 15, 15, 15, 16, 14];
  const columns: readonly DesktopTableColumn<{ readonly id: string }>[] = labels.map(
    (label, index) => ({
      key: `payments-loading-${index}`,
      label,
      widthPercent: widths[index],
      render: (): React.JSX.Element => (
        <div className="space-y-2 py-2">
          <Line className="h-3 w-4/5" />
          {index === (receipts ? 1 : 0) && <Line className="h-3 w-3/5" />}
        </div>
      ),
    }),
  );
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Memuat pembayaran proyek"
      className="min-w-0 space-y-4"
    >
      <div aria-hidden="true" inert className="min-w-0 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Line className="h-6 w-40" />
            <Line className="h-3 w-80 max-w-full" />
          </div>
          <Line className="h-8 w-32" />
        </div>
        <GroupedSurface variant="desktopPanel">
          <div className="grid grid-cols-4 divide-x divide-outline-variant/20 p-4">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="space-y-2 px-4 first:pl-0">
                <Line className="h-3 w-24 max-w-full" />
                <Line className="h-6 w-28 max-w-full" />
              </div>
            ))}
          </div>
          <div className="border-t border-outline-variant/20 px-4 py-3">
            <Line className="h-3 w-2/3" />
          </div>
        </GroupedSurface>
        <div className="flex w-fit gap-1 rounded-full bg-surface-container p-1">
          <Line className="h-8 w-28 bg-white/70" />
          <Line className="h-8 w-28 bg-white/70" />
        </div>
        <div className="flex gap-2">
          <Line className="h-10 min-w-0 flex-1 bg-white" />
          {!receipts && <Line className="h-10 w-36 bg-white" />}
          <Line className="h-10 w-40 bg-white" />
        </div>
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <DesktopTable
            ariaLabel="Memuat tabel pembayaran proyek"
            layout="fixed"
            columns={columns}
            rows={Array.from({ length: 10 }, (_, index) => ({
              id: `payments-loading-row-${index}`,
            }))}
            rowKey={(row) => row.id}
            footer={
              <div className="flex gap-2 py-1">
                <Line className="h-8 w-36" />
                <Line className="h-8 w-24 bg-white" />
                <Line className="h-8 w-24 bg-white" />
              </div>
            }
          />
          <GroupedSurface variant="desktopPanel" className="hidden xl:block">
            <div className="space-y-3 p-4">
              <Line className="h-5 w-40" />
              <Line className="h-3 w-full" />
              <Line className="h-5 w-24" />
            </div>
            <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
              {Array.from({ length: receipts ? 4 : 5 }, (_, index) => (
                <div key={index} className="flex justify-between gap-4 p-4">
                  <Line className="h-3 w-24" />
                  <Line className="h-4 w-20" />
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-outline-variant/20 p-4">
              <Line className="h-8 w-full" />
              <Line className="h-8 w-full" />
            </div>
          </GroupedSurface>
        </div>
      </div>
      <span className="sr-only">Ringkasan, invoice dan penerimaan proyek sedang disiapkan.</span>
    </div>
  );
}
