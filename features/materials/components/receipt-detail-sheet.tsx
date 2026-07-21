"use client";

import React from "react";

import type { ReceiptView } from "@/app/actions/material/operations-dashboard";
import { Badge, BottomSheet, useSheetPresenceValue } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import {
  formatMaterialQuantity,
  formatMaterialStatus,
  materialBadgeTone,
} from "@/features/materials/lib/material-ui-utils";

type ReceiptDetailSheetProps = {
  readonly receipt: ReceiptView | null;
  readonly canRequestReversal: boolean;
  readonly onClose: () => void;
  readonly onRequestReversal: (receiptId: string) => void;
};

export function ReceiptDetailSheet({
  receipt,
  canRequestReversal,
  onClose,
  onRequestReversal,
}: ReceiptDetailSheetProps): React.JSX.Element {
  const {
    presentedValue: presentedReceipt,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(receipt, receipt?.id);

  return (
    <BottomSheet
      open={open}
      title={presentedReceipt?.receiptNumber ?? "Detail Penerimaan"}
      onClose={onClose}
      onExitComplete={handleExitComplete}
    >
      {presentedReceipt && (
        <div className="space-y-4 pb-2">
          <div className="flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-on-surface text-base font-bold">
                {presentedReceipt.receiptNumber}
              </p>
              <p className="text-on-surface-variant mt-0.5 text-xs">Dokumen Penerimaan Barang</p>
            </div>
            <Badge status={materialBadgeTone(presentedReceipt.status)}>
              {formatMaterialStatus(presentedReceipt.status)}
            </Badge>
          </div>

          <SheetSection title="Rincian Dokumen">
            <div className="divide-outline-variant/15 divide-y px-3">
              <DetailRow label="Proyek Penerima" value={presentedReceipt.projectName} />
              <DetailRow
                label="Total Nilai Material"
                value={
                  <MoneyValue
                    amount={presentedReceipt.total}
                    variant="compactWithFull"
                    size="sm"
                    align="right"
                    tone="default"
                  />
                }
              />
            </div>
          </SheetSection>

          {presentedReceipt.items.length > 0 && (
            <SheetSection title="Item Material Diterima">
              <div className="divide-outline-variant/15 divide-y px-3">
                {presentedReceipt.items.map((item) => (
                  <div
                    key={`${item.materialName}-${item.quantity}`}
                    className="flex min-h-[64px] items-center justify-between gap-3 py-3"
                  >
                    <div className="grid min-w-0 flex-1 gap-1">
                      <p className="text-on-surface truncate text-[13px] leading-4 font-bold">
                        {item.materialName}
                      </p>
                      <p className="text-on-surface-variant truncate text-[10px] leading-[1.3]">
                        Jumlah: {formatMaterialQuantity(item.quantity)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <MoneyValue
                        amount={item.quantity * item.unitCost}
                        variant="compactWithFull"
                        align="right"
                        size="sm"
                        className="text-on-surface font-bold"
                      />
                      <p className="text-on-surface-variant mt-1 text-[10px]">
                        @ Rp {Number(item.unitCost).toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SheetSection>
          )}

          {canRequestReversal && presentedReceipt.status === "POSTED" && (
            <button
              type="button"
              onClick={() => onRequestReversal(presentedReceipt.id)}
              className="bg-error-container/20 text-error active:bg-error-container/30 min-h-12 w-full rounded-full text-xs font-bold transition-colors"
            >
              Minta Pembatalan Penerimaan
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function SheetSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="text-on-surface-variant px-1 text-[12px] font-bold tracking-wide uppercase">
        {title}
      </h3>
      <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-black/[0.035]">
        {children}
      </div>
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 text-xs">
      <span className="text-on-surface-variant shrink-0 font-medium">{label}</span>
      <span className="text-on-surface text-right font-bold">{value}</span>
    </div>
  );
}
