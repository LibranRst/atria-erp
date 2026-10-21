import type {
  CountView,
  MaterialOperationsDashboard,
  ReceiptView,
} from "@/app/actions/material/operations-dashboard";
import { useActivityDetail } from "@/features/activity-detail/components/activity-detail-provider";
import { AppIcon, Button, FactRow, GroupedSurface, MoneyValue } from "@/components/ui";
import type { MaterialOperationDecision } from "../../types/material-dashboard-types";
import { formatMaterialQuantity, formatMovementType } from "../../utils/material-ui-utils";
import {
  MaterialActivityStatus,
  materialActivityDate,
  materialActivityDateCopy,
  materialActivityTitle,
  materialMovementDirectionCopy,
  type MaterialActivitySelection,
} from "./material-desktop-activity-rows";

export type MaterialDesktopActivityDetailProps = {
  readonly selection: MaterialActivitySelection;
  readonly capabilities: MaterialOperationsDashboard["capabilities"];
  readonly pending: boolean;
  readonly onBack: () => void;
  readonly onOpenReceipt: (receipt: ReceiptView) => void;
  readonly onDecision: (decision: MaterialOperationDecision) => void;
  readonly onLoadCountDraft: (row: CountView) => void;
};

export function MaterialDesktopActivityDetail({
  selection: row,
  capabilities,
  pending,
  onBack,
  onOpenReceipt,
  onDecision,
  onLoadCountDraft,
}: MaterialDesktopActivityDetailProps): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  const openDetail = (): void => {
    if (row.kind === "receipts") onOpenReceipt(row.item);
    else
      openActivityDetail({
        kind:
          row.kind === "movements"
            ? "STOCK_MOVEMENT"
            : row.kind === "transfers"
              ? "STOCK_TRANSFER"
              : "STOCK_COUNT",
        id: row.item.id,
      });
  };
  const note = row.kind === "receipts" ? row.item.reversalReason : row.item.note;
  return (
    <section
      aria-label={`Rincian ${materialActivityTitle(row)}`}
      className="@container min-w-0 space-y-3 xl:sticky xl:top-24"
    >
      <div className="xl:hidden">
        <Button variant="secondary" size="mini" disabled={pending} onClick={onBack}>
          <AppIcon name="arrow_back" className="icon-sm" />
          Kembali ke daftar
        </Button>
      </div>
      <GroupedSurface variant="desktopPanel" className="min-w-0">
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-support text-on-surface-variant">
              {row.kind === "movements"
                ? formatMovementType(row.item.movementType)
                : row.kind === "receipts"
                  ? "Penerimaan barang"
                  : row.kind === "transfers"
                    ? "Transfer stok"
                    : "Stock opname"}
            </p>
            {row.kind === "receipts" || row.kind === "counts" ? (
              <MaterialActivityStatus status={row.item.status} />
            ) : null}
          </div>
          <h3 className="text-row font-bold wrap-anywhere text-on-surface">
            {materialActivityTitle(row)}
          </h3>
          {row.kind === "movements" ? (
            <p className="text-title font-semibold tabular-nums">
              {formatMaterialQuantity(row.item.quantity)}{" "}
              <span className="text-row font-normal">{row.item.unit}</span>
            </p>
          ) : row.kind === "receipts" ? (
            <MoneyValue
              amount={row.item.total}
              fractionDigits={Number.isInteger(row.item.total) ? 0 : 2}
              variant="fullDynamic"
              size="lg"
            />
          ) : (
            <p className="text-support text-on-surface-variant">
              {row.item.items.length} item material
            </p>
          )}
        </div>
        <div className="divide-y divide-outline-variant/30 border-t border-outline-variant/30">
          <FactRow
            label="Tanggal"
            wrapLabel
            value={materialActivityDateCopy(materialActivityDate(row), true)}
          />
          {row.kind === "movements" ? (
            <>
              <FactRow
                label="Dampak fisik"
                wrapLabel
                value={materialMovementDirectionCopy(row.item.movementDirection)}
              />
              <FactRow label="Proyek" wrapLabel value={row.item.projectName ?? "Stok perusahaan"} />
              <FactRow label="Lokasi" wrapLabel value={row.item.locationName} />
              <FactRow label="Dicatat oleh" wrapLabel value={row.item.createdByName} />
              <FactRow
                label="Biaya per unit"
                wrapLabel
                value={
                  <MoneyValue
                    amount={row.item.unitCost}
                    fractionDigits={Number.isInteger(row.item.unitCost) ? 0 : 2}
                    variant="fullDynamic"
                    size="sm"
                  />
                }
              />
            </>
          ) : row.kind === "receipts" ? (
            <>
              <FactRow label="Proyek" wrapLabel value={row.item.projectName} />
              <FactRow label="Lokasi" wrapLabel value={row.item.locationName} />
              <FactRow label="Diterima oleh" wrapLabel value={row.item.receivedByName} />
              <FactRow
                label="Tagihan"
                wrapLabel
                value={row.item.vendorBillNumber ?? "Tidak ditautkan"}
              />
            </>
          ) : row.kind === "transfers" ? (
            <>
              <FactRow label="Dari lokasi" wrapLabel value={row.item.fromLocationName} />
              <FactRow label="Ke lokasi" wrapLabel value={row.item.toLocationName} />
            </>
          ) : (
            <>
              <FactRow label="Lokasi" wrapLabel value={row.item.locationName} />
              <FactRow label="Dicatat oleh" wrapLabel value={row.item.createdByName} />
              <FactRow
                label="Item berselisih"
                value={row.item.items.filter((item) => item.varianceQuantity !== 0).length}
              />
            </>
          )}
        </div>
        {note ? (
          <div className="space-y-1 border-t border-outline-variant/30 px-4 py-3">
            <p className="text-support text-on-surface-variant">
              {row.kind === "receipts" ? "Alasan pembatalan" : "Catatan"}
            </p>
            <p className="text-support wrap-anywhere whitespace-pre-wrap">{note}</p>
          </div>
        ) : null}
        {row.kind !== "movements" ? (
          <div className="space-y-3 border-t border-outline-variant/30 px-4 py-3">
            <p className="text-support font-semibold">
              {row.kind === "counts" ? "Hasil pemeriksaan" : "Item material"}
            </p>
            {row.item.items.slice(0, 5).map((item, index) => (
              <div key={`${item.materialName}-${index}`} className="space-y-1">
                <p className="text-support wrap-anywhere">{item.materialName}</p>
                {"countedQuantity" in item ? (
                  <p className="text-support text-on-surface-variant tabular-nums">
                    Sistem {formatMaterialQuantity(item.systemQuantity)} · Fisik{" "}
                    {formatMaterialQuantity(item.countedQuantity)}
                    {item.unit ? ` ${item.unit}` : ""}
                    <br />
                    Selisih {item.varianceQuantity > 0 ? "+" : ""}
                    {formatMaterialQuantity(item.varianceQuantity)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </p>
                ) : (
                  <p className="text-support text-on-surface-variant tabular-nums">
                    {formatMaterialQuantity(item.quantity)}
                    {item.unit ? ` ${item.unit}` : " per item"}
                  </p>
                )}
              </div>
            ))}
            {row.item.items.length > 5 ? (
              <p className="text-meta text-on-surface-variant">
                5 dari {row.item.items.length} item. Buka rincian untuk melihat semuanya.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-2 border-t border-outline-variant/30 p-4 @lg:grid-cols-2 [&>*:last-child:nth-child(odd)]:col-span-full">
          {row.kind === "counts" && row.item.canEdit && capabilities.canCount ? (
            <Button size="compact" disabled={pending} onClick={() => onLoadCountDraft(row.item)}>
              Lanjutkan draft
            </Button>
          ) : null}
          {row.kind === "counts" &&
          row.item.status === "PENDING_APPROVAL" &&
          capabilities.canApproveCount ? (
            <>
              <Button
                size="compact"
                disabled={pending}
                onClick={() => onDecision({ type: "COUNT_APPROVE", id: row.item.id })}
              >
                Tinjau persetujuan
              </Button>
              <Button
                size="compact"
                variant="criticalQuiet"
                disabled={pending}
                onClick={() => onDecision({ type: "COUNT_REJECT", id: row.item.id })}
              >
                Tolak opname
              </Button>
            </>
          ) : null}
          {row.kind === "receipts" &&
          row.item.status === "POSTED" &&
          capabilities.canRequestReversal ? (
            <Button
              size="compact"
              variant="secondary"
              disabled={pending}
              onClick={() => onDecision({ type: "RECEIPT_REQUEST", id: row.item.id })}
            >
              Minta pembatalan
            </Button>
          ) : null}
          {row.kind === "receipts" &&
          row.item.status === "REVERSAL_REQUESTED" &&
          capabilities.canApproveReversal ? (
            <>
              <Button
                size="compact"
                disabled={pending}
                onClick={() => onDecision({ type: "RECEIPT_APPROVE", id: row.item.id })}
              >
                Tinjau pembatalan
              </Button>
              <Button
                size="compact"
                variant="criticalQuiet"
                disabled={pending}
                onClick={() => onDecision({ type: "RECEIPT_REJECT", id: row.item.id })}
              >
                Tolak pembatalan
              </Button>
            </>
          ) : null}
          <Button size="compact" variant="secondary" disabled={pending} onClick={openDetail}>
            Buka rincian
            {row.kind === "movements"
              ? " gerakan"
              : row.kind === "receipts"
                ? " penerimaan"
                : row.kind === "transfers"
                  ? " transfer"
                  : " opname"}
          </Button>
        </div>
      </GroupedSurface>
      <p className="px-1 text-support text-on-surface-variant">
        {row.kind === "receipts"
          ? "Penerimaan mencatat barang fisik. Pembayaran vendor dikelola terpisah."
          : row.kind === "counts"
            ? "Selisih mengubah stok setelah keputusan yang sah. Riwayat dan alasan tetap tercatat."
            : row.kind === "movements"
              ? "Riwayat gerakan menjelaskan perubahan stok. Reservasi dan pemakaian tidak mencatat pembayaran."
              : "Transfer memindahkan stok antarlokasi dan menyimpan riwayat kedua lokasi."}
      </p>
    </section>
  );
}
