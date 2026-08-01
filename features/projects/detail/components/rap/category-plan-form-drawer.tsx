"use client";

import React from "react";

import {
  COMMON_ROOM_OPTIONS,
  COMMON_UNIT_OPTIONS,
  ComboboxField,
  FieldContextLine,
  FormField,
  FormSection,
  MoneyInput,
  NumericInput,
  OperationalFormSheet,
  SheetSelect,
  Textarea,
  TextInput,
  ValuePreviewStrip,
} from "@/components/ui";
import { formatIdr as formatRp, formatShortIdr as formatShortRp } from "@/lib/utils/money";
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
}): React.JSX.Element {
  return (
    <OperationalFormSheet
      open={showCategoryPlanForm}
      title={editingCategoryPlanItemId ? "Edit Paket Kerja" : "Tambah Paket Tukang/Subcon"}
      onClose={closeCategoryPlanForm}
      formId="category-plan-item-form"
      submitLabel={editingCategoryPlanItemId ? "Perbarui" : "Tambah"}
      submittingLabel="Menyimpan…"
      pending={isPending}
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
      statusText={`${categoryPlanForm.name || "Paket belum diisi"} · ${formatRp(categoryFormEstimatedTotal)}`}
      statusTone={
        categoryPlanForm.name && categoryPlanForm.projectBudgetCategoryId ? "success" : "warning"
      }
    >
      <div className="space-y-md">
        <FieldContextLine tone={categoryFormEstimatedTotal > 0 ? "success" : "default"}>
          {categoryPlanForm.name || "Paket belum diisi"} ·{" "}
          {budgetCategories.find(
            (category) => category.id === categoryPlanForm.projectBudgetCategoryId,
          )?.name ?? "kategori belum dipilih"}{" "}
          · {formatRp(categoryFormEstimatedTotal)}
        </FieldContextLine>
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
                <SheetSelect
                  label="Gunakan template Library"
                  value={categoryPlanForm.templateId}
                  onChange={handleCategoryTemplateChange}
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
            <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
              <SheetSelect
                label="Kategori Budget"
                value={categoryPlanForm.projectBudgetCategoryId}
                onChange={(value) =>
                  setCategoryPlanForm((curr) => ({
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
                label="Area / Lingkup"
                value={categoryPlanForm.area}
                onChange={(value) => setCategoryPlanForm((curr) => ({ ...curr, area: value }))}
                options={COMMON_ROOM_OPTIONS}
                placeholder="Pilih atau ketik area"
              />
              <SheetSelect
                label="Vendor"
                optional
                value={categoryPlanForm.vendorId}
                onChange={(value) => setCategoryPlanForm((curr) => ({ ...curr, vendorId: value }))}
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
                  value={categoryPlanForm.name}
                  onChange={(value) => setCategoryPlanForm((curr) => ({ ...curr, name: value }))}
                  placeholder="Nama paket kerja"
                />
              </FormField>
              <FormField label="Lingkup Pekerjaan">
                <Textarea
                  rows={2}
                  value={categoryPlanForm.scopeDescription}
                  onChange={(value) =>
                    setCategoryPlanForm((curr) => ({
                      ...curr,
                      scopeDescription: value,
                    }))
                  }
                  placeholder="Scope pekerjaan internal"
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Jumlah & biaya"
            helper="Estimasi ini hanya untuk kontrol internal; RAB klien dibuat dari salinan yang aman."
          >
            <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
              <FormField label="Jumlah">
                <NumericInput
                  value={categoryPlanForm.quantity}
                  onChange={(value) =>
                    setCategoryPlanForm((curr) => ({
                      ...curr,
                      quantity: value,
                    }))
                  }
                  min={0}
                />
              </FormField>
              <ComboboxField
                label="Satuan"
                value={categoryPlanForm.unit}
                onChange={(value) => setCategoryPlanForm((curr) => ({ ...curr, unit: value }))}
                options={COMMON_UNIT_OPTIONS}
                placeholder="Pilih satuan"
              />
              <FormField label="Biaya per Satuan">
                <MoneyInput
                  value={categoryPlanForm.estimatedUnitCost}
                  onChange={(value) =>
                    setCategoryPlanForm((curr) => ({
                      ...curr,
                      estimatedUnitCost: value,
                    }))
                  }
                  showPreview={false}
                />
              </FormField>
              <FormField label="Catatan Internal">
                <Textarea
                  rows={2}
                  value={categoryPlanForm.internalNote}
                  onChange={(value) =>
                    setCategoryPlanForm((curr) => ({
                      ...curr,
                      internalNote: value,
                    }))
                  }
                  placeholder="Catatan internal, tidak tampil ke klien"
                />
              </FormField>
            </div>

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
          </FormSection>
        </form>
      </div>
    </OperationalFormSheet>
  );
}
