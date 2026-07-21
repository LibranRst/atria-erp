import type { JSX } from "react";

import { MoneyValue } from "@/components/ui/page-primitives";
import { formatMaterialQuantity } from "@/features/materials/lib/material-ui-utils";
export type InventoryOpeningApprovalItemSource = {
  readonly referenceId: string;
  readonly inventoryItems: readonly {
    readonly id: string;
    readonly materialName: string;
    readonly locationName: string;
    readonly quantity: number;
    readonly unit: string;
    readonly unitCost: number;
    readonly totalValue: number;
  }[];
};

type InventoryOpeningApprovalItemsProps = {
  readonly item: InventoryOpeningApprovalItemSource;
};

export function InventoryOpeningApprovalItems({
  item,
}: InventoryOpeningApprovalItemsProps): JSX.Element {
  return (
    <section aria-labelledby={`opening-items-${item.referenceId}`}>
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3
            id={`opening-items-${item.referenceId}`}
            className="text-on-surface text-[13px] font-bold"
          >
            Item stok fisik
          </h3>
          <p className="text-on-surface-variant mt-0.5 text-[10px]">
            Cek jumlah dan harga pokok setiap item.
          </p>
        </div>
        <span className="text-on-surface-variant shrink-0 text-[10px] font-semibold">
          {item.inventoryItems.length} item
        </span>
      </div>

      <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_12px_30px_rgba(17,17,17,0.045)] ring-1 ring-black/2.5">
        {item.inventoryItems.length > 0 ? (
          item.inventoryItems.map((inventoryItem) => (
            <div
              key={inventoryItem.id}
              className="border-outline-variant/20 border-b px-4 py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-on-surface truncate text-[12px] font-bold">
                  {inventoryItem.materialName}
                </p>
                <p className="text-on-surface-variant mt-0.5 truncate text-[10px]">
                  {inventoryItem.locationName}
                </p>
              </div>

              <div className="border-outline-variant/20 mt-3 grid grid-cols-2 gap-3 border-t pt-3">
                <div className="min-w-0">
                  <p className="text-on-surface-variant/65 text-[9px] font-semibold">
                    Jumlah fisik
                  </p>
                  <p className="text-on-surface mt-0.5 truncate font-mono text-[12px] font-bold tabular-nums">
                    {formatMaterialQuantity(inventoryItem.quantity)} {inventoryItem.unit}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-on-surface-variant/65 text-[9px] font-semibold">
                    Harga per unit
                  </p>
                  <MoneyValue
                    amount={inventoryItem.unitCost}
                    variant="fullDynamic"
                    size="sm"
                    align="right"
                    className="mt-0.5"
                  />
                </div>
              </div>

              <div className="border-outline-variant/20 mt-3 flex min-w-0 items-center justify-between gap-3 border-t pt-3">
                <p className="text-on-surface-variant/65 shrink-0 text-[9px] font-semibold">
                  Subtotal item
                </p>
                <MoneyValue
                  amount={inventoryItem.totalValue}
                  variant="fullDynamic"
                  size="sm"
                  align="right"
                  className="min-w-0 flex-1"
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-on-surface-variant px-4 py-4 text-[11px] leading-5">
            Detail item stok tidak tersedia. Jangan setujui sebelum data sumber diperiksa.
          </div>
        )}
      </div>
    </section>
  );
}
