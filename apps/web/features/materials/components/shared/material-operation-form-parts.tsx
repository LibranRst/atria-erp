"use client";

import React from "react";

import { AppIcon, FormField, QuantityStepper, AdaptiveSelect } from "@/components/ui";
import type { MaterialOption } from "@/features/materials/types/material-operation-dialog-types";
import type { SimpleItem } from "@/features/materials/utils/material-ui-utils";

export function DocumentForm({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <div className="space-y-4">{children}</div>;
}

export function ItemRows({
  items,
  setItems,
  materials,
  createItem,
}: {
  readonly items: readonly SimpleItem[];
  readonly setItems: (items: readonly SimpleItem[]) => void;
  readonly materials: readonly MaterialOption[];
  readonly createItem: () => SimpleItem;
}): React.JSX.Element {
  const options = materials.map((material) => ({
    value: material.id,
    label: material.name,
  }));

  function updateItem(key: string, patch: Partial<SimpleItem>): void {
    setItems(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.key}
          className="space-y-3 rounded-[22px] bg-surface-container-lowest p-3 ring-1 ring-ring-subtle"
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-meta font-bold tracking-wide text-on-surface-variant uppercase">
              Item {index + 1}
            </p>
            <button
              type="button"
              disabled={items.length === 1}
              onClick={() => setItems(items.filter((row) => row.key !== item.key))}
              className="flex h-10 w-10 items-center justify-center rounded-full text-error outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-30"
              aria-label={`Hapus item ${index + 1}`}
            >
              <AppIcon name="delete" className="icon-md" />
            </button>
          </div>
          <AdaptiveSelect
            label="Material"
            value={item.materialId}
            options={options}
            onChange={(materialId) => updateItem(item.key, { materialId })}
            placeholder="Pilih material"
            required
          />
          <FormField label="Jumlah" required>
            <QuantityStepper
              value={item.quantity}
              unit={materials.find((m) => m.id === item.materialId)?.unit}
              min={0}
              step={1}
              onChange={(quantity) => updateItem(item.key, { quantity })}
            />
          </FormField>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems([...items, createItem()])}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-container px-5 text-xs font-bold text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <AppIcon name="add" className="text-[17px]" />
        Tambah material
      </button>
    </div>
  );
}
