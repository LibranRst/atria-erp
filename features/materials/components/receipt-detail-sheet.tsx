"use client";

import React from "react";

import type { ReceiptView } from "@/app/actions/material/operations-dashboard";
import { Badge, BottomSheet } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import { Mini } from "@/features/materials/components/material-operation-sheets";
import {
  formatMaterialQuantity,
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
  return (
    <BottomSheet
      open={Boolean(receipt)}
      title={receipt?.receiptNumber ?? "Goods Receipt"}
      onClose={onClose}
    >
      {receipt && (
        <div className="space-y-sm">
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Project" value={receipt.projectName} />
            <Mini label="Total" amount={receipt.total} />
          </div>
          {receipt.items.map((item) => (
            <div
              key={`${item.materialName}-${item.quantity}`}
              className="rounded-2xl bg-surface-container-low p-3 text-xs"
            >
              <p className="font-bold">{item.materialName}</p>
              <div className="mt-1 flex items-start justify-between gap-3 text-on-surface-variant">
                <span>{formatMaterialQuantity(item.quantity)} ×</span>
                <MoneyValue
                  amount={item.unitCost}
                  variant="compactWithFull"
                  align="right"
                  size="sm"
                  className="max-w-[62%] shrink-0"
                />
              </div>
            </div>
          ))}
          <Badge status={materialBadgeTone(receipt.status)}>{receipt.status}</Badge>
          {canRequestReversal && receipt.status === "POSTED" && (
            <button
              type="button"
              onClick={() => onRequestReversal(receipt.id)}
              className="min-h-11 w-full rounded-full bg-error-container/20 text-xs font-bold text-error"
            >
              Request Reversal
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
