"use client";

import React from "react";
import { MapPin, Package } from "lucide-react";

import { FilterPills, PanelEmptyState as EmptyState, SearchInput } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import type { MaterialLocation } from "@/features/materials/components/material-dashboard-types";
import {
  formatMaterialQuantity,
  getGroupedMaterialStockSummary,
  type GroupedMaterial,
  type GroupedMaterialStockSummary,
} from "@/features/materials/lib/material-ui-utils";

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
  return (
    <div className="space-y-md">
      <div className="sticky top-16 z-20 space-y-3 rounded-[28px] border border-outline-variant/20 bg-white/95 p-sm shadow-[0_14px_34px_rgba(17,17,17,0.055)] backdrop-blur-md">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Cari material, kategori..."
          ariaLabel="Cari inventory material"
        />
        <div className="overflow-x-auto">
          <FilterPills
            value={location}
            onChange={onLocationChange}
            options={[
              { value: "ALL", label: "Semua lokasi" },
              ...locations.map((row) => ({ value: row.id, label: row.name })),
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <FilterPills
            value={status}
            onChange={onStatusChange}
            options={[
              { value: "ALL", label: "Semua status" },
              { value: "AVAILABLE", label: "Available" },
              { value: "LOW_STOCK", label: "Low" },
              { value: "OUT_OF_STOCK", label: "Out" },
              { value: "RESERVED", label: "Reserved" },
            ]}
          />
        </div>
      </div>

      {visibleMaterials.length === 0 ? (
        <EmptyState
          title="Material tidak ditemukan"
          description="Ubah pencarian atau filter inventory."
        />
      ) : (
        <div className="space-y-2.5">
          {visibleMaterials.map((material) => (
            <InventoryMaterialCard
              key={material.id}
              material={material}
              onOpenMaterial={onOpenMaterial}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryMaterialCard({
  material,
  onOpenMaterial,
}: {
  readonly material: GroupedMaterial;
  readonly onOpenMaterial: (materialId: string) => void;
}): React.JSX.Element {
  const summary = getGroupedMaterialStockSummary(material);
  const primaryRow = material.rows[0];
  const availabilityPercent =
    summary.currentStock > 0
      ? Math.min(
          Math.max((summary.availableStock / summary.currentStock) * 100, 0),
          100,
        )
      : 0;
  const metadata = [
    primaryRow?.specification,
    primaryRow?.brand,
    primaryRow?.code,
    primaryRow?.color,
  ].filter((item): item is string => Boolean(item));

  return (
    <button
      type="button"
      onClick={() => onOpenMaterial(material.id)}
      className="w-full rounded-[28px] border border-outline-variant/20 bg-white px-3 py-3.5 text-left shadow-[0_8px_22px_rgba(17,17,17,0.04)] outline-none transition hover:bg-surface-container-low/45 focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface">
          <Package className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="truncate text-sm font-bold">{material.name}</p>
          </div>
          <p className="mt-1 truncate text-[10px] leading-4 text-on-surface-variant">
            {material.categoryName}
            {metadata.length > 0 ? ` · ${metadata.join(" · ")}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-outline-variant/10 pt-2.5">
        <InventoryMetric label="Available" value={formatMaterialQuantity(summary.availableStock)} />
        <InventoryMetric label="Reserved" value={formatMaterialQuantity(summary.reservedStock)} />
        <InventoryMetric label="Minimum" value={formatMaterialQuantity(summary.minimumStock)} />
      </div>
      <div className="mt-2.5">
        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold text-on-surface-variant">
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {summary.locationCount} lokasi · {primaryRow?.locationName ?? "Belum ada lokasi"}
          </span>
          <MoneyValue amount={summary.stockValue} variant="compactWithFull" align="right" size="xs" />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container">
          <div
            className={`h-full rounded-full ${summary.status === "OUT_OF_STOCK" ? "bg-critical" : summary.status === "AVAILABLE" ? "bg-primary" : "bg-warning"}`}
            style={{ width: `${availabilityPercent}%` }}
          />
        </div>
      </div>
      <div className="mt-2.5 flex justify-end">
        <InventoryStatusPill summary={summary} />
      </div>
    </button>
  );
}

function InventoryMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="truncate text-[8px] font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 font-mono text-[12px] font-extrabold leading-4 text-on-surface tabular-nums">
        {value}
      </p>
    </div>
  );
}

function InventoryStatusPill({
  summary,
}: {
  readonly summary: GroupedMaterialStockSummary;
}): React.JSX.Element {
  const label = summary.status === "AVAILABLE" ? "Available" : "Attention";
  const classes =
    summary.status === "AVAILABLE"
      ? "bg-surface-container-low text-on-surface-variant ring-outline-variant/15"
      : summary.status === "OUT_OF_STOCK"
        ? "bg-critical-light text-critical ring-critical/10"
        : "bg-warning-light text-warning ring-warning/10";

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-wide ring-1 ${classes}`}
    >
      {label}
    </span>
  );
}
