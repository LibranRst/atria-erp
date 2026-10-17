"use client";

import React from "react";
import { DesktopTable, GroupedSurface, type DesktopTableColumn } from "@/components/ui";
import { RapDesktopLoading } from "../rap/rap-desktop-loading";
import { ProjectStockDesktopLoading } from "../stock/project-stock-desktop-loading";
import { ProjectPaymentsDesktopLoading } from "../invoices/project-payments-desktop-loading";
import { ProjectMarginDesktopLoading } from "../overview/project-margin-desktop";
import { ExpensesDesktopSkeleton } from "@/features/expenses/components/shared/expenses-desktop-skeleton";
import { useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} />;
}

/** Project detail scaffold; the shared table owns its normal geometry. */
export function ProjectDetailDesktopLoading({
  kind,
  projectId,
  showDetail = false,
}: {
  readonly kind: "rap" | "rab" | "stok" | "expenses" | "payments" | "profitability";
  readonly projectId?: string;
  readonly showDetail?: boolean;
}): React.JSX.Element {
  const stockView = useBrowserUrlSearchParam("stock-view");
  const paymentView = useBrowserUrlSearchParam("payments-view");
  const label =
    kind === "stok"
      ? "Stok"
      : kind === "expenses"
        ? "Pengeluaran"
        : kind === "payments"
          ? "Pembayaran"
          : kind === "profitability"
            ? "Margin"
            : kind.toUpperCase();
  const labels = ["Baris RAB", "Jumlah", "Harga jual", "Subtotal", "Tampilan"];
  const widths = [34, 13, 16, 16, 21];
  const columns: readonly DesktopTableColumn<{ readonly id: string }>[] = labels.map(
    (label, index) => ({
      key: `planning-column-${index}`,
      label,
      widthPercent: widths[index],
      render: () => (
        <div className="space-y-2 py-2">
          <Line className={index === 0 ? "h-4 w-4/5" : "h-3 w-3/4"} />
          {index === 0 ? <Line className="h-3 w-2/3" /> : null}
        </div>
      ),
    }),
  );
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`Memuat ${label} proyek`}
      className="min-w-0 space-y-4"
    >
      <div aria-hidden="true" inert className="min-w-0 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Line className="h-7 w-96 max-w-full" />
            <Line className="h-3 w-60 max-w-full" />
          </div>
          <Line className="h-8 w-24 shrink-0" />
        </div>
        <div className="flex w-fit gap-1 rounded-full bg-surface-container p-1">
          {["summary", "planning", "operations", "finance"].map((key) => (
            <Line key={key} className="h-8 w-24 bg-white/70" />
          ))}
        </div>
        <div className="flex w-fit gap-1 rounded-full bg-surface-container p-1">
          {(kind === "stok" || kind === "expenses"
            ? ["stok", "expenses"]
            : kind === "payments" || kind === "profitability"
              ? ["payments", "profitability"]
              : ["rap", "rab"]
          ).map((key) => (
            <Line key={key} className="h-8 w-24 bg-white/70" />
          ))}
        </div>
        {kind === "stok" ? (
          <ProjectStockDesktopLoading activity={stockView === "activity"} />
        ) : kind === "expenses" ? (
          <ExpensesDesktopSkeleton projectId={projectId ?? "project"} />
        ) : kind === "payments" ? (
          <ProjectPaymentsDesktopLoading receipts={paymentView === "receipts"} />
        ) : kind === "profitability" ? (
          <ProjectMarginDesktopLoading />
        ) : kind === "rap" ? (
          <RapDesktopLoading showDetail={showDetail} />
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <Line className="h-6 w-44" />
              <div className="flex gap-2">
                <Line className="h-8 w-28" />
                <Line className="h-8 w-28" />
              </div>
            </div>
            <GroupedSurface variant="desktopPanel" className="p-4">
              <div className="grid grid-cols-4 divide-x divide-outline-variant/25">
                {["one", "two", "three", "four"].map((key) => (
                  <div key={key} className="min-w-0 space-y-2 px-4 first:pl-0 last:pr-0">
                    <Line className="h-3 w-24 max-w-full" />
                    <Line className="h-6 w-32 max-w-full" />
                  </div>
                ))}
              </div>
              <Line className="mt-4 h-3 w-80 max-w-full" />
            </GroupedSurface>
            <div className="flex w-fit gap-1 rounded-full bg-surface-container p-1">
              {["one", "two", "three"].map((key) => (
                <Line key={key} className="h-8 w-28 bg-white/70" />
              ))}
            </div>
            <div className="flex gap-2">
              <Line className="h-10 min-w-0 flex-1 bg-white" />
              <Line className="h-10 w-40 bg-white" />
            </div>
            <div
              className={`grid min-w-0 items-start gap-4 ${showDetail ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
            >
              <DesktopTable
                ariaLabel={`Memuat isi ${kind.toUpperCase()}`}
                layout="fixed"
                columns={columns}
                rows={Array.from({ length: 10 }, (_, index) => ({ id: `planning-row-${index}` }))}
                rowKey={(row) => row.id}
                footer={
                  <div className="flex gap-2 py-1">
                    <Line className="h-8 w-36" />
                    <Line className="h-8 w-24 bg-white" />
                    <Line className="h-8 w-24 bg-white" />
                  </div>
                }
              />
              {showDetail && (
                <GroupedSurface variant="desktopPanel" className="hidden xl:block">
                  <div className="space-y-3 p-4">
                    <Line className="h-5 w-40" />
                    <Line className="h-3 w-full" />
                  </div>
                  <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
                    {["one", "two", "three", "four"].map((key) => (
                      <div key={key} className="flex justify-between gap-4 px-4 py-4">
                        <Line className="h-3 w-20" />
                        <Line className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                  <div className="p-4">
                    <Line className="h-8 w-full" />
                  </div>
                </GroupedSurface>
              )}
            </div>
          </>
        )}
      </div>
      <span className="sr-only">
        Identitas, navigasi, ringkasan dan rincian {label} sedang disiapkan.
      </span>
    </div>
  );
}

export function ProjectPlanningDesktopLoading(props: {
  readonly kind: "rap" | "rab";
  readonly showDetail?: boolean;
}): React.JSX.Element {
  return <ProjectDetailDesktopLoading {...props} />;
}
