import React from "react";
import type { InventoryOpeningBatchView } from "@/app/actions/material/opening-inventory";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { FormRiskNotice } from "@/components/ui/form/form-controls";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";

export function OpeningDetailSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-[12px] font-bold tracking-wide text-on-surface-variant uppercase">
        {title}
      </h3>
      <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-ring-subtle">
        {children}
      </div>
    </section>
  );
}

export function OpeningDetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-12 items-start justify-between gap-4 py-3.5 text-xs">
      <span className="shrink-0 font-medium text-on-surface-variant">{label}</span>
      <span className="min-w-0 text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}

export function OpeningBatchItemRow({
  item,
}: {
  readonly item: InventoryOpeningBatchView["items"][number];
}): React.JSX.Element {
  return (
    <div className="flex min-h-18 items-center justify-between gap-3 py-3">
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="truncate text-[13px] leading-4 font-bold text-on-surface">
          {item.materialName}
        </p>
        <p className="truncate text-[10px] leading-[1.3] text-on-surface-variant">
          {item.locationName} · {formatOpeningQuantity(item.quantity)} {item.unit}
        </p>
      </div>
      <div className="max-w-[46%] shrink-0 text-right">
        <MoneyValue amount={item.totalValue} variant="compactWithFull" align="right" size="sm" />
        <p className="mt-1 truncate text-[9px] text-on-surface-variant tabular-nums">
          @ Rp {item.unitCost.toLocaleString("id-ID")}/{item.unit}
        </p>
      </div>
    </div>
  );
}

export function OpeningBatchStateNotice({
  batch,
  reversalAvailable,
}: {
  readonly batch: InventoryOpeningBatchView;
  readonly reversalAvailable: boolean;
}): React.JSX.Element {
  if (batch.status === "PENDING_APPROVAL") {
    return (
      <FormRiskNotice title="Menunggu persetujuan" tone="warning">
        Stok belum berubah. Buka Approval Center menggunakan Finance Admin atau Owner lain untuk
        meninjau batch ini.
      </FormRiskNotice>
    );
  }
  if (batch.status === "REJECTED") {
    return (
      <FormRiskNotice title="Pengajuan ditolak" tone="warning">
        {batch.rejectedReason ||
          "Batch ditolak tanpa alasan tambahan. Tidak ada stok yang berubah."}
      </FormRiskNotice>
    );
  }
  if (batch.status === "REVERSED") {
    return (
      <FormRiskNotice title="Saldo awal sudah dibalik">
        {batch.reversalReason ||
          "Nilai pembukaan telah dikembalikan ke nol dan tercatat pada audit log."}
      </FormRiskNotice>
    );
  }
  if (batch.status === "POSTED") {
    return (
      <FormRiskNotice title={reversalAvailable ? "Sudah masuk inventory" : "Sudah diposting"}>
        {reversalAvailable
          ? "Stok dan average cost sudah diperbarui. Pembalikan tetap ditolak jika ada movement lanjutan."
          : "Stok dan average cost sudah diperbarui. Pembalikan hanya tersedia untuk Owner dan tetap diperiksa ulang oleh server."}
      </FormRiskNotice>
    );
  }
  return (
    <FormRiskNotice title="Status batch">
      Status operasional batch ini adalah {formatBusinessLabel(batch.status)}.
    </FormRiskNotice>
  );
}

function formatOpeningQuantity(value: number): string {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}
