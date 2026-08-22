"use client";

import { motion } from "framer-motion";
import {
  AppIcon,
  FormField,
  MoneyInput,
  QuantityStepper,
  AdaptiveSelect,
  Textarea,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import {
  goodsReceiptMoney,
  newGoodsReceiptItem,
  type GoodsReceiptItemDraft,
  type GoodsReceiptMaterialOption,
  type GoodsReceiptProjectOption,
} from "./goods-receipt-types";

interface GoodsReceiptItemsSectionProps {
  readonly items: readonly GoodsReceiptItemDraft[];
  readonly materials: readonly GoodsReceiptMaterialOption[];
  readonly selectedProject: GoodsReceiptProjectOption | undefined;
  readonly editingKey: string | null;
  readonly onEditingKeyChange: (key: string | null) => void;
  readonly onItemsChange: (
    change: (items: readonly GoodsReceiptItemDraft[]) => readonly GoodsReceiptItemDraft[],
  ) => void;
  readonly onUpdateItem: (key: string, patch: Partial<GoodsReceiptItemDraft>) => void;
}

export function GoodsReceiptItemsSection({
  items,
  materials,
  selectedProject,
  editingKey,
  onEditingKeyChange,
  onItemsChange,
  onUpdateItem,
}: GoodsReceiptItemsSectionProps): React.JSX.Element {
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const materialOptions = materials.map((material) => ({
    value: material.id,
    label: material.name,
    description: material.unit ? `Satuan ${material.unit}` : undefined,
  }));

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="grid min-w-0 gap-0.5">
          <p className="text-[10px] leading-[1.15] font-bold tracking-wide uppercase">
            Material diterima
          </p>
          <p className="text-[10px] leading-tight text-on-surface-variant">
            Buka item untuk mengubah detail.
          </p>
        </div>
        <p className="shrink-0 font-mono text-xs font-bold text-on-surface tabular-nums">
          {goodsReceiptMoney.format(total)}
        </p>
      </div>

      {items.map((item, index) => {
        const material = materials.find((row) => row.id === item.materialId);
        const complete = Boolean(item.materialId && item.quantity > 0 && item.unitCost >= 0);

        return (
          <div
            key={item.key}
            className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle"
          >
            <button
              type="button"
              onClick={() => onEditingKeyChange(editingKey === item.key ? null : item.key)}
              className="flex min-h-17 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low"
              aria-expanded={editingKey === item.key}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${complete ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"}`}
                aria-hidden="true"
              >
                <AppIcon
                  name={complete ? "check" : "inventory_2"}
                  className="icon-md leading-none"
                />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs leading-[1.15] font-bold">
                    {material?.name ?? `Material ${index + 1}`}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] leading-none font-bold ${complete ? "text-primary" : "text-warning"}`}
                  >
                    {complete ? "Lengkap" : "Lengkapi"}
                  </span>
                </span>
                <span className="truncate text-[10px] leading-tight text-on-surface-variant">
                  {complete
                    ? `${item.quantity.toLocaleString("id-ID")} ${material?.unit ?? "unit"} × ${goodsReceiptMoney.format(item.unitCost)}`
                    : "Pilih material, jumlah, dan harga"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs font-bold tabular-nums">
                  {goodsReceiptMoney.format(item.quantity * item.unitCost)}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
                  <AppIcon
                    name="expand_more"
                    className={`icon-sm transition-transform ${editingKey === item.key ? "rotate-180" : ""}`}
                  />
                </span>
              </span>
            </button>

            {editingKey === item.key ? (
              <div className="space-y-2.5 border-t border-outline-variant/15 bg-surface-container-low/65 p-3">
                <AdaptiveSelect
                  label="Material"
                  value={item.materialId}
                  options={materialOptions}
                  onChange={(value) =>
                    onUpdateItem(item.key, { materialId: value, projectRapItemId: "" })
                  }
                  placeholder="Pilih material"
                  required
                />
                <AdaptiveSelect
                  label="Tautan RAP"
                  optional
                  value={item.projectRapItemId}
                  options={[
                    { value: "", label: "Tanpa tautan RAP" },
                    ...(selectedProject?.rapItems
                      ?.filter((row) => row.materialId === item.materialId)
                      .map((row) => ({
                        value: row.id,
                        label: row.name,
                        description: row.area,
                      })) ?? []),
                  ]}
                  onChange={(value) => {
                    const rapItem = selectedProject?.rapItems?.find((row) => row.id === value);
                    onUpdateItem(item.key, {
                      projectRapItemId: value,
                      ...(rapItem
                        ? {
                            quantity: rapItem.quantity ?? 1,
                            unitCost: rapItem.unitCost ?? 0,
                          }
                        : {}),
                    });
                  }}
                  placeholder="Tanpa tautan RAP"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <FormField label={material?.unit ? `Jumlah (${material.unit})` : "Jumlah"}>
                    <QuantityStepper
                      value={item.quantity}
                      min={0}
                      step={1}
                      onChange={(value) => onUpdateItem(item.key, { quantity: Number(value) })}
                    />
                  </FormField>
                  <FormField label="Harga per unit">
                    <MoneyInput
                      value={item.unitCost}
                      showPreview={false}
                      onChange={(value) => onUpdateItem(item.key, { unitCost: Number(value) })}
                    />
                  </FormField>
                </div>
                <FormField label="Catatan item" optional>
                  <Textarea
                    rows={2}
                    value={item.note}
                    onChange={(value) => onUpdateItem(item.key, { note: value })}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    transition={transitionSpringSnappy}
                    onClick={() => {
                      const copy = { ...item, key: newGoodsReceiptItem().key };
                      onItemsChange((current) => [...current, copy]);
                      onEditingKeyChange(copy.key);
                    }}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container text-xs font-bold"
                  >
                    <AppIcon name="content_copy" className="icon-sm" />
                    Duplikat
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    transition={transitionSpringSnappy}
                    disabled={items.length === 1}
                    onClick={() => {
                      onItemsChange((current) => current.filter((row) => row.key !== item.key));
                      onEditingKeyChange(null);
                    }}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-error-container/25 text-xs font-bold text-error disabled:opacity-35"
                  >
                    <AppIcon name="delete" className="icon-sm" />
                    Hapus
                  </motion.button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={transitionSpringSnappy}
        onClick={() => {
          const item = newGoodsReceiptItem();
          onItemsChange((current) => [...current, item]);
          onEditingKeyChange(item.key);
        }}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-container-lowest text-xs font-bold text-on-surface shadow-control ring-1 ring-ring-subtle"
      >
        <AppIcon name="add" className="icon-sm text-accent" />
        Tambah Material
      </motion.button>
    </section>
  );
}
