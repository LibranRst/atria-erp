import React from "react";
import { DesktopTable, GroupedSurface } from "@/components/ui";

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} />;
}

/** The route scaffold follows the compact identity, budget comparison and independent context. */
export function ProjectOverviewDesktopLoading({
  showDetail = false,
}: {
  readonly showDetail?: boolean;
} = {}): React.JSX.Element {
  return (
    <div
      className="min-w-0 space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Memuat detail proyek"
    >
      <div aria-hidden="true" inert className="min-w-0 space-y-4">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 space-y-2">
            <Line className="h-7 w-80 max-w-full" />
            <Line className="h-3 w-64 max-w-full" />
            <Line className="h-3 w-48 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Line className="h-8 w-24" />
            <Line className="h-8 w-24" />
          </div>
        </div>
        <div className="flex w-fit gap-1 rounded-full bg-surface-container p-1">
          {["summary", "planning", "operations", "finance"].map((item) => (
            <Line key={item} className="h-8 w-28 bg-white/70" />
          ))}
        </div>
        <GroupedSurface variant="desktopPanel" className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <Line className="h-4 w-40" />
            <Line className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-4 divide-x divide-outline-variant/25">
            {["value", "cap", "consumed", "remaining"].map((item) => (
              <div key={item} className="space-y-2 px-4 first:pl-0 last:pr-0">
                <Line className="h-3 w-24 max-w-full" />
                <Line className="h-6 w-28 max-w-full" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-5 border-t border-outline-variant/25 pt-3">
            {["paid", "pending", "used", "margin"].map((item) => (
              <Line key={item} className="h-3 w-36" />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Line className="h-5 w-16" />
            <Line className="h-3 w-56" />
          </div>
          <Line className="mt-2 h-3 w-40" />
        </GroupedSurface>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <Line className="h-5 w-40" />
            <Line className="h-8 w-28" />
          </div>
          <Line className="h-3 w-4/5 max-w-160" />
          <div
            className={`grid min-w-0 items-start gap-4 ${showDetail ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
          >
            <DesktopTable
              ariaLabel="Memuat kategori budget"
              rows={["material", "labor", "operations", "other", "subcon"].map((id) => ({ id }))}
              rowKey={(row) => row.id}
              layout="fixed"
              columns={[
                {
                  key: "category",
                  label: "Kategori",
                  widthPercent: 22,
                  render: () => (
                    <div className="space-y-2 py-2">
                      <Line className="h-4 w-20 max-w-full" />
                      <Line className="h-3 w-16 max-w-full" />
                    </div>
                  ),
                },
                {
                  key: "allocated",
                  label: "Alokasi",
                  widthPercent: 17,
                  render: () => <Line className="ml-auto h-3 w-16 max-w-full" />,
                },
                {
                  key: "actual",
                  label: "Terpakai",
                  widthPercent: 17,
                  render: () => <Line className="ml-auto h-3 w-16 max-w-full" />,
                },
                {
                  key: "remaining",
                  label: "Sisa",
                  widthPercent: 17,
                  render: () => <Line className="ml-auto h-3 w-16 max-w-full" />,
                },
                {
                  key: "condition",
                  label: "Kondisi",
                  widthPercent: 27,
                  render: () => <Line className="h-6 w-24 max-w-full" />,
                },
              ]}
            />
            {showDetail ? (
              <GroupedSurface variant="desktopPanel" className="hidden xl:block">
                <div className="space-y-3 p-4">
                  <Line className="h-5 w-28" />
                  <Line className="h-3 w-40" />
                  <Line className="h-2 w-full" />
                </div>
                <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
                  {["allocated", "used", "remaining", "pending", "paid"].map((item) => (
                    <div
                      key={item}
                      className="flex min-h-12 items-center justify-between gap-4 px-4 py-3"
                    >
                      <Line className="h-3 w-24" />
                      <Line className="h-4 w-20" />
                    </div>
                  ))}
                </div>
                <div className="border-t border-outline-variant/20 p-4">
                  <Line className="h-8 w-full bg-primary/15" />
                </div>
              </GroupedSurface>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-2 items-start gap-4">
          {["actions", "readiness"].map((item) => (
            <div key={item} className="space-y-3">
              <Line className="h-5 w-36" />
              <GroupedSurface variant="desktopPanel">
                <div className="divide-y divide-outline-variant/20">
                  {["one", "two", "three"].map((row) => (
                    <div key={row} className="space-y-2 px-4 py-4">
                      <Line className="h-4 w-2/3" />
                      <Line className="h-3 w-4/5" />
                    </div>
                  ))}
                </div>
              </GroupedSurface>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">
        Identitas, navigasi, posisi finansial dan kategori budget proyek sedang disiapkan.
      </span>
    </div>
  );
}
