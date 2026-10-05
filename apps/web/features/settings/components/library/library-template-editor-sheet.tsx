"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { motion } from "framer-motion";
import type { ExpenseCategorySettingRow } from "@/app/actions/settings/system";
import {
  AppIcon,
  Button,
  PageHeader,
  ComboboxField,
  COMMON_UNIT_OPTIONS,
  DatePickerField,
  FormDisclosure,
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
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import type {
  CostComponentDraft,
  Draft,
  ItemType,
  MaterialOption,
  VendorOption,
} from "../../types/library-types";

type Props = {
  readonly draft: Draft | null;
  readonly categories: readonly ExpenseCategorySettingRow[];
  readonly materials: readonly MaterialOption[];
  readonly vendors: readonly VendorOption[];
  readonly unitOptions?: readonly string[];
  readonly canManage: boolean;
  readonly pending: boolean;
  readonly canSave: boolean;
  readonly disabledReason: string | undefined;
  readonly internalCost: number;
  readonly clientPrice: number;
  readonly grossMargin: number;
  readonly dirty: boolean;
  readonly nameTouched: boolean;
  readonly sourceTouched: boolean;
  readonly sourceOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly onDraftChange: (draft: Draft) => void;
  readonly onItemTypeChange: (type: ItemType) => void;
  readonly onAddComponent: () => void;
  readonly onOpenComponent: (component: CostComponentDraft) => void;
  readonly onNameTouched: () => void;
  readonly onSourceTouched: () => void;
  readonly onSourceOpenChange: (open: boolean) => void;
  readonly onRequestToggle: () => void;
};
const componentLabels: Readonly<Record<CostComponentDraft["componentType"], string>> = {
  LABOR: "Tenaga kerja",
  MATERIAL: "Material",
  EQUIPMENT: "Peralatan",
  LOGISTICS: "Logistik",
  OVERHEAD: "Overhead",
  OTHER: "Lainnya",
};
const money = (value: number): string => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
const sourceLabel = (value: Draft["priceSourceType"]): string =>
  ({
    COST_BREAKDOWN: "Rincian biaya",
    VENDOR_QUOTE: "Penawaran vendor",
    HISTORICAL: "Riwayat harga",
    LEGACY_BACKFILL: "Data lama",
  })[value];

export function LibraryTemplateEditorSheet({
  draft,
  categories,
  materials,
  vendors,
  unitOptions,
  canManage,
  pending,
  canSave,
  disabledReason,
  internalCost,
  clientPrice,
  grossMargin,
  dirty,
  nameTouched,
  sourceTouched,
  sourceOpen,
  onClose,
  onSubmit,
  onDraftChange,
  onItemTypeChange,
  onAddComponent,
  onOpenComponent,
  onNameTouched,
  onSourceTouched,
  onSourceOpenChange,
  onRequestToggle,
}: Props): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const content = (
    <>
      {draft ? (
        <div className={desktop ? "grid items-start gap-6 xl:grid-cols-2" : "space-y-md"}>
          <FormSection
            title="Identitas template"
            helper="Tipe menentukan konteks dan kategori budget yang digunakan."
          >
            <AdaptiveSelect
              label="Tipe item"
              value={draft.itemType}
              onChange={(value) => onItemTypeChange(value as ItemType)}
              options={[
                { value: "CLIENT_LINE", label: "Baris Klien" },
                { value: "MATERIAL_ITEM", label: "Material" },
                { value: "WORK_PACKAGE", label: "Paket Tukang" },
                { value: "SUBCON_PACKAGE", label: "Paket Subcon" },
              ]}
            />
            <AdaptiveSelect
              label="Kategori pengeluaran"
              readOnly={draft.itemType !== "CLIENT_LINE"}
              value={draft.expenseCategoryId}
              onChange={(value) => onDraftChange({ ...draft, expenseCategoryId: value })}
              options={categories.map((row) => ({
                value: row.id,
                label: row.name,
                description: row.code,
              }))}
            />
            <FormField
              label="Nama template"
              required
              error={
                nameTouched && draft.name.trim().length < 2
                  ? "Nama template minimal 2 karakter."
                  : undefined
              }
            >
              <TextInput
                value={draft.name}
                onChange={(value) => {
                  onNameTouched();
                  onDraftChange({ ...draft, name: value });
                }}
                aria-invalid={nameTouched && draft.name.trim().length < 2}
              />
            </FormField>
            <FormField
              label="Kategori item"
              required
              error={
                draft.itemCategory.trim().length < 2
                  ? "Kategori item minimal 2 karakter."
                  : undefined
              }
            >
              <TextInput
                value={draft.itemCategory}
                onChange={(value) => onDraftChange({ ...draft, itemCategory: value })}
                aria-invalid={draft.itemCategory.trim().length < 2}
              />
            </FormField>
            <ComboboxField
              label="Satuan"
              value={draft.unit}
              onChange={(value) => onDraftChange({ ...draft, unit: value })}
              options={unitOptions ?? COMMON_UNIT_OPTIONS}
              error={!draft.unit.trim() ? "Satuan wajib diisi." : undefined}
            />
            {draft.itemType === "MATERIAL_ITEM" ? (
              <AdaptiveSelect
                label="Tautan Material Master"
                value={draft.materialId ?? ""}
                onChange={(value) => onDraftChange({ ...draft, materialId: value || null })}
                options={[
                  { value: "", label: "Tanpa tautan material" },
                  ...materials
                    .filter((row) => row.isActive)
                    .map((row) => ({ value: row.id, label: row.name })),
                ]}
              />
            ) : null}
          </FormSection>
          <FormSection
            title="Rincian biaya"
            helper={`${draft.components.length} komponen membentuk biaya internal.`}
            action={
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={onAddComponent}
                className="flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-meta font-semibold text-accent outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <AppIcon name="add_circle" className="icon-sm" aria-hidden="true" /> Tambah
              </motion.button>
            }
          >
            {draft.components.map((component, index) => {
              const complete =
                component.label.trim().length >= 2 &&
                component.quantity > 0 &&
                Boolean(component.unit.trim());
              return (
                <motion.button
                  key={component.key}
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  transition={transitionSpringSnappy}
                  onClick={() => onOpenComponent(component)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:bg-surface-container-low"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${complete ? "bg-primary" : "bg-warning"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs leading-[1.15] font-bold text-on-surface">
                      {component.label.trim() || `Komponen ${index + 1}`}
                    </span>
                    <span className="mt-1 block truncate text-[10px] leading-[1.2] text-on-surface-variant">
                      {component.quantity} {component.unit} ·{" "}
                      {componentLabels[component.componentType]} ·{" "}
                      {complete ? "Lengkap" : "Perlu diperiksa"}
                    </span>
                  </span>
                  <span className="max-w-[32%] shrink-0 truncate text-right text-xs font-bold text-on-surface tabular-nums">
                    {money(component.quantity * component.unitCost)}
                  </span>
                  <AppIcon
                    name="chevron_right"
                    className="icon-md shrink-0 text-on-surface-variant"
                  />
                </motion.button>
              );
            })}
          </FormSection>
          <FormSection
            title="Harga untuk klien"
            helper="Rekomendasi harga dan margin dihitung dari total komponen."
          >
            <AdaptiveSelect
              label="Metode harga"
              value={draft.pricingMode}
              onChange={(value) =>
                onDraftChange({ ...draft, pricingMode: value as Draft["pricingMode"] })
              }
              options={[
                {
                  value: "MARGIN_BASED",
                  label: "Berdasarkan margin",
                  description: "Harga klien mengikuti target margin.",
                },
                {
                  value: "FIXED_CLIENT_PRICE",
                  label: "Harga tetap",
                  description: "Masukkan nominal jual secara langsung.",
                },
              ]}
            />
            {draft.pricingMode === "MARGIN_BASED" ? (
              <FormField label="Target margin kotor (%)">
                <NumericInput
                  min={0}
                  max={95}
                  value={draft.targetGrossPercentage * 100}
                  onChange={(value) =>
                    onDraftChange({ ...draft, targetGrossPercentage: Number(value || 0) / 100 })
                  }
                  suffix="%"
                />
              </FormField>
            ) : (
              <FormField label="Harga tetap untuk klien">
                <MoneyInput
                  value={draft.fixedClientPrice}
                  onChange={(value) =>
                    onDraftChange({ ...draft, fixedClientPrice: Number(value || 0) })
                  }
                />
              </FormField>
            )}
            <div className="p-3">
              <div className="overflow-hidden rounded-inset bg-surface-container-low ring-1 ring-ring-subtle">
                <div className="grid grid-cols-2 divide-x divide-outline-variant/20">
                  <div className="min-w-0 p-3">
                    <p className="truncate text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                      Biaya internal
                    </p>
                    <MoneyValue
                      amount={internalCost}
                      variant="compact"
                      size="sm"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="min-w-0 p-3">
                    <p className="truncate text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                      Harga klien
                    </p>
                    <MoneyValue
                      amount={clientPrice}
                      variant="compact"
                      size="sm"
                      tone="primary"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="flex min-h-11 items-center justify-between gap-3 border-t border-outline-variant/20 px-3 py-2.5">
                  <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                    Margin kotor
                  </p>
                  <p
                    className={`shrink-0 text-sm font-bold tabular-nums ${grossMargin < 0 ? "text-error" : "text-primary"}`}
                  >
                    {grossMargin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                  </p>
                </div>
              </div>
            </div>
            {grossMargin < 0 ? (
              <FormRiskNotice title="Harga di bawah biaya" tone="danger">
                Naikkan harga klien atau periksa kembali rincian biaya sebelum menyimpan.
              </FormRiskNotice>
            ) : null}
          </FormSection>
          <FormDisclosure
            variant="compact"
            title="Sumber harga & detail"
            description="Tanggal dan catatan sumber wajib; detail lain opsional"
            summary={
              draft.sourceNote.trim().length >= 3
                ? `${sourceLabel(draft.priceSourceType)} · sumber terisi`
                : "Catatan sumber belum lengkap"
            }
            icon={<AppIcon name="file_search" className="icon-sm" />}
            expanded={sourceOpen}
            onToggle={() => onSourceOpenChange(!sourceOpen)}
          >
            <FormSection
              title="Sumber & detail"
              helper="Data pendukung untuk audit dan penggunaan ulang template."
            >
              <FormField label="Kode" optional>
                <TextInput
                  value={draft.code}
                  onChange={(value) => onDraftChange({ ...draft, code: value })}
                />
              </FormField>
              <DatePickerField
                label="Berlaku mulai"
                value={draft.effectiveFrom}
                onChange={(value) => onDraftChange({ ...draft, effectiveFrom: value })}
              />
              <AdaptiveSelect
                label="Vendor default"
                value={draft.defaultVendorId ?? ""}
                onChange={(value) => onDraftChange({ ...draft, defaultVendorId: value || null })}
                options={[
                  { value: "", label: "Tanpa vendor default" },
                  ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
                ]}
              />
              <AdaptiveSelect
                label="Sumber harga"
                value={draft.priceSourceType}
                onChange={(value) =>
                  onDraftChange({ ...draft, priceSourceType: value as Draft["priceSourceType"] })
                }
                options={[
                  { value: "COST_BREAKDOWN", label: "Rincian biaya" },
                  { value: "VENDOR_QUOTE", label: "Penawaran vendor" },
                  { value: "HISTORICAL", label: "Riwayat harga" },
                  ...(draft.priceSourceType === "LEGACY_BACKFILL"
                    ? [{ value: "LEGACY_BACKFILL", label: "Data lama (kompatibilitas)" }]
                    : []),
                ]}
              />
              <FormField
                label="Catatan sumber"
                required
                error={
                  sourceTouched && draft.sourceNote.trim().length < 3
                    ? "Catatan sumber minimal 3 karakter."
                    : undefined
                }
              >
                <Textarea
                  value={draft.sourceNote}
                  onChange={(value) => {
                    onSourceTouched();
                    onDraftChange({ ...draft, sourceNote: value });
                  }}
                  placeholder="Penawaran, referensi, tanggal, dan asumsi harga"
                  rows={2}
                  aria-invalid={sourceTouched && draft.sourceNote.trim().length < 3}
                />
              </FormField>
              <FormField label="Deskripsi" optional>
                <Textarea
                  value={draft.description}
                  onChange={(value) => onDraftChange({ ...draft, description: value })}
                  rows={2}
                />
              </FormField>
            </FormSection>
          </FormDisclosure>
          {draft.id ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              disabled={!canManage || pending || dirty}
              onClick={onRequestToggle}
              className="min-h-12 w-full rounded-full bg-error-container/20 px-5 text-xs font-bold text-error disabled:opacity-35"
            >
              {draft.isActive ? "Arsipkan template" : "Aktifkan kembali"}
            </motion.button>
          ) : null}
        </div>
      ) : null}
    </>
  );
  if (desktop) {
    if (!draft) return <></>;
    return (
      <section aria-label="Editor template harga" className="space-y-6">
        <PageHeader
          title={draft.id ? "Edit template harga" : "Tambah template harga"}
          subtitle="Konfigurasi identitas, rincian biaya, dan harga klien."
          action={
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Kembali ke library
            </Button>
          }
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canManage && canSave && !pending) onSubmit();
          }}
        >
          {content}
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-outline-variant/35 pt-4">
            <div>
              <p className="text-support text-on-surface-variant">
                {draft.components.length} komponen · {money(internalCost)} · Margin{" "}
                {grossMargin.toFixed(1)}%
              </p>
              {disabledReason ? <p className="text-meta text-warning">{disabledReason}</p> : null}
            </div>
            <Button type="submit" pending={pending} disabled={!canManage || !canSave}>
              Simpan template
            </Button>
          </div>
        </form>
      </section>
    );
  }
  return (
    <OperationalFormSheet
      dismissal={{ mode: "managed" }}
      open={Boolean(draft)}
      title={draft?.id ? "Edit Template Harga" : "Tambah Template Harga"}
      onClose={onClose}
      pending={pending}
      disabled={!canManage || !canSave}
      disabledReason={disabledReason}
      submitLabel="Simpan"
      submittingLabel="Menyimpan..."
      onSubmit={onSubmit}
      statusText={
        draft
          ? `${draft.components.length} komponen · ${money(internalCost)} · Margin ${grossMargin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
          : undefined
      }
      statusTone={!canSave ? "warning" : grossMargin < 0 ? "danger" : "success"}
    >
      {content}
    </OperationalFormSheet>
  );
}
