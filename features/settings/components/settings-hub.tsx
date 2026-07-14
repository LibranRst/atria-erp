"use client";

import {
  ArrowUpRight,
  Boxes,
  ChartNoAxesCombined,
  Layers3,
  PackageSearch,
} from "lucide-react";

import type { SettingsHubOverview } from "@/app/actions/settings/system";
import { CompactMetric, SettingsHeader } from "./settings-ui";
import { MetricGrid, NativeSection } from "@/components/ui/page-primitives";
import type { SettingsTab } from "./settings-tabs-config";

function percent(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function SettingsHub({
  data,
  hideHeader = false,
  onSelectTab,
}: {
  readonly data: SettingsHubOverview;
  readonly hideHeader?: boolean;
  readonly onSelectTab: (tab: SettingsTab) => void;
}): React.JSX.Element {
  const modules = [
    {
      tab: "budget",
      title: "Alokasi Budget",
      description: "Atur batas Budget Internal, rasio kategori, dan buffer.",
      metric: percent(data.budgetCapRatio),
      label: "batas budget",
      icon: ChartNoAxesCombined,
      access: data.permissions.canManageBudgetSettings,
    },
    {
      tab: "categories",
      title: "Kategori Pengeluaran",
      description: "Kelola nama dan deskripsi lima kelompok biaya baku.",
      metric: String(data.activeCategoryCount),
      label: "kategori aktif",
      icon: Layers3,
      access: data.permissions.canManageExpenseCategories,
    },
    {
      tab: "library",
      title: "Library Item & Harga",
      description:
        "Template harga klien, biaya internal, paket kerja, dan baris penawaran.",
      metric: String(data.activeItemCount),
      label: "item aktif",
      icon: PackageSearch,
      access: data.permissions.canManageItemLibrary,
    },
    {
      tab: "materials",
      title: "Material Master",
      description: "Identitas material dan default inventori per lokasi.",
      metric: String(data.activeMaterialCount),
      label: "material aktif",
      icon: Boxes,
      access: data.permissions.canManageMaterialSettings,
    },
  ] as const;

  return (
    <section className="min-w-0 space-y-lg">
      {!hideHeader && (
        <SettingsHeader
          eyebrow="Pusat kontrol"
          title="Pengaturan ERP"
          description="Default budget dan master data untuk alur proyek baru."
          role={data.roleName}
        />
      )}
      <NativeSection>
        <MetricGrid minColumnWidth={132}>
          <CompactMetric
            label="Batas Budget"
            value={percent(data.budgetCapRatio)}
            tone="primary"
          />
          <CompactMetric
            label="Alokasi Kategori"
            value={percent(data.categoryAllocationRatio)}
          />
          <CompactMetric
            label="Buffer"
            value={percent(data.unallocatedBufferRatio)}
            tone="warning"
          />
          <CompactMetric
            label="Margin Kotor"
            value={percent(1 - data.budgetCapRatio)}
          />
        </MetricGrid>
      </NativeSection>
      <NativeSection
        eyebrow="Modul pengaturan"
        title="Default Data & Kontrol"
        contentClassName="space-y-2"
      >
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.tab}
              type="button"
              onClick={() => onSelectTab(module.tab)}
              className="group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-left transition active:bg-surface-container"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold text-on-surface">
                  {module.title}
                </h2>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-on-surface-variant">
                  {module.description}
                </p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="financial-amount break-words font-mono text-xs font-bold leading-4 text-on-surface [overflow-wrap:anywhere]">
                    {module.metric}{" "}
                    <span className="font-sans text-[9px] font-medium text-on-surface-variant">
                      {module.label}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${module.access ? "bg-primary/10 text-primary" : "bg-white text-on-surface-variant"}`}
                  >
                    {module.access ? "Manage" : "Read only"}
                  </span>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-on-surface-variant transition group-active:text-primary" />
            </button>
          );
        })}
      </NativeSection>
    </section>
  );
}
