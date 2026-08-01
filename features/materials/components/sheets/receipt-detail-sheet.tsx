"use client";

import React from "react";

import type { ReceiptView } from "@/app/actions/material/operations-dashboard";
import { Badge, BottomSheet, Button, useSheetPresenceValue } from "@/components/ui";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { FactRow, SheetSection } from "@/components/ui/feedback/main-surface";
import {
  formatMaterialQuantity,
  formatMaterialStatus,
  materialBadgeTone,
} from "@/features/materials/utils/material-ui-utils";

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
              <p className="text-base font-bold text-on-surface">
                {presentedReceipt.receiptNumber}
              </p>
              <p className="mt-0.5 text-xs text-on-surface-variant">Dokumen Penerimaan Barang</p>
            </div>
            <Badge status={materialBadgeTone(presentedReceipt.status)}>
              {formatMaterialStatus(presentedReceipt.status)}
            </Badge>
          </div>

          <SheetSection title="Rincian Dokumen">
            <div className="divide-y divide-outline-variant/15 px-3">
              <FactRow inset={false} label="Proyek Penerima" value={presentedReceipt.projectName} />
              <FactRow
                inset={false}
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
              <div className="divide-y divide-outline-variant/15 px-3">
                {presentedReceipt.items.map((item) => (
                  <div
                    key={`${item.materialName}-${item.quantity}`}
                    className="flex min-h-16 items-center justify-between gap-3 py-3"
                  >
                    <div className="grid min-w-0 flex-1 gap-1">
                      <p className="truncate text-[13px] leading-4 font-bold text-on-surface">
                        {item.materialName}
                      </p>
                      <p className="truncate text-[10px] leading-[1.3] text-on-surface-variant">
                        Jumlah: {formatMaterialQuantity(item.quantity)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <MoneyValue
                        amount={item.quantity * item.unitCost}
                        variant="compactWithFull"
                        align="right"
                        size="sm"
                        className="font-bold text-on-surface"
                      />
                      <p className="mt-1 text-[10px] text-on-surface-variant">
                        @ Rp {Number(item.unitCost).toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SheetSection>
          )}

          {canRequestReversal && presentedReceipt.status === "POSTED" && (
            <Button
              type="button"
              variant="criticalQuiet"
              fullWidth
              onClick={() => onRequestReversal(presentedReceipt.id)}
            >
              Minta Pembatalan Penerimaan
            </Button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
