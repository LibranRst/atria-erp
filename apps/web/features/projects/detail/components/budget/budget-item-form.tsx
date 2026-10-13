"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

import {
  MoneyValue,
  GroupedSurface,
  FactRow,
  ComboboxField,
  COMMON_UNIT_OPTIONS,
  FormField,
  FormSection,
  MoneyInput,
  NumericInput,
  OperationalFormSheet,
  AdaptiveSelect,
  TextInput,
  useFormDirtySnapshot,
} from "@/components/ui";
import type {
  BudgetItemFormSetters,
  BudgetItemFormState,
  CostCategory,
} from "../../types/budget-manager-types";
import { isBudgetItemFormValid } from "../../utils/budget-manager-utils";

export function BudgetItemForm({
  open,
  form,
  setters,
  costCategories,
  isPending,
  onSubmit,
  onClose,
}: {
  readonly open: boolean;
  readonly form: BudgetItemFormState;
  readonly setters: BudgetItemFormSetters;
  readonly costCategories: readonly CostCategory[];
  readonly isPending: boolean;
  readonly onSubmit: (event: React.FormEvent) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const estimatedTotal =
    form.quantity !== "" && form.unitPrice !== ""
      ? Number(form.quantity) * Number(form.unitPrice)
      : 0;
  const dirty = useFormDirtySnapshot(open, "budget-item", JSON.stringify(form));
  return (
    <OperationalFormSheet
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-support font-semibold text-on-surface">Ringkasan item</h3>
            <p className="mt-1 text-support wrap-anywhere text-on-surface-variant">
              {form.itemName.trim() || "Nama item belum diisi"}
            </p>
          </div>
          <GroupedSurface variant="desktopPanel" className="wrap-anywhere">
            <div className="divide-y divide-outline-variant/20">
              <FactRow
                layout="stacked"
                wrapLabel
                label="Kategori"
                value={
                  costCategories.find((category) => category.id === form.selectedCategoryId)
                    ?.name ?? "Belum dipilih"
                }
              />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Kuantitas"
                value={`${form.quantity || 0} ${form.unit || "unit"}`}
              />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Subtotal draft"
                value={
                  <MoneyValue
                    fractionDigits={Number.isInteger(estimatedTotal) ? 0 : 2}
                    amount={estimatedTotal}
                    variant="fullDynamic"
                    size="sm"
                    align="right"
                  />
                }
              />
            </div>
          </GroupedSurface>
          <p className="px-1 text-support text-on-surface-variant">
            Subtotal mengikuti kuantitas dan harga satuan yang sedang diisi.
          </p>
        </div>
      }
      dismissal={{
        mode: "confirm",
        dirty,
        onDiscard: () => {
          setters.setItemName("");
          setters.setBudgetCategory("");
          setters.setSelectedCategoryId("");
          setters.setQuantity("");
          setters.setUnit("");
          setters.setUnitPrice("");
        },
        description: "Item budget yang belum ditambahkan akan hilang.",
      }}
      open={open}
      title="Tambah Item Project Budget"
      onClose={onClose}
      formId="project-budget-item-form"
      pending={isPending}
      disabled={!isBudgetItemFormValid(form)}
      disabledReason={
        !isBudgetItemFormValid(form)
          ? "Lengkapi nama, kategori, kelompok biaya, kuantitas, dan harga satuan."
          : undefined
      }
      submitLabel="Tambah"
      submittingLabel="Menambahkan…"
      statusText={desktop ? undefined : `Subtotal Rp ${estimatedTotal.toLocaleString("id-ID")}`}
      statusTone={estimatedTotal > 0 ? "success" : "warning"}
    >
      <form id="project-budget-item-form" onSubmit={onSubmit} className="space-y-md">
        <FormSection
          title="Rincian Item"
          helper="Nama, kategori pengelompokan, dan satuan item anggaran."
        >
          <FormField label="Nama Item Anggaran" required>
            <TextInput
              value={form.itemName}
              onChange={setters.setItemName}
              placeholder="Contoh: Carrara Marble Countertop"
              disabled={isPending}
            />
          </FormField>

          <FormField label="Kategori Anggaran" required>
            <TextInput
              value={form.budgetCategory}
              onChange={setters.setBudgetCategory}
              placeholder="Contoh: Pekerjaan Dapur, Pekerjaan Lantai"
              disabled={isPending}
            />
          </FormField>

          <AdaptiveSelect
            label="Kategori Budget"
            value={form.selectedCategoryId}
            onChange={setters.setSelectedCategoryId}
            disabled={isPending}
            options={costCategories.map((category) => ({
              value: category.id,
              label: category.name,
              description: category.description ?? undefined,
            }))}
            placeholder="Pilih kelompok biaya"
          />

          <ComboboxField
            label="Satuan Ukur"
            value={form.unit}
            onChange={setters.setUnit}
            options={COMMON_UNIT_OPTIONS}
            disabled={isPending}
            placeholder="Contoh: m2, pcs, set"
          />
        </FormSection>

        <FormSection
          title="Kuantitas & Harga"
          helper="Kuantitas dan harga satuan menentukan subtotal item anggaran."
        >
          <div className="grid grid-cols-2 divide-x divide-outline-variant/20">
            <FormField label="Kuantitas" required>
              <NumericInput
                value={form.quantity}
                min={0}
                disabled={isPending}
                onChange={(value) => setters.setQuantity(value !== "" ? Number(value) : "")}
                suffix={form.unit || undefined}
                placeholder="0"
              />
            </FormField>

            <FormField label="Harga Satuan" required>
              <MoneyInput
                value={form.unitPrice}
                onChange={(value) => setters.setUnitPrice(value !== "" ? Number(value) : "")}
                disabled={isPending}
                showPreview={false}
                placeholder="0"
              />
            </FormField>
          </div>
        </FormSection>
      </form>
    </OperationalFormSheet>
  );
}
