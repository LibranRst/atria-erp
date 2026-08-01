import React from "react";
import { SlidersHorizontal } from "lucide-react";
import type { SettingsOption, MaterialDraft } from "../../types/material-types";
import {
  ComboboxField,
  COMMON_UNIT_OPTIONS,
  FormDisclosure,
  FormField,
  FormSection,
  MoneyInput,
  NumericInput,
  OperationalFormSheet,
  SheetSelect,
  Textarea,
  TextInput,
} from "@/components/ui";
type MaterialEditorSheetProps = {
  readonly draft: MaterialDraft | null;
  readonly categories: readonly SettingsOption[];
  readonly vendors: readonly SettingsOption[];
  readonly locations: readonly SettingsOption[];
  readonly canManage: boolean;
  readonly pending: boolean;
  readonly canSave: boolean;
  readonly disabledReason: string | undefined;
  readonly completion: readonly [number, number];
  readonly detailsOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly onDraftChange: (draft: MaterialDraft) => void;
  readonly onDetailsOpenChange: (open: boolean) => void;
  readonly onCreateCategory: () => void;
};

export function MaterialEditorSheet({
  draft,
  categories,
  vendors,
  locations,
  canManage,
  pending,
  canSave,
  disabledReason,
  completion,
  detailsOpen,
  onClose,
  onSubmit,
  onDraftChange,
  onDetailsOpenChange,
  onCreateCategory,
}: MaterialEditorSheetProps): React.JSX.Element {
  const completedDetails = draft
    ? [draft.brand, draft.code, draft.color, draft.defaultVendorId, draft.specification].filter(
        Boolean,
      ).length
    : 0;
  return (
    <OperationalFormSheet
      open={Boolean(draft)}
      title={draft?.id ? "Edit Material" : "Tambah Material"}
      onClose={onClose}
      pending={pending}
      disabled={!canManage || !canSave}
      disabledReason={disabledReason}
      submitLabel="Simpan"
      submittingLabel="Menyimpan…"
      onSubmit={onSubmit}
      statusText={
        draft
          ? `${completion[0]} dari ${completion[1]} data wajib lengkap${draft.name.trim() ? ` · ${draft.name.trim()}` : ""}`
          : undefined
      }
      statusTone={canSave ? "success" : "warning"}
    >
      {draft ? (
        <div className="space-y-md">
          <FormSection
            title="Identitas utama"
            helper="Nama, kategori, dan satuan dipakai di RAP, stok, dan transaksi."
          >
            <SheetSelect
              label="Kategori material"
              value={draft.categoryId}
              onChange={(value) => onDraftChange({ ...draft, categoryId: value })}
              options={categories.map((row) => ({ value: row.id, label: row.name }))}
              createActionLabel="Buat kategori material"
              createActionDescription="Tambahkan kategori baru ke daftar pilihan."
              onCreateAction={canManage ? onCreateCategory : undefined}
            />
            <FormField
              label="Nama material"
              required
              error={!draft.name.trim() ? "Nama material wajib diisi." : undefined}
            >
              <TextInput
                value={draft.name}
                onChange={(value) => onDraftChange({ ...draft, name: value })}
                aria-invalid={!draft.name.trim()}
              />
            </FormField>
            <ComboboxField
              label="Satuan"
              value={draft.unit}
              onChange={(value) => onDraftChange({ ...draft, unit: value })}
              options={COMMON_UNIT_OPTIONS}
              error={!draft.unit.trim() ? "Satuan wajib diisi." : undefined}
            />
          </FormSection>
          <FormDisclosure
            variant="compact"
            title="Detail material"
            description="Merek, kode, warna, vendor, dan spesifikasi"
            summary={completedDetails > 0 ? `${completedDetails} terisi` : "Opsional"}
            icon={<SlidersHorizontal className="h-4 w-4" />}
            expanded={detailsOpen}
            onToggle={() => onDetailsOpenChange(!detailsOpen)}
          >
            <FormSection
              title="Informasi pembelian"
              helper="Isi hanya data yang membantu pencarian atau pembelian berulang."
            >
              <FormField label="Merek" optional>
                <TextInput
                  value={draft.brand}
                  onChange={(value) => onDraftChange({ ...draft, brand: value })}
                />
              </FormField>
              <FormField label="Kode" optional>
                <TextInput
                  value={draft.code}
                  onChange={(value) => onDraftChange({ ...draft, code: value })}
                />
              </FormField>
              <FormField label="Warna" optional>
                <TextInput
                  value={draft.color}
                  onChange={(value) => onDraftChange({ ...draft, color: value })}
                />
              </FormField>
              <SheetSelect
                label="Vendor default"
                value={draft.defaultVendorId ?? ""}
                onChange={(value) => onDraftChange({ ...draft, defaultVendorId: value || null })}
                options={[
                  { value: "", label: "Tanpa vendor default" },
                  ...vendors.map((row) => ({ value: row.id, label: row.name })),
                ]}
              />
              <FormField label="Spesifikasi" optional>
                <Textarea
                  value={draft.specification}
                  onChange={(value) => onDraftChange({ ...draft, specification: value })}
                  rows={2}
                />
              </FormField>
            </FormSection>
          </FormDisclosure>
          {!draft.id ? (
            <FormSection
              title="Default inventori awal"
              helper="Pilih lokasi; stok minimum dan harga acuan boleh tetap nol."
            >
              <SheetSelect
                label="Lokasi"
                value={draft.locationId}
                onChange={(value) => onDraftChange({ ...draft, locationId: value })}
                options={locations.map((row) => ({ value: row.id, label: row.name }))}
                error={
                  !draft.locationId
                    ? "Lokasi awal wajib dipilih agar stok tidak masuk tempat yang salah."
                    : undefined
                }
              />
              <FormField label="Stok minimum">
                <NumericInput
                  min={0}
                  value={draft.minimumStock}
                  onChange={(value) =>
                    onDraftChange({ ...draft, minimumStock: Number(value || 0) })
                  }
                />
              </FormField>
              <FormField label="Harga acuan">
                <MoneyInput
                  value={draft.lastPurchasePrice}
                  onChange={(value) =>
                    onDraftChange({ ...draft, lastPurchasePrice: Number(value || 0) })
                  }
                />
              </FormField>
            </FormSection>
          ) : null}
        </div>
      ) : null}
    </OperationalFormSheet>
  );
}
