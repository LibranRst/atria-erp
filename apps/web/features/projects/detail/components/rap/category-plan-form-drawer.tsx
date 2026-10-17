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
  CategoryPlanFormState,
  PricingTemplateOption,
  ProjectPlanBudgetCategory,
  VendorOption,
} from "../shared/rap-rab-manager";

export function CategoryPlanFormDrawer({
  showCategoryPlanForm,
  closeCategoryPlanForm,
  editingCategoryPlanItemId,
  categoryPlanForm,
  setCategoryPlanForm,
  pricingTemplates,
  budgetCategories,
  vendors,
  handleCategoryTemplateChange,
  handleSubmitCategoryPlanItem,
  isPending,
  categoryFormEstimatedTotal,
  error,
}: {
  readonly showCategoryPlanForm: boolean;
  readonly closeCategoryPlanForm: () => void;
  readonly editingCategoryPlanItemId: string | null;
  readonly categoryPlanForm: CategoryPlanFormState;
  readonly setCategoryPlanForm: React.Dispatch<React.SetStateAction<CategoryPlanFormState>>;
  readonly pricingTemplates: readonly PricingTemplateOption[];
  readonly budgetCategories: readonly ProjectPlanBudgetCategory[];
  readonly vendors: readonly VendorOption[];
  readonly handleCategoryTemplateChange: (id: string) => void;
  readonly handleSubmitCategoryPlanItem: (event: React.FormEvent) => void;
  readonly isPending: boolean;
  readonly categoryFormEstimatedTotal: number;
  readonly error?: string | null;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const dirty = useFormDirtySnapshot(
    showCategoryPlanForm,
    editingCategoryPlanItemId ?? "new-category-plan",
    JSON.stringify(categoryPlanForm),
  );
  function updateCategoryPlanForm(value: React.SetStateAction<CategoryPlanFormState>): void {
    if (!isPending) setCategoryPlanForm(value);
  }
  return (
    <OperationalFormSheet
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-support font-semibold text-on-surface">Ringkasan paket</h3>
            <p className="mt-1 text-support wrap-anywhere text-on-surface-variant">
              {categoryPlanForm.name.trim() || "Nama paket belum diisi"}
            </p>
          </div>
          <GroupedSurface variant="desktopPanel" className="wrap-anywhere">
            <div className="divide-y divide-outline-variant/20">
              <FactRow
                layout="stacked"
                wrapLabel
                label="Kategori"
                value={
                  budgetCategories.find(
                    (category) => category.id === categoryPlanForm.projectBudgetCategoryId,
                  )?.name ?? "Belum dipilih"
                }
              />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Volume"
                value={`${categoryPlanForm.quantity || 0} ${categoryPlanForm.unit || "unit"}`}
              />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Estimasi biaya"
                value={
                  <MoneyValue
                    fractionDigits={Number.isInteger(categoryFormEstimatedTotal) ? 0 : 2}
                    amount={categoryFormEstimatedTotal}
                    variant="fullDynamic"
                    size="sm"
                    align="right"
                  />
                }
              />
            </div>
          </GroupedSurface>
          <p className="px-1 text-support text-on-surface-variant">
            Paket adalah rencana biaya internal. Pengeluaran atau tagihan tetap dicatat melalui
            alurnya.
          </p>
        </div>
      }
      dismissal={{
        mode: "confirm",
        dirty,
        onDiscard: () => closeCategoryPlanForm(),
        description: "Perubahan paket kerja yang belum disimpan akan hilang.",
      }}
      open={showCategoryPlanForm}
      title={editingCategoryPlanItemId ? "Edit Paket Kerja" : "Tambah Paket Tukang/Subcon"}
      onClose={closeCategoryPlanForm}
      formId="category-plan-item-form"
      submitLabel={editingCategoryPlanItemId ? "Perbarui" : "Tambah"}
      submittingLabel="Menyimpan…"
      pending={isPending}
      error={
        error ? (
          <div role="alert">
            <FormRiskNotice title="Paket kerja belum tersimpan" tone="danger">
              {error}
            </FormRiskNotice>
          </div>
        ) : undefined
      }
      disabled={
        !categoryPlanForm.projectBudgetCategoryId ||
        !categoryPlanForm.name ||
        !categoryPlanForm.area ||
        !categoryPlanForm.unit
      }
      disabledReason={
        !categoryPlanForm.projectBudgetCategoryId ||
        !categoryPlanForm.name ||
        !categoryPlanForm.area ||
        !categoryPlanForm.unit
          ? "Lengkapi kategori, nama paket, area, dan satuan."
          : undefined
      }
      statusText={
        desktop
          ? undefined
          : `${categoryPlanForm.name || "Paket belum diisi"} · ${formatRp(categoryFormEstimatedTotal)}`
      }
      statusTone={
        categoryPlanForm.name && categoryPlanForm.projectBudgetCategoryId ? "success" : "warning"
      }
    >
      <div className="space-y-md">
        {!desktop && (
          <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
                  Paket Rencana RAP
                </p>
                <h3 className="mt-0.5 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
                  {categoryPlanForm.name || "Nama paket belum diisi"}
                </h3>
                <p className="mt-0.5 truncate text-meta font-medium text-on-surface-variant/75">
                  {budgetCategories.find(
                    (category) => category.id === categoryPlanForm.projectBudgetCategoryId,
                  )?.name ?? "Kategori belum dipilih"}
                  {categoryPlanForm.area ? ` · Area ${categoryPlanForm.area}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                  Estimasi Biaya
                </p>
                <div className="mt-0.5">
                  <MoneyValue
                    amount={categoryFormEstimatedTotal}
                    variant="fullDynamic"
                    size="sm"
                    align="right"
                    className="font-bold text-primary"
                  />
                </div>
                {categoryPlanForm.quantity && categoryPlanForm.unit && (
                  <p className="mt-0.5 truncate text-meta text-on-surface-variant">
                    Volume {categoryPlanForm.quantity} {categoryPlanForm.unit}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        <form
          id="category-plan-item-form"
          onSubmit={handleSubmitCategoryPlanItem}
          className="space-y-md"
        >
          {!editingCategoryPlanItemId && (
            <FormSection
              title="Sumber paket"
              helper="Mulai dari template bila lingkup serupa pernah digunakan, lalu sesuaikan untuk proyek ini."
            >
              <div>
                <AdaptiveSelect
                  label="Gunakan template Library"
                  disabled={isPending}
                  value={categoryPlanForm.templateId}
                  onChange={(value): void => {
                    if (!isPending) handleCategoryTemplateChange(value);
                  }}
                  options={[
                    {
                      value: "",
                      label: "Isi manual",
                      description: "Susun paket dari awal.",
                    },
                    ...pricingTemplates
                      .filter(
                        (item) =>
                          item.itemType === "WORK_PACKAGE" || item.itemType === "SUBCON_PACKAGE",
                      )
                      .map((item) => ({
                        value: item.id,
                        label: `${
                          item.itemType === "WORK_PACKAGE" ? "Tukang" : "Subcon"
                        } · ${item.name}`,
                        description: `${formatShortRp(item.internalCost)}`,
                      })),
                  ]}
                />
                <p className="px-4 pt-1 pb-3 text-meta text-on-surface-variant">
                  Template disalin sebagai snapshot. Edit setelahnya tidak mengubah Library.
                </p>
              </div>
            </FormSection>
          )}

          <FormSection
            title="Identitas & lingkup"
            helper="Kategori menentukan hubungan paket dengan budget Tukang atau Subcon."
          >
            <AdaptiveSelect
              label="Kategori Budget"
              disabled={isPending}
              value={categoryPlanForm.projectBudgetCategoryId}
              onChange={(value) =>
                updateCategoryPlanForm((curr) => ({
                  ...curr,
                  projectBudgetCategoryId: value,
                }))
              }
              options={budgetCategories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              placeholder="Pilih kategori"
              required
            />
            <ComboboxField
              disabled={isPending}
              label="Area / Lingkup"
              value={categoryPlanForm.area}
              onChange={(value) => updateCategoryPlanForm((curr) => ({ ...curr, area: value }))}
              options={COMMON_ROOM_OPTIONS}
              placeholder="Pilih atau ketik area"
            />
            <AdaptiveSelect
              label="Vendor"
              disabled={isPending}
              optional
              value={categoryPlanForm.vendorId}
              onChange={(value) => updateCategoryPlanForm((curr) => ({ ...curr, vendorId: value }))}
              options={[
                { value: "", label: "Tanpa vendor" },
                ...vendors.map((vendor) => ({
                  value: vendor.id,
                  label: vendor.name,
                })),
              ]}
            />
            <FormField label="Nama Paket">
              <TextInput
                disabled={isPending}
                value={categoryPlanForm.name}
                onChange={(value) => updateCategoryPlanForm((curr) => ({ ...curr, name: value }))}
                placeholder="Nama paket kerja"
              />
            </FormField>
            <FormField label="Lingkup Pekerjaan">
              <Textarea
                disabled={isPending}
                rows={2}
                value={categoryPlanForm.scopeDescription}
                onChange={(value) =>
                  updateCategoryPlanForm((curr) => ({
                    ...curr,
                    scopeDescription: value,
                  }))
                }
                placeholder="Scope pekerjaan internal"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Jumlah & biaya"
            helper="Estimasi ini hanya untuk kontrol internal; RAB klien dibuat dari salinan yang aman."
          >
            <FormField label="Jumlah">
              <NumericInput
                disabled={isPending}
                value={categoryPlanForm.quantity}
                onChange={(value) =>
                  updateCategoryPlanForm((curr) => ({
                    ...curr,
                    quantity: value,
                  }))
                }
                min={0}
              />
            </FormField>
            <ComboboxField
              disabled={isPending}
              label="Satuan"
              value={categoryPlanForm.unit}
              onChange={(value) => updateCategoryPlanForm((curr) => ({ ...curr, unit: value }))}
              options={COMMON_UNIT_OPTIONS}
              placeholder="Pilih satuan"
            />
            <FormField label="Biaya per Satuan">
              <MoneyInput
                disabled={isPending}
                value={categoryPlanForm.estimatedUnitCost}
                onChange={(value) =>
                  updateCategoryPlanForm((curr) => ({
                    ...curr,
                    estimatedUnitCost: value,
                  }))
                }
                showPreview={false}
              />
            </FormField>
            <FormField label="Catatan Internal">
              <Textarea
                disabled={isPending}
                rows={2}
                value={categoryPlanForm.internalNote}
                onChange={(value) =>
                  updateCategoryPlanForm((curr) => ({
                    ...curr,
                    internalNote: value,
                  }))
                }
                placeholder="Catatan internal, tidak tampil ke klien"
              />
            </FormField>
          </FormSection>

          <div className="p-3">
            <ValuePreviewStrip
              items={[
                {
                  label: "Jumlah",
                  value: `${categoryPlanForm.quantity || 0} ${categoryPlanForm.unit}`,
                },
                {
                  label: "Estimasi paket",
                  amount: categoryFormEstimatedTotal,
                  tone: categoryFormEstimatedTotal > 0 ? "success" : "default",
                },
              ]}
            />
          </div>
        </form>
      </div>
    </OperationalFormSheet>
  );
}
