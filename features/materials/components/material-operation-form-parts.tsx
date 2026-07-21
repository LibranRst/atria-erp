"use client";

import React from "react";
import { ChevronDown, Copy, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

import { FormField, QuantityStepper, SheetSelect, Textarea, TextInput } from "@/components/ui";
import { FormPresentationProvider } from "@/components/ui/form-presentation-context";
import type { SimpleItem } from "@/features/materials/lib/material-ui-utils";
import { transitionSpringSnappy } from "@/lib/utils/motion";

export function DocumentForm({
  number,
  setNumber,
  note,
  setNote,
}: {
  readonly number: string;
  readonly setNumber: (value: string) => void;
  readonly note: string;
  readonly setNote: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-sm">
      <FormField label="Nomor dokumen">
        <TextInput value={number} onChange={setNumber} />
      </FormField>
      <FormField label="Catatan audit">
        <Textarea rows={3} value={note} onChange={setNote} />
      </FormField>
    </div>
  );
}

export function ItemRows({
  items,
  setItems,
  materials,
  createItem,
  single = false,
}: {
  readonly items: readonly SimpleItem[];
  readonly setItems: (items: readonly SimpleItem[]) => void;
  readonly materials: readonly { readonly id: string; readonly name: string }[];
  readonly createItem: () => SimpleItem;
  readonly single?: boolean;
}): React.JSX.Element {
  const [editingKey, setEditingKey] = React.useState<string | null>(
    items.length === 1 ? (items[0]?.key ?? null) : null,
  );
  const options = materials.map((row) => ({ value: row.id, label: row.name }));
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={item.key}
          className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-[0_8px_24px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15"
        >
          <button
            type="button"
            onClick={() => setEditingKey((current) => (current === item.key ? null : item.key))}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
            aria-expanded={editingKey === item.key}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.materialId && Number(item.quantity) > 0 ? "bg-primary" : "bg-warning"}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs leading-[1.15] font-bold">
                {materials.find((row) => row.id === item.materialId)?.name ??
                  `Material ${index + 1}`}
              </span>
              <span className="mt-0.5 block text-[10px] leading-[1.2] text-on-surface-variant">
                {item.materialId && Number(item.quantity) > 0
                  ? `${Number(item.quantity).toLocaleString("id-ID", { maximumFractionDigits: 2 })} unit`
                  : "Lengkapi material dan jumlah"}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-on-surface-variant ${editingKey === item.key ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {editingKey === item.key ? (
            <div className="border-t border-outline-variant/15">
              <FormPresentationProvider presentation="grouped">
                <div className="divide-y divide-outline-variant/20">
                  <SheetSelect
                    label="Material"
                    value={item.materialId}
                    onChange={(value) =>
                      setItems(
                        items.map((row) =>
                          row.key === item.key ? { ...row, materialId: value } : row,
                        ),
                      )
                    }
                    options={options}
                    placeholder="Pilih material"
                  />
                  <FormField label="Jumlah">
                    <QuantityStepper
                      value={item.quantity}
                      min={0}
                      step={1}
                      onChange={(value) =>
                        setItems(
                          items.map((row) =>
                            row.key === item.key ? { ...row, quantity: value } : row,
                          ),
                        )
                      }
                    />
                  </FormField>
                </div>
              </FormPresentationProvider>
              {!single ? (
                <div className="grid grid-cols-2 gap-2 border-t border-outline-variant/15 bg-surface-container-low/45 p-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    transition={transitionSpringSnappy}
                    onClick={() => setItems([...items, { ...item, key: createItem().key }])}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container-lowest text-xs font-bold text-on-surface ring-1 ring-outline-variant/15"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" /> Duplikat
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    transition={transitionSpringSnappy}
                    disabled={items.length === 1}
                    onClick={() => {
                      setItems(items.filter((row) => row.key !== item.key));
                      setEditingKey(null);
                    }}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-error-container/20 text-xs font-bold text-error disabled:opacity-35"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
                  </motion.button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
      {!single && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={transitionSpringSnappy}
          onClick={() => {
            const next = createItem();
            setItems([...items, next]);
            setEditingKey(next.key);
          }}
          className="min-h-12 w-full rounded-full bg-surface-container-lowest text-xs font-bold text-primary shadow-[0_6px_18px_rgba(17,17,17,0.025)] ring-1 ring-primary/15"
        >
          Tambah Material
        </motion.button>
      )}
    </div>
  );
}
