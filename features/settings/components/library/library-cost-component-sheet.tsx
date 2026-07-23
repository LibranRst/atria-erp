"use client";

import React from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import {
  COMMON_UNIT_OPTIONS,
  ComboboxField,
  FormField,
  FormSection,
  MoneyInput,
  NumericInput,
  OperationalFormSheet,
  SheetSelect,
  TextInput,
  ValuePreviewStrip,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import type { ComponentType, CostComponentDraft } from "../../types/library-types";

const COMPONENT_TYPES: readonly ComponentType[] = [
  "LABOR",
  "MATERIAL",
  "EQUIPMENT",
  "LOGISTICS",
  "OVERHEAD",
  "OTHER",
];

const COMPONENT_TYPE_LABELS: Readonly<Record<ComponentType, string>> = {
  LABOR: "Tenaga kerja",
  MATERIAL: "Material",
  EQUIPMENT: "Peralatan",
  LOGISTICS: "Logistik",
  OVERHEAD: "Overhead",
  OTHER: "Lainnya",
};

const fullMoney = (value: number): string => `Rp ${Math.round(value).toLocaleString("id-ID")}`;

type LibraryCostComponentSheetProps = {
  readonly componentEditor: CostComponentDraft | null;
  readonly onRequestClose: () => void;
  readonly onSubmit: () => void;
  readonly patchComponent: (patch: Partial<CostComponentDraft>) => void;
  readonly deleteComponent: () => void;
  readonly componentEditorValid: boolean;
  readonly componentNameTouched: boolean;
  readonly setComponentNameTouched: (touched: boolean) => void;
  readonly isExistingComponent: boolean;
  readonly canDelete: boolean;
};

export function LibraryCostComponentSheet({
  componentEditor,
  onRequestClose,
  onSubmit,
  patchComponent,
  deleteComponent,
  componentEditorValid,
  componentNameTouched,
  setComponentNameTouched,
  isExistingComponent,
  canDelete,
}: LibraryCostComponentSheetProps): React.JSX.Element {
  return (
    <OperationalFormSheet
      open={Boolean(componentEditor)}
      title={isExistingComponent ? "Edit Komponen Biaya" : "Tambah Komponen Biaya"}
      onClose={onRequestClose}
      disabled={!componentEditorValid}
      disabledReason={
        !componentEditorValid
          ? "Lengkapi nama minimal 2 karakter, jumlah, satuan, dan biaya satuan."
          : undefined
      }
      submitLabel="Simpan"
      onSubmit={onSubmit}
      statusText={
        componentEditor
          ? `${componentEditor.label.trim() || "Komponen belum diisi"} · ${fullMoney(componentEditor.quantity * componentEditor.unitCost)}`
          : undefined
      }
      statusTone={componentEditorValid ? "success" : "warning"}
    >
      {componentEditor ? (
        <div className="space-y-md">
          <FormSection
            title="Jenis & nama biaya"
            helper="Satu komponen mewakili satu sumber biaya yang dapat digunakan kembali."
          >
            <SheetSelect
              label="Tipe komponen"
              value={componentEditor.componentType}
              onChange={(value) => patchComponent({ componentType: value as ComponentType })}
              options={COMPONENT_TYPES.map((value) => ({
                value,
                label: COMPONENT_TYPE_LABELS[value],
              }))}
            />
            <FormField
              label="Nama biaya"
              required
              error={
                componentNameTouched && componentEditor.label.trim().length < 2
                  ? "Nama biaya minimal 2 karakter."
                  : undefined
              }
            >
              <TextInput
                autoFocus
                placeholder="Contoh: Material utama"
                value={componentEditor.label}
                onChange={(value) => {
                  setComponentNameTouched(true);
                  patchComponent({ label: value });
                }}
                aria-invalid={componentNameTouched && componentEditor.label.trim().length < 2}
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Jumlah & biaya"
            helper="Subtotal diperbarui langsung sebelum komponen disimpan."
          >
            <FormField label="Jumlah">
              <NumericInput
                min={0.01}
                value={componentEditor.quantity}
                onChange={(value) => patchComponent({ quantity: Number(value || 0) })}
              />
            </FormField>

            <ComboboxField
              label="Satuan"
              value={componentEditor.unit}
              onChange={(value) => patchComponent({ unit: value })}
              options={COMMON_UNIT_OPTIONS}
              error={!componentEditor.unit.trim() ? "Satuan wajib diisi." : undefined}
            />

            <FormField label="Biaya satuan">
              <MoneyInput
                value={componentEditor.unitCost}
                showPreview={false}
                onChange={(value) => patchComponent({ unitCost: Number(value || 0) })}
              />
            </FormField>

            <div className="p-3">
              <ValuePreviewStrip
                items={[
                  {
                    label: "Subtotal komponen",
                    amount: componentEditor.quantity * componentEditor.unitCost,
                    tone: "success",
                  },
                ]}
              />
            </div>
          </FormSection>

          {isExistingComponent ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              disabled={!canDelete}
              onClick={deleteComponent}
              className="min-h-12 w-full rounded-full bg-error-container/20 px-5 text-xs font-bold text-error disabled:opacity-35"
            >
              <Trash2 className="mr-1.5 inline h-4 w-4" /> Hapus Komponen
            </motion.button>
          ) : null}
        </div>
      ) : null}
    </OperationalFormSheet>
  );
}
