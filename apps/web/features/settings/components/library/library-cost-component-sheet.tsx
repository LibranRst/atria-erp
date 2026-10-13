"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  AppIcon,
  ComboboxField,
  COMMON_UNIT_OPTIONS,
  FactRow,
  FormField,
  FormSection,
  GroupedSurface,
  MoneyInput,
  MoneyValue,
  NumericInput,
  OperationalFormSheet,
  AdaptiveSelect,
  TextInput,
  ValuePreviewStrip,
  Button,
} from "@/components/ui";
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
  readonly unitOptions?: readonly string[];
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
  unitOptions,
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
  const desktop = useWorkspacePresentation() === "desktop";
  return (
    <OperationalFormSheet
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={
        componentEditor ? (
          <div className="space-y-4">
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                <FactRow
                  layout="stacked"
                  label="Komponen"
                  wrapLabel
                  value={componentEditor.label.trim() || "Nama belum diisi"}
                />
                <FactRow
                  layout="stacked"
                  label="Jenis biaya"
                  wrapLabel
                  value={COMPONENT_TYPE_LABELS[componentEditor.componentType]}
                />
                <FactRow
                  layout="stacked"
                  label="Jumlah"
                  wrapLabel
                  value={`${componentEditor.quantity.toLocaleString("id-ID")} ${componentEditor.unit}`}
                />
                <FactRow
                  layout="stacked"
                  label="Biaya satuan"
                  wrapLabel
                  value={
                    <MoneyValue
                      fractionDigits={Number.isInteger(componentEditor.unitCost) ? 0 : 2}
                      amount={componentEditor.unitCost}
                      variant="fullDynamic"
                      size="sm"
                    />
                  }
                />
                <FactRow
                  layout="stacked"
                  label="Subtotal draft"
                  wrapLabel
                  value={
                    <MoneyValue
                      fractionDigits={
                        Number.isInteger(componentEditor.quantity * componentEditor.unitCost)
                          ? 0
                          : 2
                      }
                      amount={componentEditor.quantity * componentEditor.unitCost}
                      variant="fullDynamic"
                      size="sm"
                    />
                  }
                />
              </div>
            </GroupedSurface>
            <p className="text-support leading-relaxed text-on-surface-variant">
              Komponen menjadi bagian rincian biaya template. Menyimpannya belum mengubah transaksi
              atau stok.
            </p>
          </div>
        ) : undefined
      }
      secondary={
        desktop && isExistingComponent
          ? {
              label: "Hapus Komponen",
              onClick: deleteComponent,
              disabled: !canDelete,
              variant: "criticalQuiet",
            }
          : undefined
      }
      dismissal={{ mode: "managed" }}
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
        componentEditor && !desktop
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
            <AdaptiveSelect
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
              options={unitOptions ?? COMMON_UNIT_OPTIONS}
              error={!componentEditor.unit.trim() ? "Satuan wajib diisi." : undefined}
            />

            <FormField label="Biaya satuan">
              <MoneyInput
                value={componentEditor.unitCost}
                showPreview={false}
                onChange={(value) => patchComponent({ unitCost: Number(value || 0) })}
              />
            </FormField>

            <div className={desktop ? "hidden" : "p-3"}>
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

          {isExistingComponent && !desktop ? (
            <Button
              type="button"
              disabled={!canDelete}
              onClick={deleteComponent}
              className="min-h-12 w-full rounded-full bg-error-container/20 px-5 text-xs font-bold text-error disabled:opacity-35"
              variant="criticalQuiet"
            >
              <AppIcon name="delete" className="mr-1.5 inline icon-sm" /> Hapus Komponen
            </Button>
          ) : null}
        </div>
      ) : null}
    </OperationalFormSheet>
  );
}
