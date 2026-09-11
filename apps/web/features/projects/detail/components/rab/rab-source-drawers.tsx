"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  ChoiceRow,
  ComboboxField,
  COMMON_UNIT_OPTIONS,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  NumericInput,
  OperationalFormSheet,
  SwitchRow,
  Textarea,
  TextInput,
  useFormDirtySnapshot,
} from "@/components/ui";
import { transitionSpringSmooth } from "@/lib/utils/motion";
import type {
  ManualQuotationLine,
  ProjectCategoryPlanItemView,
  RabEstimateView,
  RapView,
} from "../shared/rap-rab-manager";
import { isRabManualSourceType } from "../../types/rap-rab-types";

export function RabSourcePickerDrawer({
  sourcePickerOpen,
  setSourcePickerOpen,
  rap,
  categoryPlanItems,
  selectedRapQuotationIds,
  setSelectedRapQuotationIds,
  selectedCategoryQuotationIds,
  setSelectedCategoryQuotationIds,
  selectedBaselineManualItemIds,
  setSelectedBaselineManualItemIds,
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
  readonly selectedBaselineManualItemIds?: readonly string[];
  readonly setSelectedBaselineManualItemIds?: React.Dispatch<React.SetStateAction<string[]>>;
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
  const dirty = useFormDirtySnapshot(
    sourcePickerOpen,
    rabEstimate?.id ?? "new-rab-source",
    JSON.stringify({
      selectedRapQuotationIds,
      selectedCategoryQuotationIds,
      selectedBaselineManualItemIds,
      manualQuotationLine,
      showManualEntry,
    }),
  );

  const baselineManualItems = React.useMemo(
    () =>
      rabEstimate?.items.filter((item) => isRabManualSourceType(item.sourceType)) ?? [],
    [rabEstimate],
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
      dismissal={{
        mode: "confirm",
        dirty,
        onDiscard: () => undefined,
        description: "Pilihan sumber RAB yang belum diproses akan hilang.",
      }}
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
      statusText={
        (selectedBaselineManualItemIds?.length ?? 0) > 0
          ? `${selectedQuotationSourceCount} sumber dipilih · ${selectedRapQuotationIds.length} material · ${selectedCategoryQuotationIds.length} paket · ${selectedBaselineManualItemIds?.length ?? 0} manual/jasa`
          : `${selectedQuotationSourceCount} sumber dipilih · ${selectedRapQuotationIds.length} material · ${selectedCategoryQuotationIds.length} paket`
      }
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
        {baselineManualItems.length > 0 && (
          <FormSection
            title="Item manual & jasa"
            helper={`${selectedBaselineManualItemIds?.length ?? 0} dari ${baselineManualItems.length} item manual/jasa dipilih dari RAB baseline.`}
          >
            <fieldset className="space-y-2">
              {baselineManualItems.map((item) => {
                const isSelected =
                  selectedBaselineManualItemIds?.includes(item.id) ?? true;
                const natureBadge =
                  item.itemNature === "SERVICE_FEE" ? "Jasa & Fee" : "Pekerjaan Fisik";
                const lineTotalFormatted = `Rp ${Number(item.lineTotal).toLocaleString("id-ID")}`;
                return (
                  <ChoiceRow
                    key={item.id}
                    checked={isSelected}
                    onChange={() =>
                      setSelectedBaselineManualItemIds?.((current) =>
                        toggleSelection(current, item.id),
                      )
                    }
                    title={item.clientLabel}
                    description={`${natureBadge} · ${item.quantity} ${item.unit} · ${lineTotalFormatted}`}
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
            <SwitchRow
              checked={showManualEntry}
              onChange={handleToggleManualEntry}
              title="Tambahkan item manual"
              description="Masukkan baris quotation kustom tambahan yang aman untuk klien."
            />
            <AnimatePresence initial={false}>
              {showManualEntry && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={transitionSpringSmooth}
                  className="overflow-hidden"
                >
                  <div className="divide-y divide-outline-variant/20">
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
                      />
                    </FormField>
                    <fieldset className="min-w-0 space-y-1 bg-surface-container-lowest px-4 py-3">
                      <legend className="text-meta font-bold tracking-[0.08em] text-on-surface uppercase">
                        Sifat item
                      </legend>
                      <div role="radiogroup" aria-label="Sifat item" className="space-y-1.5 pt-1">
                        <ChoiceRow
                          checked={
                            (manualQuotationLine.itemNature ?? "PRODUCTION") === "PRODUCTION"
                          }
                          onChange={() =>
                            setManualQuotationLine((curr) => ({
                              ...curr,
                              itemNature: "PRODUCTION",
                            }))
                          }
                          title="Pekerjaan Fisik Tambahan"
                          description="Masuk ke pagu belanja fisik lapangan (Material/Tukang/Subcon)."
                          selectionMode="radio"
                        />
                        <ChoiceRow
                          checked={manualQuotationLine.itemNature === "SERVICE_FEE"}
                          onChange={() =>
                            setManualQuotationLine((curr) => ({
                              ...curr,
                              itemNature: "SERVICE_FEE",
                            }))
                          }
                          title="Jasa Desain & Manajemen Fee"
                          description="100% margin kotor studio, tidak menaikkan pagu belanja lapangan."
                          selectionMode="radio"
                        />
                      </div>
                    </fieldset>
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
  const dirty = useFormDirtySnapshot(
    manualLineOpen,
    "manual-rab-line",
    JSON.stringify(manualQuotationLine),
  );
  return (
    <OperationalFormSheet
      dismissal={{
        mode: "confirm",
        dirty,
        onDiscard: () => undefined,
        description: "Item manual yang belum ditambahkan akan hilang.",
      }}
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
        </FormSection>
        <FormSection
          title="Jumlah & harga"
          helper="Subtotal muncul langsung di ringkasan bawah sebelum item ditambahkan."
        >
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
            />
          </FormField>
        </FormSection>
        <FormSection
          title="Sifat komponen biaya"
          helper="Tentukan apakah item ini membutuhkan belanja fisik lapangan atau jasa keahlian."
        >
          <div className="space-y-1.5 p-3">
            <ChoiceRow
              checked={(manualQuotationLine.itemNature ?? "PRODUCTION") === "PRODUCTION"}
              onChange={() =>
                setManualQuotationLine((curr) => ({ ...curr, itemNature: "PRODUCTION" }))
              }
              title="Pekerjaan Fisik Tambahan"
              description="Memerlukan belanja material/tukang. Masuk ke pagu belanja fisik lapangan."
            />
            <ChoiceRow
              checked={manualQuotationLine.itemNature === "SERVICE_FEE"}
              onChange={() =>
                setManualQuotationLine((curr) => ({ ...curr, itemNature: "SERVICE_FEE" }))
              }
              title="Jasa Desain & Manajemen Fee"
              description="Jasa profesional studio. 100% margin kotor tanpa menambah pagu belanja lapangan."
            />
          </div>
        </FormSection>
      </div>
    </OperationalFormSheet>
  );
}
