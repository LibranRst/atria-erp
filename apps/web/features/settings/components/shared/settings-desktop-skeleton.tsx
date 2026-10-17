"use client";

import React from "react";
import { DesktopTable, GroupedSurface } from "@/components/ui";
import { useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { resolveSettingsTab } from "../../utils/settings-tabs-config";
import { usePathname } from "@/lib/navigation/workspace-navigation";

function Line({
  className,
  style,
}: {
  readonly className: string;
  readonly style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`rounded-full bg-surface-container ${className}`}
    />
  );
}

function TablePlaceholder({ labels }: { readonly labels: readonly string[] }): React.JSX.Element {
  return (
    <div aria-hidden="true" inert className="min-w-0">
      <DesktopTable
        ariaLabel="Struktur tabel Pengaturan sedang dimuat"
        rows={Array.from({ length: 5 }, (_, index) => ({ id: `settings-skeleton-row-${index}` }))}
        rowKey={(row): string => row.id}
        columns={labels.map((label, index) => ({
          key: `settings-skeleton-column-${index}`,
          label,
          render: (): React.JSX.Element => (
            <Line className={index === 0 ? "h-3 w-24 max-w-full" : "h-3 w-16 max-w-full"} />
          ),
        }))}
        footer={
          <div className="flex items-center justify-between gap-4">
            <Line className="h-3 w-36" />
            <Line className="h-8 w-48" />
          </div>
        }
      />
    </div>
  );
}

function ContextPanel(): React.JSX.Element {
  return (
    <GroupedSurface variant="desktopPanel" className="space-y-4 p-4">
      <Line className="h-4 w-28" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex items-center justify-between gap-4">
          <Line className="h-3 w-32" />
          <Line className="h-3 w-20" />
        </div>
      ))}
      <Line className="h-8 w-32" />
    </GroupedSurface>
  );
}

export function SettingsDesktopSkeleton(): React.JSX.Element {
  const pathname = usePathname();
  const tab = resolveSettingsTab(pathname, useBrowserUrlSearchParam("tab"));
  const section =
    useBrowserUrlSearchParam("section") ?? (pathname === "/settings/library" ? "library" : null);
  const flow = useBrowserUrlSearchParam("flow");
  if (tab === "readiness" && flow === "initial-stock") {
    return (
      <div role="status" aria-label="Memuat saldo awal stok" className="min-w-0 space-y-4 pb-6">
        <div aria-hidden="true" className="flex items-center gap-3">
          <Line className="h-9 w-9" />
          <Line className="h-6 w-48" />
        </div>
        <Line className="h-3 w-96 max-w-full" />
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <ContextPanel />
          <div className="min-w-0 space-y-3">
            <Line className="h-5 w-48" />
            <TablePlaceholder labels={["Pengajuan", "Status", "Item", "Nilai saldo awal"]} />
          </div>
        </div>
        <span className="sr-only">Stok dan riwayat pengajuan sedang dibaca.</span>
      </div>
    );
  }
  const catalogLabels =
    section === "library"
      ? ["Template", "Kategori", "Biaya", "Harga klien", "Status"]
      : section === "locations"
        ? ["Lokasi", "Material"]
        : ["Material", "Spesifikasi", "Satuan", "Vendor", "Status"];
  return (
    <div role="status" aria-label="Memuat Pengaturan" className="min-w-0 space-y-4 pb-6">
      <div aria-hidden="true" className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Line className="h-7 w-44" />
          <Line className="h-3 w-80 max-w-full" />
        </div>
        <Line className="h-7 w-20" />
      </div>
      <div
        aria-hidden="true"
        className="flex w-fit max-w-full gap-1 overflow-hidden rounded-full bg-surface-container p-1"
      >
        {[120, 128, 152, 112].map((width) => (
          <Line key={width} className="h-8 bg-surface-container-lowest" style={{ width }} />
        ))}
      </div>
      {tab === "financial" ? (
        <>
          <GroupedSurface variant="desktopPanel" className="grid grid-cols-4 gap-4 p-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="space-y-3">
                <Line className="h-3 w-24 max-w-full" />
                <Line className="h-6 w-16" />
              </div>
            ))}
          </GroupedSurface>
          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-3">
              <Line className="h-4 w-40" />
              <TablePlaceholder labels={["Kategori", "Porsi", "Nilai contoh", "Rincian"]} />
            </div>
            <div className="space-y-4">
              <ContextPanel />
              <ContextPanel />
            </div>
          </div>
          <GroupedSurface variant="desktopPanel" className="space-y-4 p-4">
            <Line className="h-4 w-44" />
            <div className="grid grid-cols-2 gap-6">
              <Line className="h-6 w-40" />
              <Line className="h-6 w-40" />
            </div>
          </GroupedSurface>
        </>
      ) : tab === "readiness" && !flow ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ContextPanel />
          <ContextPanel />
        </div>
      ) : (
        <>
          <div aria-hidden="true" className="flex items-center justify-between gap-4">
            <Line className="h-8 w-72 max-w-full" />
            <Line className="h-8 w-32" />
          </div>
          <div aria-hidden="true" className="flex items-center justify-between gap-4">
            <Line className="h-9 w-64" />
            <Line className="h-9 w-44" />
          </div>
          <TablePlaceholder
            labels={
              tab === "catalog"
                ? catalogLabels
                : tab === "organization"
                  ? ["Nama", "Peran", "Status", "Akses akun"]
                  : ["Material", "Stok", "Lokasi", "Status"]
            }
          />
        </>
      )}
      <span className="sr-only">Pengaturan dan hak akses sedang disiapkan.</span>
    </div>
  );
}
