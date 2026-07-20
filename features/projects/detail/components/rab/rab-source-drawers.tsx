"use client";

import React from "react";
import { motion } from "framer-motion";

import {
  ChoiceRow,
  COMMON_UNIT_OPTIONS,
  ComboboxField,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  NumericInput,
  OperationalFormSheet,
  Textarea,
  TextInput,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import type {
  ManualQuotationLine,
  ProjectCategoryPlanItemView,
  RabEstimateView,
  RapView,
} from "../shared/rap-rab-manager";

export function RabSourcePickerDrawer({
  sourcePickerOpen,
  setSourcePickerOpen,
  rap,
  categoryPlanItems,
  selectedRapQuotationIds,
  setSelectedRapQuotationIds,
  selectedCategoryQuotationIds,
  setSelectedCategoryQuotationIds,
  manualQuotationLine,
  setManualQuotationLine,
  handleGenerateRab,
  isPending,
  selectedQuotationSourceCount,
  rabEstimate,
}: {
  readonly sourcePickerOpen: boolean;
  readonly setSourcePickerOpen: (open: boolean) => void;
  readonly rap: RapView | null;
  readonly categoryPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly selectedRapQuotationIds: readonly string[];
  readonly setSelectedRapQuotationIds: React.Dispatch<
    React.SetStateAction<string[]>
  >;
  readonly selectedCategoryQuotationIds: readonly string[];
  readonly setSelectedCategoryQuotationIds: React.Dispatch<
    React.SetStateAction<string[]>
  >;
  readonly manualQuotationLine: ManualQuotationLine;
  readonly setManualQuotationLine: React.Dispatch<
    React.SetStateAction<ManualQuotationLine>
  >;
  readonly handleGenerateRab: () => void;
  readonly isPending: boolean;
  readonly selectedQuotationSourceCount: number;
  readonly rabEstimate: RabEstimateView | null;
}): React.JSX.Element {
  const [showManualEntry, setShowManualEntry] = React.useState(
    () => manualQuotationLine.clientLabel.trim().length > 0,
  );

  function toggleSelection(currentIds: readonly string[], id: string): string[] {
    return currentIds.includes(id)
      ? currentIds.filter((currentId) => currentId !== id)
      : [...currentIds, id];
  }

  return (
    <OperationalFormSheet
      open={sourcePickerOpen}
      title={
        rabEstimate?.status === "APPROVED" ? "Buat Revisi RAB" : "Pilih Sumber RAB"
      }
      onClose={() => setSourcePickerOpen(false)}
      submitLabel={rabEstimate?.status === "APPROVED" ? "Revisi" : "Buat"}
      submittingLabel="Membuat draft…"
      pending={isPending}
      disabled={selectedQuotationSourceCount === 0}
      disabledReason={selectedQuotationSourceCount === 0 ? "Pilih minimal satu sumber untuk menyusun RAB." : undefined}
      onSubmit={handleGenerateRab}
      statusText={`${selectedQuotationSourceCount} sumber dipilih · ${selectedRapQuotationIds.length} material · ${selectedCategoryQuotationIds.length} paket`}
      statusTone={selectedQuotationSourceCount > 0 ? "success" : "warning"}
    >
      <div className="space-y-md">
        <FormRiskNotice title={selectedQuotationSourceCount > 0 ? `${selectedQuotationSourceCount} sumber siap disalin` : "Pilih sumber RAB"} tone={selectedQuotationSourceCount > 0 ? "success" : "default"}>
          Sumber hanya disalin sebagai snapshot. Perubahan berikutnya di RAP tidak mengubah RAB ini secara diam-diam.
        </FormRiskNotice>
        {rap && rap.items.length > 0 && (
          <FormSection title="Material RAP" helper={`${selectedRapQuotationIds.length} dari ${rap.items.length} material dipilih.`}>
            <fieldset className="space-y-2">
              {rap.items.map((item) => (
                <ChoiceRow
                  key={item.id}
                  checked={selectedRapQuotationIds.includes(item.id)}
                  onChange={() =>
                    setSelectedRapQuotationIds((current) =>
                      toggleSelection(current, item.id),
                    )
                  }
                  title={item.name}
                  description={`${item.area} - ${item.totalQuantity} ${item.unit}`}
                />
              ))}
            </fieldset>
          </FormSection>
        )}
        {categoryPlanItems.length > 0 && (
          <FormSection title="Paket kerja" helper={`${selectedCategoryQuotationIds.length} paket dipilih. Paket yang belum aktif tidak dapat disalin.`}>
            <fieldset className="space-y-2">
              {categoryPlanItems.map((item) => {
                const ready = item.status === "ACTIVE" || item.status === "LOCKED";
                return (
                  <ChoiceRow
                    key={item.id}
                    disabled={!ready}
                    checked={selectedCategoryQuotationIds.includes(item.id)}
                    onChange={() =>
                      setSelectedCategoryQuotationIds((current) =>
                        toggleSelection(current, item.id),
                      )
                    }
                    title={item.name}
                    description={`${item.expenseCategoryName} - ${
                      ready ? "Siap" : "Aktifkan dahulu"
                    }`}
                  />
                );
              })}
            </fieldset>
          </FormSection>
        )}
        {!rabEstimate && (
          <FormSection title="Item manual" helper="Opsional untuk biaya yang tidak berasal dari RAP atau paket kerja.">
            <div className="mb-sm">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={() => setShowManualEntry((current) => !current)}
                className="flex min-h-12 w-full items-center justify-between rounded-full bg-surface-container-low px-5 text-left text-xs font-bold text-primary ring-1 ring-outline-variant/15"
                aria-expanded={showManualEntry}
              >
                {showManualEntry ? "Sembunyikan item manual" : "Tambahkan item manual"}
                <span className="material-symbols-outlined text-[18px]">{showManualEntry ? "expand_less" : "add"}</span>
              </motion.button>
            </div>
            {showManualEntry ? (
              <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                <FormField label="Nama item">
                  <TextInput
                    value={manualQuotationLine.clientLabel}
                    onChange={(value) =>
                      setManualQuotationLine((curr) => ({
                        ...curr,
                        clientLabel: value,
                      }))
                    }
                    placeholder="Contoh: Biaya koordinasi"
                  />
                </FormField>
                <FormField label="Jumlah">
                  <NumericInput
                    min={0.01}
                    value={manualQuotationLine.quantity}
                    onChange={(value) =>
                      setManualQuotationLine((curr) => ({
                        ...curr,
                        quantity: value,
                      }))
                    }
                  />
                </FormField>
                <ComboboxField
                  label="Satuan"
                  value={manualQuotationLine.unit}
                  onChange={(value) =>
                    setManualQuotationLine((curr) => ({ ...curr, unit: value }))
                  }
                  options={COMMON_UNIT_OPTIONS}
                  placeholder="Pilih satuan"
                />
                <FormField label="Harga satuan klien">
                  <MoneyInput
                    value={manualQuotationLine.unitPrice}
                    onChange={(value) =>
                      setManualQuotationLine((curr) => ({
                        ...curr,
                        unitPrice: value,
                      }))
                    }
                    showPreview={false}
                  />
                </FormField>
              </div>
            ) : null}
          </FormSection>
        )}
      </div>
    </OperationalFormSheet>
  );
}

export function ManualRabLineDrawer({
  manualLineOpen,
  setManualLineOpen,
  manualQuotationLine,
  setManualQuotationLine,
  handleAddManualRabItem,
  isPending,
}: {
  readonly manualLineOpen: boolean;
  readonly setManualLineOpen: (open: boolean) => void;
  readonly manualQuotationLine: ManualQuotationLine;
  readonly setManualQuotationLine: React.Dispatch<
    React.SetStateAction<ManualQuotationLine>
  >;
  readonly handleAddManualRabItem: () => void;
  readonly isPending: boolean;
}): React.JSX.Element {
  return (
    <OperationalFormSheet
      open={manualLineOpen}
      title="Tambah Item Manual"
      onClose={() => setManualLineOpen(false)}
      submitLabel="Tambah"
      submittingLabel="Menambahkan…"
      pending={isPending}
      disabled={manualQuotationLine.clientLabel.trim().length < 3 || Number(manualQuotationLine.quantity) <= 0}
      disabledReason={manualQuotationLine.clientLabel.trim().length < 3 ? "Isi nama item minimal 3 karakter." : Number(manualQuotationLine.quantity) <= 0 ? "Jumlah harus lebih dari 0." : undefined}
      onSubmit={handleAddManualRabItem}
      statusText={`${manualQuotationLine.clientLabel.trim() || "Item belum diisi"} · ${manualQuotationLine.quantity || 0} ${manualQuotationLine.unit} · Rp ${(Number(manualQuotationLine.quantity) * Number(manualQuotationLine.unitPrice)).toLocaleString("id-ID")}`}
      statusTone={manualQuotationLine.clientLabel.trim().length >= 3 && Number(manualQuotationLine.quantity) > 0 ? "success" : "warning"}
    >
      <div className="space-y-md">
        <FormSection title="Tampilan untuk klien" helper="Gunakan nama yang singkat dan mudah dipahami tanpa konteks internal.">
          <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
            <FormField label="Nama item">
              <TextInput
                value={manualQuotationLine.clientLabel}
                onChange={(value) =>
                  setManualQuotationLine((curr) => ({ ...curr, clientLabel: value }))
                }
                placeholder="Contoh: Biaya koordinasi"
              />
            </FormField>
            <FormField label="Deskripsi untuk klien">
              <Textarea
                rows={3}
                value={manualQuotationLine.description || ""}
                onChange={(value) =>
                  setManualQuotationLine((curr) => ({ ...curr, description: value }))
                }
                placeholder="Jelaskan lingkup secara singkat"
              />
            </FormField>
          </div>
        </FormSection>
        <FormSection title="Jumlah & harga" helper="Subtotal muncul langsung di ringkasan bawah sebelum item ditambahkan.">
          <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
            <FormField label="Jumlah">
              <NumericInput
                min={0.01}
                value={manualQuotationLine.quantity}
                onChange={(value) =>
                  setManualQuotationLine((curr) => ({ ...curr, quantity: value }))
                }
              />
            </FormField>
            <ComboboxField
              label="Satuan"
              value={manualQuotationLine.unit}
              onChange={(value) =>
                setManualQuotationLine((curr) => ({ ...curr, unit: value }))
              }
              options={COMMON_UNIT_OPTIONS}
              placeholder="Pilih satuan"
            />
            <FormField label="Harga satuan klien">
              <MoneyInput
                value={manualQuotationLine.unitPrice}
                onChange={(value) =>
                  setManualQuotationLine((curr) => ({ ...curr, unitPrice: value }))
                }
                showPreview={false}
              />
            </FormField>
          </div>
        </FormSection>
      </div>
    </OperationalFormSheet>
  );
}
