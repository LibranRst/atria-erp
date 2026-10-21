import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type { SettingsOption, MaterialDraft } from "../../types/material-types";
import {
  AppIcon,
  ComboboxField,
  COMMON_UNIT_OPTIONS,
  FactRow,
  FormDisclosure,
  FormField,
  FormSection,
  GroupedSurface,
  MoneyInput,
  MoneyValue,
  NumericInput,
  OperationalFormSheet,
  AdaptiveSelect,
  Textarea,
  TextInput,
} from "@/components/ui";

type MaterialEditorSheetProps = {
  readonly draft: MaterialDraft | null;
  readonly categories: readonly SettingsOption[];
  readonly vendors: readonly SettingsOption[];
  readonly locations: readonly SettingsOption[];
  readonly unitOptions?: readonly string[];
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
  readonly onCreateLocation?: () => void;
  readonly onCreateVendor?: () => void;
};

export function MaterialEditorSheet({
  draft,
  categories,
  vendors,
  locations,
  unitOptions,
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
  onCreateLocation,
  onCreateVendor,
}: MaterialEditorSheetProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const completedDetails = draft
    ? [draft.brand, draft.code, draft.color, draft.defaultVendorId, draft.specification].filter(
        Boolean,
      ).length
    : 0;
  return (
    <OperationalFormSheet
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={
        draft ? (
          <div className="space-y-4">
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                <FactRow
                  layout="stacked"
                  label="Material"
                  wrapLabel
                  value={draft.name.trim() || "Nama belum diisi"}
                />
                <FactRow
                  layout="stacked"
                  label="Kategori"
                  wrapLabel
                  value={
                    categories.find((row) => row.id === draft.categoryId)?.name ?? "Belum dipilih"
                  }
                />
                <FactRow
                  layout="stacked"
                  label="Satuan"
                  wrapLabel
                  value={draft.unit || "Belum diisi"}
                />
                <FactRow
                  layout="stacked"
                  label="Vendor default"
                  wrapLabel
                  value={
                    draft.defaultVendorId
                      ? (vendors.find((row) => row.id === draft.defaultVendorId)?.name ??
                        "Vendor tidak tersedia")
                      : "Tanpa vendor default"
                  }
                />
                {!draft.id ? (
                  <>
                    <FactRow
                      layout="stacked"
                      label="Lokasi awal"
                      wrapLabel
                      value={
                        locations.find((row) => row.id === draft.locationId)?.name ??
                        "Belum dipilih"
                      }
                    />
                    <FactRow
                      layout="stacked"
                      label="Stok minimum"
                      wrapLabel
                      value={`${draft.minimumStock.toLocaleString("id-ID")} ${draft.unit}`}
                    />
                    <FactRow
                      layout="stacked"
                      label="Harga acuan"
                      wrapLabel
                      value={
                        <MoneyValue
                          fractionDigits={Number.isInteger(draft.lastPurchasePrice) ? 0 : 2}
                          amount={draft.lastPurchasePrice}
                          variant="fullDynamic"
                          size="sm"
                        />
                      }
                    />
                  </>
                ) : null}
                <FactRow
                  layout="stacked"
                  label="Data utama lengkap"
                  wrapLabel
                  value={`${completion[0]} dari ${completion[1]}`}
                />
              </div>
            </GroupedSurface>
            <p className="text-support leading-relaxed text-on-surface-variant">
              {draft.id
                ? "Perubahan memperbarui identitas dan konteks pembelian material."
                : "Material baru menyiapkan inventori bersaldo nol di lokasi awal."}{" "}
              Stok fisik dan pembayaran dicatat melalui operasi terpisah.
            </p>
          </div>
        ) : undefined
      }
      dismissal={{ mode: "managed" }}
      open={Boolean(draft)}
      title={draft?.id ? "Edit material" : "Material baru"}
      submitLabel="Simpan"
      submittingLabel="Menyimpan…"
      pending={pending}
      disabled={!canSave}
      disabledReason={disabledReason}
      statusText={
        draft && !desktop ? `${completion[0]} dari ${completion[1]} data utama lengkap` : undefined
      }
      statusTone={canSave ? "success" : "warning"}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {draft ? (
        <div className="space-y-md">
          <FormSection
            title="Informasi utama"
            helper="Kategori, nama, dan satuan wajib diisi untuk identifikasi stok."
          >
            <AdaptiveSelect
              label="Kategori"
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
              options={unitOptions ?? COMMON_UNIT_OPTIONS}
              error={!draft.unit.trim() ? "Satuan wajib diisi." : undefined}
            />
          </FormSection>
          <FormDisclosure
            variant="compact"
            title="Detail material"
            description="Merek, kode, warna, vendor, dan spesifikasi"
            summary={completedDetails > 0 ? `${completedDetails} terisi` : "Opsional"}
            icon={<AppIcon name="tune" className="icon-sm" />}
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
              <AdaptiveSelect
                label="Vendor default"
                value={draft.defaultVendorId ?? ""}
                onChange={(value) => onDraftChange({ ...draft, defaultVendorId: value || null })}
                options={[
                  { value: "", label: "Tanpa vendor default" },
                  ...vendors.map((row) => ({ value: row.id, label: row.name })),
                ]}
                createActionLabel="Buat vendor baru"
                createActionDescription="Tambahkan vendor baru ke daftar pilihan."
                onCreateAction={canManage ? onCreateVendor : undefined}
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
              <AdaptiveSelect
                label="Lokasi"
                value={draft.locationId}
                onChange={(value) => onDraftChange({ ...draft, locationId: value })}
                options={locations.map((row) => ({ value: row.id, label: row.name }))}
                createActionLabel="Buat lokasi baru"
                createActionDescription="Tambahkan lokasi gudang atau workshop baru."
                onCreateAction={canManage ? onCreateLocation : undefined}
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
