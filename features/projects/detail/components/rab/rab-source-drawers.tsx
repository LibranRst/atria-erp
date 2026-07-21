"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  SwitchRow,
  Textarea,
  TextInput,
} from "@/components/ui";
import { transitionSpringSmooth, transitionSpringSnappy } from "@/lib/utils/motion";
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
  readonly setSelectedRapQuotationIds: React.Dispatch<React.SetStateAction<string[]>>;
  readonly selectedCategoryQuotationIds: readonly string[];
  readonly setSelectedCategoryQuotationIds: React.Dispatch<React.SetStateAction<string[]>>;
  readonly manualQuotationLine: ManualQuotationLine;
  readonly setManualQuotationLine: React.Dispatch<React.SetStateAction<ManualQuotationLine>>;
  readonly handleGenerateRab: () => void;
  readonly isPending: boolean;
  readonly selectedQuotationSourceCount: number;
  readonly rabEstimate: RabEstimateView | null;
}): React.JSX.Element {
  const [showManualEntry, setShowManualEntry] = React.useState(
    () => manualQuotationLine.clientLabel.trim().length > 0,
  );

  function handleToggleManualEntry(checked: boolean): void {
    setShowManualEntry(checked);
    if (!checked) {
      setManualQuotationLine({
        clientLabel: "",
        description: "",
        quantity: "1.00",
        unit: "ls",
        unitPrice: "0.00",
      });
    }
  }

  function toggleSelection(currentIds: readonly string[], id: string): string[] {
    return currentIds.includes(id)
      ? currentIds.filter((currentId) => currentId !== id)
      : [...currentIds, id];
  }

  return (
    <OperationalFormSheet
      open={sourcePickerOpen}
      title={rabEstimate?.status === "APPROVED" ? "Buat Revisi RAB" : "Pilih Sumber RAB"}
      onClose={() => setSourcePickerOpen(false)}
      submitLabel={rabEstimate?.status === "APPROVED" ? "Revisi" : "Buat"}
      submittingLabel="Membuat draft…"
      pending={isPending}
      disabled={selectedQuotationSourceCount === 0}
      disabledReason={
        selectedQuotationSourceCount === 0
          ? "Pilih minimal satu sumber untuk menyusun RAB."
          : undefined
      }
      onSubmit={handleGenerateRab}
      statusText={`${selectedQuotationSourceCount} sumber dipilih · ${selectedRapQuotationIds.length} material · ${selectedCategoryQuotationIds.length} paket`}
      statusTone={selectedQuotationSourceCount > 0 ? "success" : "warning"}
    >
      <div className="space-y-md">
        <FormRiskNotice
          title={
            selectedQuotationSourceCount > 0
              ? `${selectedQuotationSourceCount} sumber siap disalin`
              : "Pilih sumber RAB"
          }
          tone={selectedQuotationSourceCount > 0 ? "success" : "default"}
        >
          Sumber hanya disalin sebagai snapshot. Perubahan berikutnya di RAP tidak mengubah RAB ini
          secara diam-diam.
        </FormRiskNotice>
        {rap && rap.items.length > 0 && (
          <FormSection
            title="Material RAP"
            helper={`${selectedRapQuotationIds.length} dari ${rap.items.length} material dipilih.`}
          >
            <fieldset className="space-y-2">
              {rap.items.map((item) => (
                <ChoiceRow
                  key={item.id}
                  checked={selectedRapQuotationIds.includes(item.id)}
                  onChange={() =>
                    setSelectedRapQuotationIds((current) => toggleSelection(current, item.id))
                  }
                  title={item.name}
                  description={`${item.area} - ${item.totalQuantity} ${item.unit}`}
                />
              ))}
            </fieldset>
          </FormSection>
        )}
        {categoryPlanItems.length > 0 && (
          <FormSection
            title="Paket kerja"
            helper={`${selectedCategoryQuotationIds.length} paket dipilih. Paket yang belum aktif tidak dapat disalin.`}
          >
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
          <FormSection
            title="Item manual"
            helper="Opsional untuk biaya yang tidak berasal dari RAP atau paket kerja."
          >
            <div className="bg-surface-container-lowest px-4 py-3">
              <SwitchRow
                checked={showManualEntry}
                onChange={handleToggleManualEntry}
                title="Tambahkan item manual"
                description="Masukkan baris quotation kustom tambahan yang aman untuk klien."
              />
            </div>
            <AnimatePresence initial={false}>
              {showManualEntry && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={transitionSpringSmooth}
                  className="overflow-hidden"
                >
                  <div className="divide-outline-variant/20 border-outline-variant/20 grid grid-cols-1 divide-y border-t">
                    <FormField label="Nama item" required>
                      <TextInput
                        value={manualQuotationLine.clientLabel}
                        onChange={(value) =>
                          setManualQuotationLine((curr) => ({
                            ...curr,
                            clientLabel: value,
                          }))
                        }
                        placeholder="Contoh: Koordinasi Design"
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
                </motion.div>
              )}
            </AnimatePresence>
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
  readonly setManualQuotationLine: React.Dispatch<React.SetStateAction<ManualQuotationLine>>;
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
      disabled={
        manualQuotationLine.clientLabel.trim().length < 3 ||
        Number(manualQuotationLine.quantity) <= 0
      }
      disabledReason={
        manualQuotationLine.clientLabel.trim().length < 3
          ? "Isi nama item minimal 3 karakter."
          : Number(manualQuotationLine.quantity) <= 0
            ? "Jumlah harus lebih dari 0."
            : undefined
      }
      onSubmit={handleAddManualRabItem}
      statusText={`${manualQuotationLine.clientLabel.trim() || "Item belum diisi"} · ${manualQuotationLine.quantity || 0} ${manualQuotationLine.unit} · Rp ${(Number(manualQuotationLine.quantity) * Number(manualQuotationLine.unitPrice)).toLocaleString("id-ID")}`}
      statusTone={
        manualQuotationLine.clientLabel.trim().length >= 3 &&
        Number(manualQuotationLine.quantity) > 0
          ? "success"
          : "warning"
      }
    >
      <div className="space-y-md">
        <FormSection
          title="Tampilan untuk klien"
          helper="Gunakan nama yang singkat dan mudah dipahami tanpa konteks internal."
        >
          <div className="divide-outline-variant/20 grid grid-cols-1 divide-y">
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
        <FormSection
          title="Jumlah & harga"
          helper="Subtotal muncul langsung di ringkasan bawah sebelum item ditambahkan."
        >
          <div className="divide-outline-variant/20 grid grid-cols-1 divide-y">
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
              onChange={(value) => setManualQuotationLine((curr) => ({ ...curr, unit: value }))}
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
