"use client";

import React from "react";
import { ArrowDownToLine, ArrowLeftRight, ClipboardCheck } from "lucide-react";

import type {
  MaterialMovementView,
  MaterialOperationsDashboard,
  ReceiptView,
} from "@/app/actions/material/operations-dashboard";
import { Badge, FilterPills, FilterSelect } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import {
  MovementRow,
  Section,
} from "@/features/materials/components/material-operation-sheets";
import {
  formatMaterialDate,
  formatMovementType,
  materialBadgeTone,
} from "@/features/materials/lib/material-ui-utils";

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
  return (
    <div className="space-y-md">
      <div className="space-y-3 rounded-[28px] border border-outline-variant/20 bg-white p-sm shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
        <div className="px-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
            Audit trail
          </p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Filter penerimaan, movement, transfer, dan stock count.
          </p>
        </div>
        <div className="overflow-x-auto">
          <FilterPills
            label="Tipe movement"
            value={activityType}
            onChange={onActivityTypeChange}
            options={[
              { value: "ALL", label: "Semua tipe" },
              ...movementTypes.map((value) => ({
                value,
                label: formatMovementType(value),
              })),
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <FilterPills
            label="Periode"
            value={activityPeriod}
            onChange={onActivityPeriodChange}
            options={[
              { value: "ALL", label: "Semua tanggal" },
              { value: "7", label: "7 hari" },
              { value: "30", label: "30 hari" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            label="Filter project"
            value={activityProject}
            options={activityProjectOptions}
            onChange={onActivityProjectChange}
          />
          <FilterSelect
            label="Filter lokasi"
            value={activityLocation}
            options={activityLocationOptions}
            onChange={onActivityLocationChange}
          />
        </div>
      </div>

      <Section title="Goods Receipts">
        {visibleReceipts.length === 0 ? (
          <InlineEmpty
            title="Tidak ada receipt"
            description="Ubah filter untuk melihat penerimaan material."
          />
        ) : (
          visibleReceipts.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onOpenReceipt(row)}
              className="flex min-h-[76px] w-full items-center gap-3 rounded-[24px] bg-white p-3 text-left shadow-[0_8px_20px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/10 transition hover:bg-surface-container-low active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-light text-success">
                <ArrowDownToLine className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">
                  {row.receiptNumber}
                </span>
                <span className="block truncate text-[10px] text-on-surface-variant">
                  {row.projectName} · {row.locationName}
                </span>
                <span className="mt-0.5 block truncate text-[9px] text-on-surface-variant/70">
                  {formatMaterialDate(row.receivedAt)} · {row.receivedByName}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <Badge status={materialBadgeTone(row.status)}>{row.status}</Badge>
                <MoneyValue
                  amount={row.total}
                  variant="compactWithFull"
                  align="right"
                  size="sm"
                  className="mt-1"
                />
              </span>
            </button>
          ))
        )}
      </Section>

      <Section
        title="Stock Movements"
        contentClassName="divide-y divide-outline-variant/35"
      >
        {visibleMovements.length === 0 ? (
          <InlineEmpty
            title="Tidak ada movement"
            description="Ubah filter untuk melihat histori pergerakan stock."
          />
        ) : (
          visibleMovements.map((row) => <MovementRow key={row.id} row={row} />)
        )}
        {movementsLength >= 30 && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={pending}
            className="min-h-12 w-full rounded-full bg-white text-xs font-bold text-primary ring-1 ring-outline-variant/15 transition active:scale-[0.97] disabled:opacity-50"
          >
            Load more
          </button>
        )}
      </Section>

      <Section title="Transfers & Counts">
        {transfers.map((row) => (
          <TransferRow key={row.id} row={row} />
        ))}
        {counts.map((row) => (
          <CountRow key={row.id} row={row} />
        ))}
        {transfers.length === 0 && counts.length === 0 && (
          <p className="rounded-2xl bg-white p-4 text-xs leading-5 text-on-surface-variant ring-1 ring-outline-variant/10">
            Belum ada transfer atau stock opname.
          </p>
        )}
      </Section>
    </div>
  );
}

function InlineEmpty({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-white p-4 text-xs leading-5 text-on-surface-variant ring-1 ring-outline-variant/10">
      <p className="font-bold text-on-surface">{title}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}

function TransferRow({
  row,
}: {
  readonly row: MaterialOperationsDashboard["transfers"][number];
}): React.JSX.Element {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-[24px] bg-white p-3 text-xs shadow-[0_8px_20px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/10">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
        <ArrowLeftRight className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{row.transferNumber}</p>
        <p className="mt-1 truncate text-[10px] text-on-surface-variant">
          {row.fromLocationName} → {row.toLocationName} · {row.items.length} items
        </p>
      </div>
    </div>
  );
}

function CountRow({
  row,
}: {
  readonly row: MaterialOperationsDashboard["counts"][number];
}): React.JSX.Element {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-[24px] bg-white p-3 text-xs shadow-[0_8px_20px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/10">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-light text-warning">
        <ClipboardCheck className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate font-bold">{row.countNumber}</p>
          <Badge status={materialBadgeTone(row.status)}>{row.status}</Badge>
        </div>
        <p className="mt-1 truncate text-[10px] text-on-surface-variant">
          {row.locationName} · {row.items.length} material · {formatMaterialDate(row.countedAt)}
        </p>
      </div>
    </div>
  );
}
