"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AppIcon,
  FormField,
  FormSection,
  MoneyInput,
  MoneyValue,
  NumericInput,
  TextInput,
  AdaptiveSelect,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import {
  newGoodsReceiptItem,
  type GoodsReceiptItemDraft,
  type GoodsReceiptMaterialOption,
  type GoodsReceiptProjectOption,
} from "./goods-receipt-types";

interface GoodsReceiptItemsSectionProps {
  readonly items: readonly GoodsReceiptItemDraft[];
  readonly materials: readonly GoodsReceiptMaterialOption[];
  readonly selectedProject: GoodsReceiptProjectOption | undefined;
  readonly onItemsChange: (
    change: (items: readonly GoodsReceiptItemDraft[]) => readonly GoodsReceiptItemDraft[],
  ) => void;
  readonly onUpdateItem: (key: string, patch: Partial<GoodsReceiptItemDraft>) => void;
}

export function GoodsReceiptItemsSection({
  items,
  materials,
  selectedProject,
  onItemsChange,
  onUpdateItem,
}: GoodsReceiptItemsSectionProps): React.JSX.Element {
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!pendingScrollKey) return;

    // Reset if item is no longer in draft list (e.g. deleted before scroll)
    const itemExists = items.some((item) => item.key === pendingScrollKey);
    if (!itemExists) {
      const resetTimer = setTimeout(() => {
        setPendingScrollKey(null);
      }, 0);
      return () => {
        clearTimeout(resetTimer);
      };
    }

    const el = itemRefs.current.get(pendingScrollKey);
    if (!el) return;

    const performScroll = (): void => {
      if (el.isConnected && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "nearest",
        });
      }
      setPendingScrollKey(null);
    };

    if (typeof window !== "undefined" && typeof requestAnimationFrame === "function") {
      let innerRafId: number | null = null;
      const rafId = requestAnimationFrame(() => {
        innerRafId = requestAnimationFrame(performScroll);
      });

      return () => {
        cancelAnimationFrame(rafId);
        if (innerRafId !== null) {
          cancelAnimationFrame(innerRafId);
        }
      };
    }

    const timerId = setTimeout(performScroll, 0);

    return () => {
      clearTimeout(timerId);
    };
  }, [pendingScrollKey, items, reduceMotion]);
  const total = items.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const cost = Number(item.unitCost || 0);
    return sum + (Number.isFinite(qty) && Number.isFinite(cost) ? Math.max(0, qty * cost) : 0);
  }, 0);
  const materialOptions = materials.map((material) => ({
    value: material.id,
    label: material.name,
    description: material.unit ? `Satuan ${material.unit}` : undefined,
  }));

  return (
    <section className="space-y-3">
      {/* Header section utama */}
      <div className="flex min-w-0 items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="truncate text-meta font-bold tracking-[0.11em] text-on-surface uppercase">
            Material Diterima
          </h3>
          <p className="mt-0.5 line-clamp-1 text-meta text-on-surface-variant">
            Daftar material fisik yang dicatat ke stok gudang.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="mb-0.5 flex items-center justify-end">
            <span className="inline-flex items-center rounded-full bg-surface-container-high px-2 py-0.5 text-eyebrow font-bold text-on-surface-variant">
              {items.length} item
            </span>
          </div>
          <MoneyValue amount={total} variant="fullDynamic" size="sm" align="right" />
        </div>
      </div>

      {/* Daftar kartu item stok terbuka */}
      <div className="space-y-3">
        {items.map((item, index) => {
          const material = materials.find((row) => row.id === item.materialId);
          const relevantRapItems =
            selectedProject?.rapItems?.filter((row) => row.materialId === item.materialId) ?? [];
          const selectedRapItem = selectedProject?.rapItems?.find(
            (row) => row.id === item.projectRapItemId,
          );

          let helper = "Pilih material, lalu isi jumlah fisik dan harga unit.";
          if (material) {
            if (selectedRapItem) {
              helper = `${material.unit ? `Satuan ${material.unit} · ` : ""}RAP: ${selectedRapItem.name}${selectedRapItem.area ? ` (${selectedRapItem.area})` : ""}`;
            } else if (material.unit) {
              helper = `Satuan ${material.unit}`;
            } else {
              helper = "Material fisik terpilih";
            }
          }

          const quantityNum = Number(item.quantity || 0);
          const unitCostNum = Number(item.unitCost || 0);
          const subtotal =
            Number.isFinite(quantityNum) && Number.isFinite(unitCostNum)
              ? Math.max(0, quantityNum * unitCostNum)
              : 0;

          return (
            <div
              key={item.key}
              ref={(el) => {
                if (el) {
                  itemRefs.current.set(item.key, el);
                } else {
                  itemRefs.current.delete(item.key);
                }
              }}
              className="min-w-0"
            >
              <FormSection className="space-y-0">
                {/* Row 1: Header internal kartu item */}
                <div className="flex items-center justify-between gap-3 bg-surface-container-low/30 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-high px-1.5 text-eyebrow font-bold text-on-surface-variant">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-bold text-on-surface">
                        {material?.name || `Item ${index + 1}`}
                      </h4>
                      <p className="truncate text-meta text-on-surface-variant">{helper}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      transition={transitionSpringSnappy}
                      aria-label={`Duplikat item ${index + 1}`}
                      onClick={() => {
                        const copy = { ...item, key: newGoodsReceiptItem().key };
                        setPendingScrollKey(copy.key);
                        onItemsChange((current) => {
                          const next = [...current];
                          next.splice(index + 1, 0, copy);
                          return next;
                        });
                      }}
                      className="relative inline-flex h-8 items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 text-meta font-bold text-on-surface-variant shadow-surface ring-1 ring-ring-subtle transition-colors outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] hover:text-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-high"
                    >
                      <AppIcon name="content_copy" className="icon-xs" />
                      Duplikat
                    </motion.button>
                  {items.length > 1 ? (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      transition={transitionSpringSnappy}
                      aria-label={`Hapus item ${index + 1}`}
                      onClick={() => {
                        onItemsChange((current) => current.filter((row) => row.key !== item.key));
                      }}
                      className="relative inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-meta font-bold text-error transition-colors outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-error/10"
                    >
                      <AppIcon name="delete" className="icon-xs" />
                      Hapus
                    </motion.button>
                  ) : null}
                </div>
              </div>

              {/* Row 2: AdaptiveSelect untuk Material */}
              <AdaptiveSelect
                label="Material"
                value={item.materialId}
                options={materialOptions}
                onChange={(value) =>
                  onUpdateItem(item.key, {
                    materialId: value,
                    projectRapItemId: "",
                  })
                }
                placeholder="Pilih material"
                searchPlaceholder="Cari material..."
                required
              />

              {/* Row 2 (kondisional): AdaptiveSelect untuk Tautan RAP */}
              {relevantRapItems.length > 0 ? (
                <AdaptiveSelect
                  label="Tautan RAP"
                  optional
                  value={item.projectRapItemId}
                  options={[
                    {
                      value: "",
                      label: "Tanpa tautan RAP",
                      description: "Tidak dikaitkan ke anggaran RAP spesifik.",
                    },
                    ...relevantRapItems.map((row) => ({
                      value: row.id,
                      label: row.name,
                      description: row.area,
                      meta:
                        row.quantity && row.unitCost
                          ? `${row.quantity.toLocaleString("id-ID")} × Rp ${row.unitCost.toLocaleString("id-ID")}`
                          : undefined,
                    })),
                  ]}
                  onChange={(value) => {
                    const rapItem = relevantRapItems.find((row) => row.id === value);
                    onUpdateItem(item.key, {
                      projectRapItemId: value,
                      ...(rapItem && typeof rapItem.quantity === "number" && rapItem.quantity > 0
                        ? { quantity: rapItem.quantity }
                        : {}),
                      ...(rapItem && typeof rapItem.unitCost === "number" && rapItem.unitCost >= 0
                        ? { unitCost: rapItem.unitCost }
                        : {}),
                    });
                  }}
                  placeholder="Tanpa tautan RAP"
                  searchPlaceholder="Cari item RAP..."
                />
              ) : null}

              {/* Row 3: Grid 2 kolom dengan divider */}
              <div className="grid grid-cols-2 divide-x divide-outline-variant/20">
                <FormField label="Jumlah fisik" required>
                  <NumericInput
                    value={item.quantity === 0 ? "" : item.quantity}
                    onChange={(value) => onUpdateItem(item.key, { quantity: value })}
                    min={0}
                    placeholder="0"
                    suffix={material?.unit}
                  />
                </FormField>
                <FormField label="Harga per unit" required>
                  <MoneyInput
                    value={item.unitCost === 0 ? "" : item.unitCost}
                    onChange={(value) => onUpdateItem(item.key, { unitCost: value })}
                    placeholder="0"
                    showPreview={false}
                  />
                </FormField>
              </div>

              {/* Row 4: FormField Catatan item (TextInput 1 baris ringkas opsional) */}
              <FormField label="Catatan item" optional>
                <TextInput
                  value={item.note || ""}
                  onChange={(value) => onUpdateItem(item.key, { note: value })}
                  placeholder="Catatan spesifikasi atau kondisi (opsional)"
                />
              </FormField>

              {/* Row 5: Strip subtotal item di bagian bawah kartu menggunakan MoneyValue */}
              <div className="flex min-h-11 items-center justify-between gap-3 bg-surface-container-low/40 px-4 py-2.5">
                <span className="text-meta font-medium text-on-surface-variant">Subtotal item</span>
                <MoneyValue amount={subtotal} variant="fullDynamic" size="sm" align="right" />
              </div>
            </FormSection>
          </div>
        );
      })}
      </div>

      {/* Tombol Tambah Material */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={transitionSpringSnappy}
        onClick={() => {
          const item = newGoodsReceiptItem();
          setPendingScrollKey(item.key);
          onItemsChange((current) => [...current, item]);
        }}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-container-lowest px-5 text-row font-bold text-on-surface shadow-control ring-1 ring-ring-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <AppIcon name="add" className="icon-sm text-primary" />
        Tambah Material
      </motion.button>
    </section>
  );
}
