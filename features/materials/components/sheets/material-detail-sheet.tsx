"use client";

import React from "react";

import type { MaterialMovementView } from "@/app/actions/material/operations-dashboard";
import type { MaterialInventoryRow } from "@/app/actions/material/inventory";
import { BottomSheet, MoneyValue, SheetSection, useSheetPresenceValue } from "@/components/ui";
import {
  MaterialStatusLabel,
  type MaterialTone,
} from "@/features/materials/components/shared/material-page-primitives";
import { MovementRow } from "@/features/materials/components/shared/material-operation-primitives";
import {
  formatMaterialQuantity,
  getGroupedMaterialStockSummary,
  type GroupedMaterial,
  type GroupedMaterialStockSummary,
} from "@/features/materials/utils/material-ui-utils";

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
  const selectedMaterial = grouped.find((row) => row.id === openId);
  const {
    presentedValue: material,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(selectedMaterial, openId);
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
      open={open}
      title={material?.name ?? "Detail material"}
      onClose={onClose}
      onExitComplete={handleExitComplete}
    >
      {material && summary ? (
        <div className="space-y-4 pb-2">
          <div className="flex items-start justify-between gap-3 px-1">
            <p className="min-w-0 flex-1 text-[11px] leading-[1.3] text-on-surface-variant">
              {metadata.join(" · ") || "Informasi material belum lengkap"}
            </p>
            <DetailStatus summary={summary} />
          </div>

          <section
            className="rounded-3xl bg-primary px-4 py-4 text-white shadow-raised"
            aria-label="Posisi stok material"
          >
            <p className="text-eyebrow font-bold tracking-[0.15em] text-white/55 uppercase">
              Stok tersedia
            </p>
            <p className="mt-1 font-mono text-[26px] leading-7 font-black tabular-nums">
              {formatMaterialQuantity(summary.availableStock)}
            </p>
            <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-3">
              <SheetMetric label="Fisik" value={formatMaterialQuantity(summary.currentStock)} />
              <SheetMetric
                label="Terreservasi"
                value={formatMaterialQuantity(summary.reservedStock)}
                align="center"
              />
              <SheetMetric
                label="Minimum"
                value={formatMaterialQuantity(summary.minimumStock)}
                align="right"
              />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 rounded-[18px] bg-white/7.5 px-3 py-2.5 ring-1 ring-white/6">
              <span className="text-eyebrow font-semibold text-white/58">Nilai stok saat ini</span>
              <MoneyValue
                amount={summary.stockValue}
                variant="compact"
                tone="inverse"
                align="right"
                size="sm"
              />
            </div>
          </section>

          <SheetSection title="Posisi per lokasi">
            <div className="divide-y divide-black/5.5 px-3">
              {material.rows.map((row) => (
                <MaterialLocationStockRow key={row.inventoryId} row={row} />
              ))}
            </div>
          </SheetSection>

          {material.shortages.some((row) => row.needToBuy > 0) ? (
            <SheetSection title="Kebutuhan project">
              <div className="divide-y divide-black/5.5 px-3">
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
              </div>
            </SheetSection>
          ) : null}

          <SheetSection title="Aktivitas terbaru">
            {materialMovements.length === 0 ? (
              <p className="px-3.5 py-4 text-[11px] leading-[1.3] text-on-surface-variant">
                Belum ada pergerakan stok untuk material ini.
              </p>
            ) : (
              <div className="divide-y divide-black/5.5 px-3">
                {materialMovements.slice(0, 8).map((row) => (
                  <MovementRow key={row.id} row={row} />
                ))}
              </div>
            )}
          </SheetSection>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function SheetMetric({
  label,
  value,
  align = "left",
}: {
  readonly label: string;
  readonly value: string;
  readonly align?: "left" | "center" | "right";
}): React.JSX.Element {
  const className =
    align === "right" ? "text-right pl-2" : align === "center" ? "text-center px-2" : "pr-2";
  return (
    <div className={className}>
      <p className="truncate text-[8px] font-bold tracking-wide text-white/48 uppercase">{label}</p>
      <p className="mt-1 truncate font-mono text-[12px] leading-4 font-black tabular-nums">
        {value}
      </p>
    </div>
  );
}

function DetailStatus({
  summary,
}: {
  readonly summary: GroupedMaterialStockSummary;
}): React.JSX.Element {
  const presentation: { readonly label: string; readonly tone: MaterialTone } =
    summary.status === "OUT_OF_STOCK"
      ? { label: "Habis", tone: "critical" }
      : summary.status === "LOW_STOCK"
        ? { label: "Menipis", tone: "warning" }
        : summary.status === "RESERVED"
          ? { label: "Terikat", tone: "pending" }
          : { label: "Tersedia", tone: "positive" };
  return <MaterialStatusLabel label={presentation.label} tone={presentation.tone} />;
}

export function MaterialLocationStockRow({
  row,
}: {
  readonly row: MaterialInventoryRow;
}): React.JSX.Element {
  const value = row.currentStock * row.averageCost;
  return (
    <div className="py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-row font-bold text-on-surface">{row.locationName}</p>
          <p className="mt-1 truncate text-[10px] leading-[1.3] text-on-surface-variant">
            Fisik {formatMaterialQuantity(row.currentStock)} · terreservasi{" "}
            {formatMaterialQuantity(row.reservedStock)} · minimum{" "}
            {formatMaterialQuantity(row.minimumStock)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[8px] font-bold tracking-wide text-on-surface-variant/65 uppercase">
            Tersedia
          </p>
          <p className="mt-1 font-mono text-row font-black text-on-surface tabular-nums">
            {formatMaterialQuantity(row.availableStock)} {row.unit}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 divide-x divide-black/5.5 border-t border-black/5.5 pt-3">
        <div className="min-w-0 pr-3">
          <p className="min-h-6 text-[8px] leading-3 font-bold tracking-wide text-on-surface-variant/65 uppercase">
            Harga pokok rata-rata / {row.unit}
          </p>
          <MoneyValue
            amount={row.averageCost}
            variant="compact"
            size="xs"
            className="mt-1"
          />
        </div>
        <div className="min-w-0 pl-3 text-right">
          <p className="min-h-6 text-[8px] leading-3 font-bold tracking-wide text-on-surface-variant/65 uppercase">
            Nilai stok lokasi
          </p>
          <MoneyValue
            amount={value}
            variant="compact"
            align="right"
            size="xs"
            className="mt-1"
          />
        </div>
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
    <div className="flex min-h-17 items-center justify-between gap-3 py-3">
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="truncate text-row font-bold text-on-surface">{area}</p>
        <p className="truncate text-[10px] leading-[1.3] text-on-surface-variant">
          Tersedia {formatMaterialQuantity(availableStock)} dari kebutuhan{" "}
          {formatMaterialQuantity(totalQuantity)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[12px] leading-4 font-black text-warning tabular-nums">
          Kurang {formatMaterialQuantity(needToBuy)}
        </p>
        <MoneyValue
          amount={estimatedTotalCost}
          variant="compact"
          align="right"
          size="xs"
          className="mt-1"
        />
      </div>
    </div>
  );
}
