import type { JSX } from "react";

import { MoneyValue } from "@/components/ui";
import { formatMaterialQuantity } from "@/features/materials/utils/material-ui-utils";
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
            className="text-row font-bold text-on-surface"
          >
            Item stok fisik
          </h3>
          <p className="mt-0.5 text-meta text-on-surface-variant">
            Cek jumlah dan harga pokok setiap item.
          </p>
        </div>
        <span className="shrink-0 text-meta font-semibold text-on-surface-variant">
          {item.inventoryItems.length} item
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
        {item.inventoryItems.length > 0 ? (
          item.inventoryItems.map((inventoryItem) => (
            <div
              key={inventoryItem.id}
              className="border-b border-outline-variant/20 px-4 py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold text-on-surface">
                  {inventoryItem.materialName}
                </p>
                <p className="mt-0.5 truncate text-meta text-on-surface-variant">
                  {inventoryItem.locationName}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-outline-variant/20 pt-3">
                <div className="min-w-0">
                  <p className="text-eyebrow font-semibold text-on-surface-variant/65">
                    Jumlah fisik
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[12px] font-bold text-on-surface tabular-nums">
                    {formatMaterialQuantity(inventoryItem.quantity)} {inventoryItem.unit}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-eyebrow font-semibold text-on-surface-variant/65">
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

              <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-outline-variant/20 pt-3">
                <p className="shrink-0 text-eyebrow font-semibold text-on-surface-variant/65">
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
          <div className="px-4 py-4 text-[11px] leading-5 text-on-surface-variant">
            Detail item stok tidak tersedia. Jangan setujui sebelum data sumber diperiksa.
          </div>
        )}
      </div>
    </section>
  );
}
