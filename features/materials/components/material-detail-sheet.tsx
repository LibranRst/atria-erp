"use client";

import React from "react";

import type { MaterialMovementView } from "@/app/actions/material/operations-dashboard";
import type { MaterialInventoryRow } from "@/app/actions/material/inventory";
import { BottomSheet } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import { MovementRow } from "@/features/materials/components/material-operation-primitives";
import {
  formatMaterialQuantity,
  getGroupedMaterialStockSummary,
  type GroupedMaterial,
  type GroupedMaterialStockSummary,
} from "@/features/materials/lib/material-ui-utils";

export function MaterialDetail({
  openId,
  grouped,
  movements,
  onClose,
}: {
  readonly openId: string | null;
  readonly grouped: readonly GroupedMaterial[];
  readonly movements: readonly MaterialMovementView[];
  readonly onClose: () => void;
}): React.JSX.Element {
  const material = grouped.find((row) => row.id === openId);
  const summary = material ? getGroupedMaterialStockSummary(material) : null;
  const primaryRow = material?.rows[0];
  const metadata = [
    material?.categoryName,
    primaryRow?.specification,
    primaryRow?.brand,
    primaryRow?.code,
    primaryRow?.color,
  ].filter((item): item is string => Boolean(item));
  const materialMovements = material
    ? movements.filter((row) => row.materialId === material.id)
    : [];

  return (
    <BottomSheet
      open={Boolean(material)}
      title={material?.name ?? "Material Detail"}
      onClose={onClose}
    >
      {material && summary && (
        <div className="space-y-2">
          <DetailHeader
            materialName={material.name}
            metadata={metadata}
            summary={summary}
          />
          <StockSummaryStrip summary={summary} />
          <DetailSection
            title="Lokasi Stock"
            contentClassName="divide-y divide-outline-variant/35"
          >
            {material.rows.map((row) => (
              <LocationStockRow key={row.inventoryId} row={row} />
            ))}
          </DetailSection>
          {material.shortages.some((row) => row.needToBuy > 0) && (
            <DetailSection
              title="Project Shortage"
              contentClassName="divide-y divide-outline-variant/35"
            >
              {material.shortages
                .filter((row) => row.needToBuy > 0)
                .map((row) => (
                  <ShortageRow
                    key={row.projectRapItemId}
                    area={row.area}
                    totalQuantity={row.totalQuantity}
                    availableStock={row.availableStock}
                    needToBuy={row.needToBuy}
                    estimatedTotalCost={row.estimatedTotalCost}
                  />
                ))}
            </DetailSection>
          )}
          <DetailSection
            title="Recent Movement"
            contentClassName="divide-y divide-outline-variant/35"
          >
            {materialMovements.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-xs leading-5 text-on-surface-variant ring-1 ring-outline-variant/10">
                Belum ada movement terbaru untuk material ini.
              </p>
            ) : (
              materialMovements
                .slice(0, 8)
                .map((row) => <MovementRow key={row.id} row={row} />)
            )}
          </DetailSection>
        </div>
      )}
    </BottomSheet>
  );
}

function DetailHeader({
  materialName,
  metadata,
  summary,
}: {
  readonly materialName: string;
  readonly metadata: readonly string[];
  readonly summary: GroupedMaterialStockSummary;
}): React.JSX.Element {
  return (
    <section className="pb-2">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold leading-5 text-on-surface">
            {materialName}
          </h3>
          {metadata.length > 0 && (
            <p className="mt-0.5 truncate text-[10px] font-semibold leading-4 text-on-surface-variant">
              {metadata.join(" · ")}
            </p>
          )}
        </div>
        <MaterialDetailStatus summary={summary} />
      </div>
    </section>
  );
}

function StockSummaryStrip({
  summary,
}: {
  readonly summary: GroupedMaterialStockSummary;
}): React.JSX.Element {
  return (
    <section className="grid grid-cols-5 gap-px overflow-hidden rounded-2xl bg-outline-variant/10">
      <DetailMetric
        label="Avail"
        value={formatMaterialQuantity(summary.availableStock)}
        strong
      />
      <DetailMetric
        label="Curr"
        value={formatMaterialQuantity(summary.currentStock)}
      />
      <DetailMetric
        label="Res"
        value={formatMaterialQuantity(summary.reservedStock)}
      />
      <DetailMetric
        label="Min"
        value={formatMaterialQuantity(summary.minimumStock)}
      />
      <DetailMetric
        label="Value"
        amount={summary.stockValue}
        strong
      />
    </section>
  );
}

function DetailSection({
  title,
  children,
  contentClassName,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly contentClassName?: string;
}): React.JSX.Element {
  return (
    <section className="rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-outline-variant/10">
      <p className="text-[8px] font-bold uppercase tracking-wide text-on-surface-variant">
        {title}
      </p>
      <div className={`mt-1 ${contentClassName ?? ""}`}>{children}</div>
    </section>
  );
}

function DetailMetric({
  label,
  value,
  amount,
  strong = false,
}: {
  readonly label: string;
  readonly value?: string;
  readonly amount?: number;
  readonly strong?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 bg-white px-2 py-2">
      <p className="truncate text-[7px] font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      {typeof amount === "number" ? (
        <MoneyValue
          amount={amount}
          variant="compactWithFull"
          size="sm"
          className="mt-0.5"
        />
      ) : (
        <p
          className={`mt-0.5 truncate font-mono text-[10px] leading-4 tabular-nums ${strong ? "font-extrabold text-on-surface" : "font-bold text-on-surface"}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function MaterialDetailStatus({
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
      className={`shrink-0 rounded-full px-2 py-0.5 text-[7px] font-extrabold uppercase tracking-wide ring-1 ${classes}`}
    >
      {label}
    </span>
  );
}

function LocationStockRow({
  row,
}: {
  readonly row: MaterialInventoryRow;
}): React.JSX.Element {
  const value = row.currentStock * row.averageCost;
  return (
    <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] gap-3 py-2">
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="truncate text-xs font-bold text-on-surface">
            {row.locationName}
          </p>
          <MoneyValue
            amount={value}
            variant="compactWithFull"
            size="sm"
            className="shrink-0"
          />
        </div>
        <p className="mt-0.5 truncate text-[9px] text-on-surface-variant">
          Cur {formatMaterialQuantity(row.currentStock)} · Res{" "}
          {formatMaterialQuantity(row.reservedStock)} · Min{" "}
          {formatMaterialQuantity(row.minimumStock)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[12px] font-extrabold text-on-surface">
          {formatMaterialQuantity(row.availableStock)}
        </p>
        <p className="mt-0.5 text-[8px] font-bold text-on-surface-variant">
          avail
        </p>
      </div>
    </div>
  );
}

function ShortageRow({
  area,
  totalQuantity,
  availableStock,
  needToBuy,
  estimatedTotalCost,
}: {
  readonly area: string;
  readonly totalQuantity: number;
  readonly availableStock: number;
  readonly needToBuy: number;
  readonly estimatedTotalCost: number;
}): React.JSX.Element {
  return (
    <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-on-surface">{area}</p>
        <p className="mt-0.5 truncate text-[9px] text-on-surface-variant">
          Required {formatMaterialQuantity(totalQuantity)} · Ready{" "}
          {formatMaterialQuantity(availableStock)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[12px] font-extrabold text-warning">
          −{formatMaterialQuantity(needToBuy)}
        </p>
        <MoneyValue
          amount={estimatedTotalCost}
          variant="compactWithFull"
          align="right"
          size="sm"
          className="mt-0.5"
        />
      </div>
    </div>
  );
}
