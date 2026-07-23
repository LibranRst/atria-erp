"use client";

import { MapPin, Package } from "lucide-react";
import React from "react";

import {
  ExclusiveSearchFilterBar,
  type SearchFilterMode,
} from "@/components/ui/navigation/exclusive-search-filter-bar";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { SegmentedTabs } from "@/components/ui/navigation/segmented-tabs";
import type { MaterialLocation } from "@/features/materials/types/material-dashboard-types";
import { AppIcon } from "@/components/ui/icon/app-icon";
import {
  MaterialGroupSurface,
  MaterialInlineState,
  MaterialSection,
  MaterialStatusLabel,
  type MaterialTone,
} from "@/features/materials/components/shared/material-page-primitives";
import {
  formatMaterialQuantity,
  getGroupedMaterialStockSummary,
  type GroupedMaterial,
  type GroupedMaterialStockSummary,
} from "@/features/materials/utils/material-ui-utils";

type InventoryTabProps = {
  readonly search: string;
  readonly location: string;
  readonly status: string;
  readonly locations: readonly MaterialLocation[];
  readonly visibleMaterials: readonly GroupedMaterial[];
  readonly onSearchChange: (value: string) => void;
  readonly onLocationChange: (value: string) => void;
  readonly onStatusChange: (value: string) => void;
  readonly onOpenMaterial: (materialId: string) => void;
};

export function MaterialInventoryTab({
  search,
  location,
  status,
  locations,
  visibleMaterials,
  onSearchChange,
  onLocationChange,
  onStatusChange,
  onOpenMaterial,
}: InventoryTabProps): React.JSX.Element {
  const [mode, setMode] = React.useState<SearchFilterMode>("filter");

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <div className="space-y-2" data-material-controls="inline">
        <ExclusiveSearchFilterBar
          mode={mode}
          filterValue={status}
          onFilterChange={onStatusChange}
          filterAriaLabel="Filter status stok"
          filterLayoutId="material-inventory-status"
          searchLayoutId="material-inventory-search"
          searchValue={search}
          onSearchChange={onSearchChange}
          onModeChange={setMode}
          searchPlaceholder="Cari material atau kategori"
          searchAriaLabel="Cari inventori material"
          filterOptions={[
            { value: "ALL", label: "Semua" },
            { value: "AVAILABLE", label: "Tersedia" },
            { value: "LOW_STOCK", label: "Menipis" },
            { value: "OUT_OF_STOCK", label: "Habis" },
            { value: "RESERVED", label: "Terikat" },
          ]}
        />
        {locations.length > 0 ? (
          <SegmentedTabs
            value={location}
            onChange={onLocationChange}
            ariaLabel="Filter lokasi stok"
            layoutId="material-inventory-location"
            density="compact"
            scrollable
            fillAvailableSpace={locations.length + 1 <= 3}
            options={[
              {
                value: "ALL",
                label: "Semua lokasi",
                icon: <MapPin className="h-3.5 w-3.5" aria-hidden="true" />,
              },
              ...locations.map((row) => ({ value: row.id, label: row.name })),
            ]}
          />
        ) : null}
      </div>

      <MaterialSection title="Daftar material" meta={`${visibleMaterials.length} material`}>
        <MaterialGroupSurface>
          {visibleMaterials.length === 0 ? (
            <MaterialInlineState
              icon="search_off"
              title="Material tidak ditemukan"
              description="Ubah kata pencarian, lokasi, atau status stok untuk melihat hasil lain."
            />
          ) : (
            <div className="divide-y divide-black/5.5">
              {visibleMaterials.map((material) => (
                <InventoryMaterialRow
                  key={material.id}
                  material={material}
                  onOpenMaterial={onOpenMaterial}
                />
              ))}
            </div>
          )}
        </MaterialGroupSurface>
      </MaterialSection>
    </div>
  );
}

function InventoryMaterialRow({
  material,
  onOpenMaterial,
}: {
  readonly material: GroupedMaterial;
  readonly onOpenMaterial: (materialId: string) => void;
}): React.JSX.Element {
  const summary = getGroupedMaterialStockSummary(material);
  const primaryRow = material.rows[0];
  const metadata = [
    primaryRow?.specification,
    primaryRow?.brand,
    primaryRow?.code,
    primaryRow?.color,
  ].filter((item): item is string => Boolean(item));
  const statusPresentation = inventoryStatusPresentation(summary);

  return (
    <button
      type="button"
      onClick={() => onOpenMaterial(material.id)}
      className="w-full px-3.5 py-3.5 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
      aria-label={`Buka detail ${material.name}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${statusPresentation.iconClass}`}
        >
          <Package className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate text-[13px] leading-4 font-bold text-on-surface">
            {material.name}
          </span>
          <span className="truncate text-[10px] leading-[1.3] text-on-surface-variant">
            {material.categoryName}
            {metadata.length > 0 ? ` · ${metadata.join(" · ")}` : ""}
          </span>
        </span>
        <MaterialStatusLabel label={statusPresentation.label} tone={statusPresentation.tone} />
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-black/5.5 rounded-[18px] bg-surface-container-low/65 px-3 py-2.5">
        <InventoryMetric label="Tersedia" value={formatMaterialQuantity(summary.availableStock)} />
        <InventoryMetric
          label="Terreservasi"
          value={formatMaterialQuantity(summary.reservedStock)}
          align="center"
        />
        <InventoryMetric
          label="Minimum"
          value={formatMaterialQuantity(summary.minimumStock)}
          align="right"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[10px] font-semibold text-on-surface-variant">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {summary.locationCount} lokasi · {primaryRow?.locationName ?? "Lokasi belum diatur"}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <MoneyValue
            amount={summary.stockValue}
            variant="compactWithFull"
            align="right"
            size="xs"
          />
          <AppIcon name="chevron_right" className="text-[17px] text-accent" />
        </span>
      </div>
    </button>
  );
}

function InventoryMetric({
  label,
  value,
  align = "left",
}: {
  readonly label: string;
  readonly value: string;
  readonly align?: "left" | "center" | "right";
}): React.JSX.Element {
  const alignment =
    align === "right" ? "text-right pl-2" : align === "center" ? "text-center px-2" : "pr-2";
  return (
    <span className={`min-w-0 ${alignment}`}>
      <span className="block truncate text-[8px] font-bold tracking-wide text-on-surface-variant/65 uppercase">
        {label}
      </span>
      <span className="mt-1 block truncate font-mono text-[12px] leading-4 font-extrabold text-on-surface tabular-nums">
        {value}
      </span>
    </span>
  );
}

function inventoryStatusPresentation(summary: GroupedMaterialStockSummary): {
  readonly label: string;
  readonly tone: MaterialTone;
  readonly iconClass: string;
} {
  if (summary.status === "OUT_OF_STOCK") {
    return {
      label: "Habis",
      tone: "critical",
      iconClass: "bg-error/8 text-error ring-1 ring-error/6",
    };
  }
  if (summary.status === "LOW_STOCK") {
    return {
      label: "Menipis",
      tone: "warning",
      iconClass: "bg-warning/9 text-warning ring-1 ring-warning/6",
    };
  }
  if (summary.status === "RESERVED") {
    return {
      label: "Terikat",
      tone: "pending",
      iconClass: "bg-primary/8 text-primary ring-1 ring-primary/6",
    };
  }
  return {
    label: "Tersedia",
    tone: "positive",
    iconClass: "bg-success/8 text-success ring-1 ring-success/6",
  };
}
