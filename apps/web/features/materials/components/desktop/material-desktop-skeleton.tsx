"use client";

import { DesktopTable, GroupedSurface, type DesktopTableColumn } from "@/components/ui";
import type { MaterialTab } from "@/features/materials/utils/material-ui-utils";
import type { MaterialDesktopActivityInput } from "@atria/core/material/material-desktop";

type PlaceholderRow = { readonly id: string };
const labels: Record<MaterialTab, readonly string[]> = {
  overview: ["Material", "Tersedia", "Nilai stok", "Kondisi"],
  inventory: ["Material", "Fisik", "Terikat", "Tersedia", "Nilai stok", "Kondisi"],
  needs: ["Material / area", "Proyek", "Kebutuhan", "Belum tertutup", "Estimasi RAP", "Status"],
  activity: ["Aktivitas", "Material / dokumen", "Lokasi", "Proyek", "Tanggal", "Kondisi"],
};

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div className={`rounded-full bg-surface-container ${className}`} />;
}

function ContextPlaceholder({ overview }: { readonly overview: boolean }): React.JSX.Element {
  return (
    <div className="hidden min-w-0 space-y-4 xl:block">
      <GroupedSurface variant="desktopPanel" className="space-y-4 p-4">
        <Line className="h-5 w-36 max-w-full" />
        <Line className="h-3 w-48 max-w-full bg-surface-container-low" />
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-2 border-t border-ring-subtle pt-4">
            <Line className="h-3 w-32 max-w-full" />
            <Line className="h-3 w-44 max-w-full bg-surface-container-low" />
          </div>
        ))}
        <Line className="h-9 w-full" />
      </GroupedSurface>
      {overview ? (
        <GroupedSurface variant="desktopPanel" className="space-y-4 p-4">
          <Line className="h-5 w-28" />
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-2">
              <Line className="h-3 w-40 max-w-full" />
              <Line className="h-3 w-32 bg-surface-container-low" />
            </div>
          ))}
        </GroupedSurface>
      ) : null}
    </div>
  );
}

/** Structural, passive placeholders preserve the desktop material workspace hierarchy. */
export function MaterialDesktopSkeleton({
  tab = "overview",
  showDetail = tab === "overview",
  region = "page",
  activityKind = "movements",
}: {
  readonly tab?: MaterialTab;
  readonly showDetail?: boolean;
  readonly region?: "page" | "body" | "table";
  readonly activityKind?: MaterialDesktopActivityInput["kind"];
}): React.JSX.Element {
  const activityLabels: Record<MaterialDesktopActivityInput["kind"], readonly string[]> = {
    movements: ["Material", "Gerakan", "Lokasi / proyek", "Jumlah", "Tanggal"],
    receipts: ["Penerimaan", "Proyek / lokasi", "Nilai", "Tanggal", "Status"],
    transfers: ["Transfer", "Dari → tujuan", "Item", "Nilai", "Tanggal"],
    counts: ["Stock opname", "Lokasi", "Item", "Tanggal", "Status"],
  };
  const visibleLabels = tab === "activity" ? activityLabels[activityKind] : labels[tab];
  const columns: readonly DesktopTableColumn<PlaceholderRow>[] = visibleLabels.map(
    (label, index) => ({
      key: `material-loading-column-${index}`,
      label,
      render: (): React.JSX.Element =>
        index === 0 ? (
          <div className="min-w-0 space-y-2 py-1">
            <Line className="h-3 w-40 max-w-full" />
            <Line className="h-3 w-28 max-w-full bg-surface-container-low" />
          </div>
        ) : (
          <Line
            className={
              index === visibleLabels.length - 1 ? "h-6 w-20 max-w-full" : "h-3 w-16 max-w-full"
            }
          />
        ),
    }),
  );
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Memuat Material desktop"
      data-material-skeleton={tab}
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
              {["w-28", "w-24", "w-28", "w-24"].map((width, index) => (
                <Line
                  key={`${index}-${width}`}
                  className={`h-8 shrink-0 bg-surface-container-lowest ${width}`}
                />
              ))}
            </div>
            {tab === "overview" ? (
              <div className="flex items-center justify-between gap-4 px-1">
                <Line className="h-5 w-40" />
                <Line className="h-8 w-28 bg-surface-container-lowest" />
              </div>
            ) : (
              <div className="flex min-w-0 flex-wrap gap-2">
                <Line className="h-10 min-w-0 flex-1 basis-60 bg-surface-container-lowest" />
                <Line className="h-10 w-40 bg-surface-container-lowest" />
                <Line className="h-10 w-36 bg-surface-container-lowest" />
                {tab === "activity" ? (
                  <Line className="h-10 w-32 bg-surface-container-lowest" />
                ) : null}
              </div>
            )}
          </>
        ) : null}
        <div
          className={`grid min-w-0 items-start gap-4 ${showDetail ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
        >
          <DesktopTable
            ariaLabel="Struktur daftar material sedang dimuat"
            columns={columns}
            rows={Array.from({ length: tab === "overview" ? 5 : 10 }, (_, index) => ({
              id: `material-loading-row-${index}`,
            }))}
            rowKey={(row): string => row.id}
            footer={
              tab === "overview" ? undefined : (
                <div className="flex flex-wrap items-center gap-2">
                  <Line className="h-3 w-40" />
                  <Line className="h-9 w-24" />
                  <Line className="h-8 w-24" />
                  <Line className="h-8 w-24" />
                </div>
              )
            }
          />
          {showDetail ? <ContextPlaceholder overview={tab === "overview"} /> : null}
        </div>
      </div>
      <span className="sr-only">
        {tab === "overview"
          ? "Posisi stok, kebutuhan, keputusan, dan aktivitas material sedang disiapkan."
          : "Ringkasan dan daftar material sedang disiapkan."}
      </span>
    </div>
  );
}
