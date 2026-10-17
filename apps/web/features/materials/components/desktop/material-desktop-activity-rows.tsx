import type {
  MaterialDesktopActivityData,
  MaterialDesktopMovementRow,
  MaterialDesktopReceiptRow,
  MaterialDesktopTransferRow,
  MaterialDesktopCountRow,
} from "@atria/core/material/material-desktop";
import { MoneyValue, StatusBadge, type DesktopTableColumn } from "@/components/ui";
import {
  formatMaterialQuantity,
  formatMaterialStatus,
  formatMovementType,
} from "../../utils/material-ui-utils";
import type { MaterialDesktopActivityKind } from "../../hooks/use-material-desktop-activity";

export type MaterialActivitySelection =
  | { readonly kind: "movements"; readonly item: MaterialDesktopMovementRow }
  | { readonly kind: "receipts"; readonly item: MaterialDesktopReceiptRow }
  | { readonly kind: "transfers"; readonly item: MaterialDesktopTransferRow }
  | { readonly kind: "counts"; readonly item: MaterialDesktopCountRow };

export function materialActivityRows(
  data: MaterialDesktopActivityData | null,
): readonly MaterialActivitySelection[] {
  if (data?.kind === "movements") return data.rows.map((item) => ({ kind: "movements", item }));
  if (data?.kind === "receipts") return data.rows.map((item) => ({ kind: "receipts", item }));
  if (data?.kind === "transfers") return data.rows.map((item) => ({ kind: "transfers", item }));
  if (data?.kind === "counts") return data.rows.map((item) => ({ kind: "counts", item }));
  return [];
}

export function materialActivityTitle(row: MaterialActivitySelection): string {
  return row.kind === "movements"
    ? row.item.materialName
    : row.kind === "receipts"
      ? row.item.receiptNumber
      : row.kind === "transfers"
        ? row.item.transferNumber
        : row.item.countNumber;
}

export function materialActivityDate(row: MaterialActivitySelection): Date {
  return row.kind === "movements"
    ? row.item.createdAt
    : row.kind === "receipts"
      ? row.item.receivedAt
      : row.kind === "transfers"
        ? row.item.transferredAt
        : row.item.countedAt;
}

export function materialActivityDateCopy(date: Date, time = false): string {
  return new Date(date).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function materialMovementDirectionCopy(direction: string): string {
  return direction === "IN"
    ? "Stok masuk"
    : direction === "OUT"
      ? "Stok keluar"
      : direction === "NEUTRAL"
        ? "Tanpa perpindahan fisik"
        : "Arah belum tersedia";
}

export function MaterialActivityStatus({
  status,
  compact = false,
}: {
  readonly status: string;
  readonly compact?: boolean;
}): React.JSX.Element {
  const fullLabel = formatMaterialStatus(status);
  return (
    <StatusBadge
      label={compact && status === "REVERSAL_REQUESTED" ? "Pembatalan" : fullLabel}
      aria-label={fullLabel}
      title={fullLabel}
      tone={
        status === "PENDING_APPROVAL" || status === "REVERSAL_REQUESTED"
          ? "warning"
          : status === "REJECTED" || status === "REVERSED"
            ? "critical"
            : "neutral"
      }
    />
  );
}

const dateColumn: DesktopTableColumn<MaterialActivitySelection> = {
  key: "date",
  label: "Tanggal",
  sortable: true,
  render: (row) => (
    <span className="text-support tabular-nums">
      {materialActivityDateCopy(materialActivityDate(row))}
    </span>
  ),
};
const statusColumn: DesktopTableColumn<MaterialActivitySelection> = {
  key: "status",
  label: "Status",
  sortable: true,
  render: (row) =>
    row.kind === "receipts" || row.kind === "counts" ? (
      <MaterialActivityStatus status={row.item.status} compact />
    ) : null,
};

/** The collection chooses columns; quantities from incompatible units are never added. */
export function materialActivityColumns(
  kind: MaterialDesktopActivityKind,
): readonly DesktopTableColumn<MaterialActivitySelection>[] {
  const name: DesktopTableColumn<MaterialActivitySelection> = {
    key: "name",
    label: kind === "movements" ? "Material" : "Dokumen",
    widthPercent: 28,
    sortable: true,
    render: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 font-semibold wrap-anywhere">{materialActivityTitle(row)}</p>
        {row.kind === "movements" && row.item.projectName ? (
          <p className="truncate text-support text-on-surface-variant" title={row.item.projectName}>
            {row.item.projectName}
          </p>
        ) : row.kind === "receipts" && row.item.vendorBillNumber ? (
          <p
            className="truncate text-support text-on-surface-variant"
            title={row.item.vendorBillNumber}
          >
            {row.item.vendorBillNumber}
          </p>
        ) : null}
      </div>
    ),
  };
  if (kind === "movements")
    return [
      { ...name, widthPercent: 29 },
      {
        key: "movement",
        label: "Gerakan",
        widthPercent: 19,
        render: (row) =>
          row.kind === "movements" ? (
            <div className="space-y-1">
              <span className="text-support">{formatMovementType(row.item.movementType)}</span>
              <p className="text-meta text-on-surface-variant">
                {materialMovementDirectionCopy(row.item.movementDirection)}
              </p>
            </div>
          ) : null,
      },
      {
        key: "quantity",
        label: "Jumlah",
        align: "end",
        widthPercent: 15,
        sortable: true,
        render: (row) =>
          row.kind === "movements" ? (
            <span className="text-support tabular-nums">
              {formatMaterialQuantity(row.item.quantity)} {row.item.unit}
            </span>
          ) : null,
      },
      {
        key: "location",
        label: "Lokasi",
        widthPercent: 20,
        render: (row) =>
          row.kind === "movements" ? (
            <span className="block truncate text-support" title={row.item.locationName}>
              {row.item.locationName}
            </span>
          ) : null,
      },
      { ...dateColumn, widthPercent: 17 },
    ];
  if (kind === "receipts")
    return [
      name,
      {
        key: "project",
        label: "Proyek",
        widthPercent: 20,
        render: (row) =>
          row.kind === "receipts" ? (
            <span className="line-clamp-2 text-support" title={row.item.projectName}>
              {row.item.projectName}
            </span>
          ) : null,
      },
      { ...dateColumn, widthPercent: 16 },
      {
        key: "value",
        label: "Nilai",
        widthPercent: 17,
        align: "end",
        sortable: true,
        render: (row) =>
          row.kind === "receipts" ? (
            <MoneyValue
              amount={row.item.total}
              fractionDigits={Number.isInteger(row.item.total) ? 0 : 2}
              variant="compact"
              size="sm"
            />
          ) : null,
      },
      { ...statusColumn, widthPercent: 19 },
    ];
  if (kind === "transfers")
    return [
      name,
      {
        key: "from",
        label: "Dari",
        widthPercent: 23,
        render: (row) =>
          row.kind === "transfers" ? (
            <span className="line-clamp-2 text-support">{row.item.fromLocationName}</span>
          ) : null,
      },
      {
        key: "to",
        label: "Ke",
        widthPercent: 23,
        render: (row) =>
          row.kind === "transfers" ? (
            <span className="line-clamp-2 text-support">{row.item.toLocationName}</span>
          ) : null,
      },
      { ...dateColumn, widthPercent: 16 },
      {
        key: "quantity",
        label: "Item",
        align: "end",
        widthPercent: 10,
        sortable: true,
        render: (row) =>
          row.kind === "transfers" ? (
            <span className="tabular-nums">{row.item.items.length}</span>
          ) : null,
      },
    ];
  return [
    name,
    {
      key: "location",
      label: "Lokasi",
      widthPercent: 23,
      render: (row) =>
        row.kind === "counts" ? (
          <span className="line-clamp-2 text-support">{row.item.locationName}</span>
        ) : null,
    },
    { ...dateColumn, widthPercent: 18 },
    {
      key: "quantity",
      label: "Item",
      align: "end",
      widthPercent: 10,
      sortable: true,
      render: (row) =>
        row.kind === "counts" ? (
          <span className="tabular-nums">{row.item.items.length}</span>
        ) : null,
    },
    { ...statusColumn, widthPercent: 21 },
  ];
}
