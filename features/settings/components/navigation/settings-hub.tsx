"use client";

import type { ProductionReadinessItem } from "@/app/actions/administration";
import type { SettingsHubOverview } from "@/app/actions/settings/system";
import {
  AppIcon,
  GroupedSurface,
  WorkspaceModuleHeader,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";
import type { SettingsTab } from "../../utils/settings-tabs-config";

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
  readonly hideHeader?: boolean;
  readonly onSelectTab: (tab: SettingsTab) => void;
}): React.JSX.Element {
  const modules = [
    {
      tab: "budget",
      title: "Alokasi Budget",
      description: "Batas internal, margin, pembagian kategori, dan buffer.",
      metric: percent(data.budgetCapRatio),
      label: "batas budget",
      icon: "trending_up" as const,
      access: data.permissions.canManageBudgetSettings,
    },
    {
      tab: "categories",
      title: "Kategori Pengeluaran",
      description: "Kelompok biaya baku untuk budget dan laporan.",
      metric: String(data.activeCategoryCount),
      label: "kategori aktif",
      icon: "layers" as const,
      access: data.permissions.canManageExpenseCategories,
    },
    {
      tab: "library",
      title: "Library Item & Harga",
      description: "Template biaya, harga klien, paket kerja, dan RAB.",
      metric: String(data.activeItemCount),
      label: "template aktif",
      icon: "inventory" as const,
      access: data.permissions.canManageItemLibrary,
    },
    {
      tab: "materials",
      title: "Material Master",
      description: "Identitas material serta default inventori per lokasi.",
      metric: String(data.activeMaterialCount),
      label: "material aktif",
      icon: "inventory_2" as const,
      access: data.permissions.canManageMaterialSettings,
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

      <section className="overflow-hidden rounded-[30px] bg-surface-inverse px-5 py-5 text-white shadow-floating max-[430px]:rounded-[26px] max-[430px]:px-4 max-[430px]:py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-eyebrow font-bold tracking-[0.15em] text-white/48 uppercase">
              Budget Internal
            </p>
            <p className="mt-2 font-mono text-[29px] leading-none font-black tracking-[-0.03em] tabular-nums">
              {percent(data.budgetCapRatio)}
            </p>
          </div>
          <WorkspaceStatusLabel label="Untuk proyek baru" tone="inverse" />
        </div>
        <div className="mt-5 grid grid-cols-2 divide-x divide-white/10 border-y border-white/10 py-3.5">
          <div className="pr-4">
            <p className="text-eyebrow font-bold tracking-widest text-white/45 uppercase">
              Margin target
            </p>
            <p className="mt-1.5 font-mono text-[16px] font-bold tabular-nums">
              {percent(1 - data.budgetCapRatio)}
            </p>
          </div>
          <div className="pl-4 text-right">
            <p className="text-eyebrow font-bold tracking-widest text-white/45 uppercase">
              Buffer kategori
            </p>
            <p className="mt-1.5 font-mono text-[16px] font-bold tabular-nums">
              {percent(data.unallocatedBufferRatio)}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-[20px] bg-white/7.5 p-3.5 ring-1 ring-white/6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-eyebrow font-bold tracking-widest text-white/45 uppercase">
                Pembagian kategori
              </p>
              <p className="mt-1 font-mono text-[14px] font-bold tabular-nums">
                {percent(data.categoryAllocationRatio)}
              </p>
            </div>
            <p className="text-right text-[10px] leading-[1.3] text-white/55">
              Sisa tetap menjadi
              <br />
              buffer internal
            </p>
          </div>
          <div
            className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10"
            aria-label={`Alokasi kategori ${percent(data.categoryAllocationRatio)}, buffer ${percent(data.unallocatedBufferRatio)}`}
          >
            <span className="bg-white" style={{ width: `${allocationWidth}%` }} />
            <span className="bg-white/25" style={{ width: `${bufferWidth}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[8px] font-bold tracking-[0.08em] text-white/45 uppercase">
            <span>Teralokasi</span>
            <span>Buffer</span>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-[1.35] text-white/48">
          Perubahan default tidak mengubah budget proyek yang sudah aktif.
        </p>
      </section>

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
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.ready ? "bg-success-container text-success" : "bg-warning-container text-warning"}`}
                    >
                      <AppIcon name={iconName} className="icon-sm" aria-hidden="true" />
                    </span>
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
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface">
                    <AppIcon name={module.icon} className="icon-sm" aria-hidden="true" />
                  </span>
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
