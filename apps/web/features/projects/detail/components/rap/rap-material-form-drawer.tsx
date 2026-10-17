"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

import {
  GroupedSurface,
  FactRow,
  ComboboxField,
  COMMON_ROOM_OPTIONS,
  COMMON_UNIT_OPTIONS,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  MoneyValue,
  NumericInput,
  OperationalFormSheet,
  AdaptiveSelect,
  Textarea,
  TextInput,
  ValuePreviewStrip,
  useFormDirtySnapshot,
} from "@/components/ui";
import { formatIdr as formatRp, formatShortIdr as formatShortRp } from "@atria/core/utils/money";
import type {
  MaterialOption,
  PricingTemplateOption,
  RapFormState,
  RapView,
} from "../shared/rap-rab-manager";

export function RapMaterialFormDrawer({
  showRapForm,
  closeRapForm,
  editingRapItemId,
  rap,
  rapForm,
  setRapForm,
  pricingTemplates,
  materials,
  handleRapTemplateChange,
  handleMaterialChange,
  handleSubmitRapItem,
  isPending,
  formTotalQty,
  formNeedToBuy,
  formEstimatedTotal,
  error,
}: {
  readonly showRapForm: boolean;
  readonly closeRapForm: () => void;
  readonly editingRapItemId: string | null;
  readonly rap: RapView | null;
  readonly rapForm: RapFormState;
  readonly setRapForm: React.Dispatch<React.SetStateAction<RapFormState>>;
  readonly pricingTemplates: readonly PricingTemplateOption[];
  readonly materials: readonly MaterialOption[];
  readonly handleRapTemplateChange: (id: string) => void;
  readonly handleMaterialChange: (id: string) => void;
  readonly handleSubmitRapItem: (event: React.FormEvent) => void;
  readonly isPending: boolean;
  readonly formTotalQty: number;
  readonly formNeedToBuy: number;
  readonly formEstimatedTotal: number;
  readonly error?: string | null;
}): React.JSX.Element | null {
  const desktop = useWorkspacePresentation() === "desktop";
  const dirty = useFormDirtySnapshot(
    showRapForm,
    editingRapItemId ?? "new-rap-material",
    JSON.stringify(rapForm),
  );
  function updateRapForm(value: React.SetStateAction<RapFormState>): void {
    if (!isPending) setRapForm(value);
  }
  if (!rap) return null;

  return (
    <OperationalFormSheet
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-support font-semibold text-on-surface">Ringkasan material</h3>
            <p className="mt-1 text-support wrap-anywhere text-on-surface-variant">
              {rapForm.name.trim() || "Nama material belum diisi"}
            </p>
          </div>
          <GroupedSurface variant="desktopPanel" className="wrap-anywhere">
            <div className="divide-y divide-outline-variant/20">
              <FactRow
                layout="stacked"
                wrapLabel
                label="Kebutuhan"
                value={`${formTotalQty.toLocaleString("id-ID")} ${rapForm.unit || "unit"}`}
              />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Perlu diamankan"
                value={`${formNeedToBuy.toLocaleString("id-ID")} ${rapForm.unit || "unit"}`}
              />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Estimasi biaya"
                value={
                  <MoneyValue
                    fractionDigits={Number.isInteger(formEstimatedTotal) ? 0 : 2}
                    amount={formEstimatedTotal}
                    variant="fullDynamic"
                    size="sm"
                    align="right"
                  />
                }
              />
            </div>
          </GroupedSurface>
          <p className="px-1 text-support text-on-surface-variant">
            Rencana RAP tidak memindahkan stok atau membayar material. Periksa sumber material dan
            kebutuhan proyek.
          </p>
        </div>
      }
      dismissal={{
        mode: "confirm",
        dirty,
        onDiscard: () => closeRapForm(),
        description: "Perubahan material RAP yang belum disimpan akan hilang.",
      }}
      open={showRapForm}
      title={editingRapItemId ? "Edit Material RAP" : "Tambah Material RAP"}
      onClose={closeRapForm}
      formId="rap-material-item-form"
      submitLabel={editingRapItemId ? "Perbarui" : "Tambah"}
      submittingLabel="Menyimpan…"
      pending={isPending}
      error={
        error ? (
          <div role="alert">
            <FormRiskNotice title="Material RAP belum tersimpan" tone="danger">
              {error}
            </FormRiskNotice>
          </div>
        ) : undefined
      }
      disabled={!rapForm.name || !rapForm.area || !rapForm.unit || !rapForm.requiredQuantity}
      disabledReason={
        !rapForm.name || !rapForm.area || !rapForm.unit || !rapForm.requiredQuantity
          ? "Lengkapi nama, area, satuan, dan jumlah material."
          : undefined
      }
      statusText={
        desktop
          ? undefined
          : `${formTotalQty.toLocaleString("id-ID")} ${rapForm.unit} · Perlu diamankan ${formNeedToBuy.toLocaleString("id-ID")} · ${formatRp(formEstimatedTotal)}`
      }
      statusTone={
        !rapForm.name || !rapForm.area || !rapForm.unit || !rapForm.requiredQuantity
          ? "warning"
          : formNeedToBuy > 0
            ? "warning"
            : "success"
      }
    >
      <div className="space-y-md">
        {!desktop && (
          <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
                  Item RAP Material
                </p>
                <h3 className="mt-0.5 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
                  {rapForm.name || "Material belum diisi"}
                </h3>
                <p className="mt-0.5 truncate text-meta font-medium text-on-surface-variant/75">
                  {rapForm.area ? `Area ${rapForm.area}` : "Tanpa area"}
                  {rapForm.unit
                    ? ` · Total ${formTotalQty.toLocaleString("id-ID")} ${rapForm.unit}`
                    : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                  Estimasi Biaya
                </p>
                <div className="mt-0.5">
                  <MoneyValue
                    amount={formEstimatedTotal}
                    variant="fullDynamic"
                    size="sm"
                    align="right"
                    className="font-bold text-primary"
                  />
                </div>
                {formNeedToBuy > 0 ? (
                  <span className="mt-1 inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[9px] font-bold text-warning ring-1 ring-warning/20">
                    Perlu {formNeedToBuy.toLocaleString("id-ID")} {rapForm.unit}
                  </span>
                ) : (
                  <span className="mt-1 inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-bold text-success ring-1 ring-success/20">
                    Stok aman
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        <form id="rap-material-item-form" onSubmit={handleSubmitRapItem} className="space-y-md">
          <FormSection
            title="Sumber material"
            helper="Gunakan data tersimpan untuk mempercepat input, atau isi manual bila material belum tersedia."
          >
            {!editingRapItemId && (
              <div>
                <AdaptiveSelect
                  label="Gunakan template Library"
                  value={rapForm.templateId}
                  disabled={isPending}
                  onChange={(value): void => {
                    if (!isPending) handleRapTemplateChange(value);
                  }}
                  options={[
                    {
                      value: "",
                      label: "Isi manual",
                      description: "Isi material dari awal.",
                    },
                    ...pricingTemplates
                      .filter((item) => item.itemType === "MATERIAL_ITEM")
                      .map((item) => ({
                        value: item.id,
                        label: item.name,
                        description: `${formatShortRp(item.internalCost)}/${item.unit}`,
                      })),
                  ]}
                />
                <p className="px-4 pt-1 pb-3 text-meta text-on-surface-variant">
                  Biaya dan rekomendasi harga klien berasal dari rincian Library, lalu disimpan
                  sebagai snapshot proyek.
                </p>
              </div>
            )}
            <AdaptiveSelect
              label="Material Master"
              value={rapForm.materialId}
              disabled={isPending}
              onChange={(value): void => {
                if (!isPending) handleMaterialChange(value);
              }}
              options={[
                { value: "", label: "Isi manual / belum pilih material" },
                ...materials.map((material) => ({
                  value: material.id,
                  label: material.name,
                  description: `Tersedia ${material.availableStock} ${material.unit}`,
                  meta: material.categoryName,
                })),
              ]}
              placeholder="Isi manual / belum pilih material"
            />
          </FormSection>

          <FormSection
            title="Identitas & penggunaan"
            helper="Nama dan area akan menjadi konteks utama saat item muncul di daftar RAP."
          >
            <ComboboxField
              disabled={isPending}
              label="Area / Ruangan"
              value={rapForm.area}
              onChange={(value) => updateRapForm((curr) => ({ ...curr, area: value }))}
              options={COMMON_ROOM_OPTIONS}
              placeholder="Contoh: Dapur"
            />
            <ComboboxField
              disabled={isPending}
              label="Satuan"
              value={rapForm.unit}
              onChange={(value) => updateRapForm((curr) => ({ ...curr, unit: value }))}
              options={COMMON_UNIT_OPTIONS}
              placeholder="Contoh: lembar"
            />
            <FormField label="Nama Material">
              <TextInput
                disabled={isPending}
                value={rapForm.name}
                onChange={(value) => updateRapForm((curr) => ({ ...curr, name: value }))}
                placeholder="Contoh: Multipleks 18mm"
              />
            </FormField>
            <FormField label="Deskripsi Internal">
              <Textarea
                disabled={isPending}
                rows={2}
                value={rapForm.description}
                onChange={(value) => updateRapForm((curr) => ({ ...curr, description: value }))}
                placeholder="Spesifikasi atau penggunaan"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Kebutuhan & biaya"
            helper="Aplikasi menghitung kebutuhan total, kekurangan, dan estimasi biaya secara langsung."
          >
            <div className="grid grid-cols-2 divide-x divide-outline-variant/20">
              <FormField label="Jumlah">
                <NumericInput
                  disabled={isPending}
                  value={rapForm.requiredQuantity}
                  min={0}
                  onChange={(value) =>
                    updateRapForm((curr) => ({ ...curr, requiredQuantity: value }))
                  }
                  suffix={rapForm.unit || undefined}
                />
              </FormField>
              <FormField label="Biaya per Satuan">
                <MoneyInput
                  disabled={isPending}
                  value={rapForm.estimatedUnitCost}
                  onChange={(value) =>
                    updateRapForm((curr) => ({ ...curr, estimatedUnitCost: value }))
                  }
                  showPreview={false}
                />
              </FormField>
            </div>
            <FormField
              label="Buffer / Cadangan"
              optional
              helper="Tambahan kuantitas untuk antisipasi pemborosan/waste."
            >
              <NumericInput
                disabled={isPending}
                value={rapForm.bufferQuantity}
                min={0}
                onChange={(value) => updateRapForm((curr) => ({ ...curr, bufferQuantity: value }))}
                suffix={rapForm.unit || undefined}
              />
            </FormField>
            <AdaptiveSelect
              label="Sumber Pemenuhan"
              disabled={isPending}
              value={rapForm.source}
              onChange={(value) =>
                updateRapForm((curr) => ({
                  ...curr,
                  source: value as RapFormState["source"],
                }))
              }
              options={[
                { value: "PURCHASE", label: "Pembelian" },
                { value: "STOCK", label: "Stok" },
                { value: "STOCK_AND_PURCHASE", label: "Stok + Pembelian" },
                { value: "VENDOR", label: "Vendor" },
              ]}
            />
            <FormField label="Catatan Internal">
              <Textarea
                disabled={isPending}
                rows={2}
                value={rapForm.internalNote}
                onChange={(value) => updateRapForm((curr) => ({ ...curr, internalNote: value }))}
                placeholder="Tidak tampil ke klien"
              />
            </FormField>

            <div className="p-3">
              <ValuePreviewStrip
                lastItemFullWidth
                items={[
                  {
                    label: "Total kebutuhan",
                    value: `${formTotalQty.toLocaleString("id-ID")} ${rapForm.unit}`,
                  },
                  {
                    label: "Perlu diamankan",
                    value: `${formNeedToBuy.toLocaleString("id-ID")} ${rapForm.unit}`,
                    tone: formNeedToBuy > 0 ? "warning" : "success",
                  },
                  {
                    label: "Estimasi biaya",
                    amount: formEstimatedTotal,
                    tone: formEstimatedTotal > 0 ? "success" : "default",
                  },
                ]}
              />
            </div>
          </FormSection>
        </form>
      </div>
    </OperationalFormSheet>
  );
}
