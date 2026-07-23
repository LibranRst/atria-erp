"use client";

import { ArrowDownToLine, ArrowLeftRight, ClipboardCheck } from "lucide-react";
import React from "react";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";

import type {
  MaterialMovementView,
  MaterialOperationsDashboard,
  ReceiptView,
} from "@/app/actions/material/operations-dashboard";
import { Badge, FilterSelect } from "@/components/ui";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { SegmentedTabs } from "@/components/ui/navigation/segmented-tabs";
import {
  MaterialGroupSurface,
  MaterialInlineState,
  MaterialSection,
} from "@/features/materials/components/shared/material-page-primitives";
import { MovementRow } from "@/features/materials/components/sheets/material-operation-sheets";
import { AppIcon } from "@/components/ui/icon/app-icon";
import {
  formatMaterialDate,
  formatMaterialStatus,
  formatMovementType,
  materialBadgeTone,
} from "@/features/materials/utils/material-ui-utils";

type ActivityTabProps = {
  readonly activityType: string;
  readonly activityPeriod: string;
  readonly activityProject: string;
  readonly activityLocation: string;
  readonly movementTypes: readonly string[];
  readonly activityProjectOptions: readonly { readonly value: string; readonly label: string }[];
  readonly activityLocationOptions: readonly { readonly value: string; readonly label: string }[];
  readonly visibleReceipts: readonly ReceiptView[];
  readonly visibleMovements: readonly MaterialMovementView[];
  readonly movementsLength: number;
  readonly transfers: MaterialOperationsDashboard["transfers"];
  readonly counts: MaterialOperationsDashboard["counts"];
  readonly pending: boolean;
  readonly onActivityTypeChange: (value: string) => void;
  readonly onActivityPeriodChange: (value: string) => void;
  readonly onActivityProjectChange: (value: string) => void;
  readonly onActivityLocationChange: (value: string) => void;
  readonly onOpenReceipt: (receipt: ReceiptView) => void;
  readonly onLoadMore: () => void;
};

export function MaterialActivityTab({
  activityType,
  activityPeriod,
  activityProject,
  activityLocation,
  movementTypes,
  activityProjectOptions,
  activityLocationOptions,
  visibleReceipts,
  visibleMovements,
  movementsLength,
  transfers,
  counts,
  pending,
  onActivityTypeChange,
  onActivityPeriodChange,
  onActivityProjectChange,
  onActivityLocationChange,
  onOpenReceipt,
  onLoadMore,
}: ActivityTabProps): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <section
        className="space-y-2.5"
        aria-label="Filter aktivitas material"
        data-material-controls="inline"
      >
        <SegmentedTabs
          value={activityType}
          onChange={onActivityTypeChange}
          ariaLabel="Filter tipe aktivitas material"
          layoutId="material-activity-type"
          density="compact"
          scrollable
          fillAvailableSpace={movementTypes.length + 1 <= 3}
          options={[
            { value: "ALL", label: "Semua" },
            ...movementTypes.map((value) => ({ value, label: formatMovementType(value) })),
          ]}
        />
        <div>
          <SegmentedTabs
            value={activityPeriod}
            onChange={onActivityPeriodChange}
            ariaLabel="Filter periode aktivitas material"
            layoutId="material-activity-period"
            density="compact"
            fillAvailableSpace
            options={[
              { value: "ALL", label: "Semua waktu" },
              { value: "7", label: "7 hari" },
              { value: "30", label: "30 hari" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            label="Project"
            value={activityProject}
            options={activityProjectOptions}
            onChange={onActivityProjectChange}
          />
          <FilterSelect
            label="Lokasi"
            value={activityLocation}
            options={activityLocationOptions}
            onChange={onActivityLocationChange}
          />
        </div>
      </section>

      <MaterialSection title="Penerimaan barang" meta={`${visibleReceipts.length} dokumen`}>
        <MaterialGroupSurface>
          {visibleReceipts.length === 0 ? (
            <MaterialInlineState
              icon="inbox"
              title="Tidak ada penerimaan"
              description="Ubah filter untuk melihat dokumen penerimaan lainnya."
            />
          ) : (
            <div className="divide-y divide-black/5.5">
              {visibleReceipts.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onOpenReceipt(row)}
                  className="flex min-h-19 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-success/8 text-success ring-1 ring-success/6">
                    <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate text-[13px] leading-4 font-bold text-on-surface">
                      {row.receiptNumber}
                    </span>
                    <span className="truncate text-[10px] leading-[1.3] text-on-surface-variant">
                      {row.projectName} · {row.locationName}
                    </span>
                    <span className="truncate text-[9px] leading-3 text-on-surface-variant/65">
                      {formatMaterialDate(row.receivedAt)} · {row.receivedByName}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Badge status={materialBadgeTone(row.status)}>
                      {formatMaterialStatus(row.status)}
                    </Badge>
                    <MoneyValue
                      amount={row.total}
                      variant="compactWithFull"
                      align="right"
                      size="xs"
                      className="mt-1"
                    />
                  </span>
                  <AppIcon name="chevron_right" className="shrink-0 text-[17px] text-accent" />
                </button>
              ))}
            </div>
          )}
        </MaterialGroupSurface>
      </MaterialSection>

      <MaterialSection title="Pergerakan stok" meta={`${visibleMovements.length} aktivitas`}>
        <MaterialGroupSurface>
          {visibleMovements.length === 0 ? (
            <MaterialInlineState
              icon="history"
              title="Tidak ada pergerakan stok"
              description="Ubah filter untuk melihat histori aktivitas lainnya."
            />
          ) : (
            <div className="divide-y divide-black/5.5 px-3">
              {visibleMovements.map((row) => (
                <MovementRow key={row.id} row={row} />
              ))}
            </div>
          )}
          {movementsLength >= 30 ? (
            <div className="border-t border-black/5.5 p-3">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={pending}
                className="min-h-12 w-full rounded-full bg-accent/8 px-5 text-[11px] font-bold text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:bg-accent/[0.14] disabled:opacity-45"
              >
                {pending ? "Memuat…" : "Muat aktivitas sebelumnya"}
              </button>
            </div>
          ) : null}
        </MaterialGroupSurface>
      </MaterialSection>

      <MaterialSection
        title="Transfer dan stock opname"
        meta={`${transfers.length + counts.length} dokumen`}
      >
        <MaterialGroupSurface>
          {transfers.length === 0 && counts.length === 0 ? (
            <MaterialInlineState
              icon="inventory"
              title="Belum ada dokumen"
              description="Transfer dan stock opname akan tersimpan di bagian ini."
            />
          ) : (
            <div className="divide-y divide-black/5.5">
              {transfers.map((row) => (
                <TransferRow
                  key={row.id}
                  row={row}
                  onOpen={() => openActivityDetail({ kind: "STOCK_TRANSFER", id: row.id })}
                />
              ))}
              {counts.map((row) => (
                <CountRow
                  key={row.id}
                  row={row}
                  onOpen={() => openActivityDetail({ kind: "STOCK_COUNT", id: row.id })}
                />
              ))}
            </div>
          )}
        </MaterialGroupSurface>
      </MaterialSection>
    </div>
  );
}

function TransferRow({
  row,
  onOpen,
}: {
  readonly row: MaterialOperationsDashboard["transfers"][number];
  readonly onOpen: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-17 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
      aria-label={`Lihat detail transfer ${row.transferNumber}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-primary/8 text-primary ring-1 ring-primary/6">
        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="truncate text-[13px] leading-4 font-bold text-on-surface">
          {row.transferNumber}
        </p>
        <p className="truncate text-[10px] leading-[1.3] text-on-surface-variant">
          {row.fromLocationName} → {row.toLocationName} · {row.items.length} material
        </p>
      </div>
      <ActivityDetailChevron />
    </button>
  );
}

function CountRow({
  row,
  onOpen,
}: {
  readonly row: MaterialOperationsDashboard["counts"][number];
  readonly onOpen: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-17 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
      aria-label={`Lihat detail opname ${row.countNumber}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-warning/9 text-warning ring-1 ring-warning/6">
        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate text-[13px] leading-4 font-bold text-on-surface">
            {row.countNumber}
          </p>
          <Badge status={materialBadgeTone(row.status)}>{formatMaterialStatus(row.status)}</Badge>
        </div>
        <p className="truncate text-[10px] leading-[1.3] text-on-surface-variant">
          {row.locationName} · {row.items.length} material · {formatMaterialDate(row.countedAt)}
        </p>
      </div>
      <ActivityDetailChevron />
    </button>
  );
}
