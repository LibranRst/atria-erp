"use client";

import type { ProductionReadinessItem } from "@/app/actions/administration";
import type { SettingsHubOverview } from "@/app/actions/settings/system";
import {
  DuotoneIconTile,
  GroupedSurface,
  WorkspaceModuleHeader,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";
import type { SettingsTab } from "../../utils/settings-tabs-config";
import { SettingsInverseSurface } from "../shared/settings-inverse-surface";

function percent(value: number): string {
  return new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function SettingsHub({
  data,
  readiness = [],
  onSelectTab,
}: {
  readonly data: SettingsHubOverview;
  readonly readiness?: readonly ProductionReadinessItem[];
  readonly onSelectTab: (tab: SettingsTab) => void;
}): React.JSX.Element {
  const modules = [
    {
      tab: "financial" as const,
      title: "Alokasi Budget & Finansial",
      description: "Batas internal, margin, pembagian kategori, dan buffer.",
      metric: percent(data.budgetCapRatio),
      label: "batas budget",
      icon: "trending_up" as const,
      access: data.permissions.canManageBudgetSettings,
    },
    {
      tab: "catalog" as const,
      title: "Material Master & Library Harga",
      description: "Template biaya, harga klien, dan spesifikasi material master.",
      metric: String(data.activeMaterialCount + data.activeItemCount),
      label: "item katalog",
      icon: "inventory_2" as const,
      access: data.permissions.canManageMaterialSettings || data.permissions.canManageItemLibrary,
    },
    {
      tab: "organization" as const,
      title: "Tim & Vendor",
      description: "Manajemen hak akses anggota tim dan daftar kontak vendor.",
      metric: "Akses",
      label: "organisasi",
      icon: "group" as const,
      access: data.permissions.canManageUsers || data.permissions.canManageVendors,
    },
  ] as const;
  const allocationWidth = Math.min(100, Math.max(0, data.categoryAllocationRatio * 100));
  const bufferWidth = Math.min(100, Math.max(0, data.unallocatedBufferRatio * 100));

  return (
    <section className="min-w-0 space-y-sm">
      <WorkspaceModuleHeader
        eyebrow="Posisi default"
        title="Default proyek baru"
        description="Formula yang dipakai saat budget dan master data baru disiapkan."
      />

      <SettingsInverseSurface label="Posisi default formula budget">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-eyebrow font-bold tracking-[0.18em] text-white/52 uppercase">
              Budget Internal
            </p>
            <p className="financial-amount mt-1.5 text-[36px] leading-none font-extrabold tracking-[-0.045em] text-white tabular-nums max-[430px]:text-[32px]">
              {percent(data.budgetCapRatio)}
            </p>
          </div>
          <WorkspaceStatusLabel label="Untuk proyek baru" tone="inverse" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex w-full min-w-0 flex-col gap-2 rounded-inset bg-white/8 p-3">
            <p className="text-[9px] leading-none font-bold tracking-[0.12em] text-white/52 uppercase">
              Margin target
            </p>
            <p className="financial-amount mt-1 font-sans text-lg font-extrabold tracking-tight text-white tabular-nums max-[430px]:text-[16px]">
              {percent(1 - data.budgetCapRatio)}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 rounded-inset bg-white/8 p-3">
            <p className="text-[9px] leading-none font-bold tracking-[0.12em] text-white/52 uppercase">
              Buffer kategori
            </p>
            <p className="financial-amount mt-1 font-sans text-lg font-extrabold tracking-tight text-white tabular-nums max-[430px]:text-[16px]">
              {percent(data.unallocatedBufferRatio)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-inset bg-white/8 p-3.5 ring-1 ring-white/6 max-[430px]:mt-3 max-[430px]:p-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-row justify-between">
              <p className="text-[9px] leading-none font-bold tracking-wide text-white/50 uppercase">
                Pembagian kategori
              </p>
              <p className="text-[9px] leading-none font-bold tracking-wide text-white/50 uppercase">
                Sisa buffer
              </p>
            </div>
            <div className="flex flex-row items-end justify-between">
              <p className="mt-1 font-sans text-lg font-extrabold tracking-tight text-white tabular-nums max-[430px]:text-[16px]">
                {percent(data.categoryAllocationRatio)}
              </p>
              <p className="mt-1 font-sans text-sm font-bold tracking-[-0.02em] text-white/80 tabular-nums">
                {percent(data.unallocatedBufferRatio)}
              </p>
            </div>
          </div>
          <div
            className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10"
            aria-label={`Alokasi kategori ${percent(data.categoryAllocationRatio)}, buffer ${percent(data.unallocatedBufferRatio)}`}
          >
            <span className="bg-white" style={{ width: `${allocationWidth}%` }} />
            <span className="bg-white/25" style={{ width: `${bufferWidth}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-meta font-semibold text-white/58">
            <span>Teralokasi {percent(data.categoryAllocationRatio)}</span>
            <span>Buffer internal {percent(data.unallocatedBufferRatio)}</span>
          </div>
        </div>
        <p className="mt-3 px-1 text-[10px] leading-[1.35] text-white/48">
          Perubahan default tidak mengubah budget proyek yang sudah aktif.
        </p>
      </SettingsInverseSurface>

      {readiness.length > 0 ? (
        <section className="space-y-2">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <h3 className="text-title font-semibold tracking-[-0.015em] text-on-surface">
              Kesiapan production
            </h3>
            <WorkspaceStatusLabel
              label={
                readiness.every((item) => item.ready)
                  ? "Siap simulasi"
                  : `${readiness.filter((item) => !item.ready).length} belum siap`
              }
              tone={readiness.every((item) => item.ready) ? "positive" : "inactive"}
            />
          </div>
          <GroupedSurface>
            <div className="divide-y divide-black/5.5">
              {readiness.map((item) => {
                const iconName = item.ready ? "check_circle" : "data_alert";
                return (
                  <div key={item.id} className="flex min-h-17 items-center gap-3 px-3.5 py-3">
                    <DuotoneIconTile
                      name={iconName}
                      tone={item.ready ? "neutral" : "attention"}
                      className="h-9 w-9"
                      iconClassName="icon-sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-row font-bold text-on-surface">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-[1.35] text-on-surface-variant">
                        {item.detail}
                      </span>
                    </span>
                    <WorkspaceStatusLabel
                      label={item.ready ? "Siap" : "Lengkapi"}
                      tone={item.ready ? "positive" : "inactive"}
                    />
                  </div>
                );
              })}
            </div>
          </GroupedSurface>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex min-h-10 items-center">
          <h3 className="text-title font-semibold tracking-[-0.015em] text-on-surface">
            Modul pengaturan
          </h3>
        </div>
        <GroupedSurface>
          <div className="divide-y divide-black/5.5">
            {modules.map((module) => {
              return (
                <button
                  key={module.tab}
                  type="button"
                  onClick={() => onSelectTab(module.tab)}
                  className="flex min-h-20.5 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/75"
                >
                  <DuotoneIconTile name={module.icon} className="h-9 w-9" iconClassName="icon-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-row font-bold text-on-surface">
                        {module.title}
                      </span>
                      <WorkspaceStatusLabel
                        label={module.access ? "Dapat dikelola" : "Hanya baca"}
                        tone={module.access ? "positive" : "inactive"}
                      />
                    </span>
                    <span className="mt-1 block truncate text-[10px] leading-[1.3] text-on-surface-variant">
                      {module.description}
                    </span>
                    <span className="mt-1.5 block font-mono text-meta font-bold text-on-surface tabular-nums">
                      {module.metric}{" "}
                      <span className="font-sans font-medium text-on-surface-variant">
                        {module.label}
                      </span>
                    </span>
                  </span>
                  <WorkspaceRowChevron />
                </button>
              );
            })}
          </div>
        </GroupedSurface>
      </section>
    </section>
  );
}
