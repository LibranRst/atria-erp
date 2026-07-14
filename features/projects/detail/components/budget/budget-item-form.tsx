"use client";

import React from "react";

import {
  COMMON_UNIT_OPTIONS,
  ComboboxField,
  FormField,
  MoneyInput,
  OperationalFormSheet,
  QuantityStepper,
  SheetSelect,
  TextInput,
} from "@/components/ui";
import type {
  BudgetItemFormSetters,
  BudgetItemFormState,
  CostCategory,
} from "./budget-manager-types";
import { isBudgetItemFormValid } from "./budget-manager-utils";

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
  const estimatedTotal = form.quantity !== "" && form.unitPrice !== ""
    ? Number(form.quantity) * Number(form.unitPrice)
    : 0;
  return (
    <OperationalFormSheet
      open={open}
      title="Tambah Item Project Budget"
      onClose={onClose}
      formId="project-budget-item-form"
      pending={isPending}
      disabled={!isBudgetItemFormValid(form)}
      disabledReason={!isBudgetItemFormValid(form) ? "Lengkapi nama, kategori, kelompok biaya, kuantitas, dan harga satuan." : undefined}
      submitLabel="Tambahkan Item Budget"
      submittingLabel="Menambahkan…"
      statusText={`Subtotal Rp ${estimatedTotal.toLocaleString("id-ID")}`}
      statusTone={estimatedTotal > 0 ? "success" : "warning"}
    >
    <form id="project-budget-item-form" onSubmit={onSubmit} className="space-y-md">
      <div className="space-y-sm text-xs">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <FormField label="Nama Item Anggaran">
            <TextInput
              value={form.itemName}
              onChange={setters.setItemName}
              placeholder="Contoh: Carrara Marble Countertop"
              disabled={isPending}
            />
          </FormField>

          <FormField label="Kategori Anggaran">
            <TextInput
              value={form.budgetCategory}
              onChange={setters.setBudgetCategory}
              placeholder="Contoh: Pekerjaan Dapur, Pekerjaan Lantai"
              disabled={isPending}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <SheetSelect
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
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <FormField label={form.unit ? `Kuantitas (${form.unit})` : "Kuantitas (Volume)"}>
            <QuantityStepper
              value={form.quantity}
              min={0}
              disabled={isPending}
              onChange={(value) =>
                setters.setQuantity(value !== "" ? Number(value) : "")
              }
            />
          </FormField>

          <FormField label="Harga Satuan (Rp)">
            <MoneyInput
              value={form.unitPrice}
              onChange={(value) =>
                setters.setUnitPrice(value !== "" ? Number(value) : "")
              }
              disabled={isPending}
              showPreview={false}
            />
          </FormField>
        </div>

        {form.quantity !== "" && form.unitPrice !== "" && (
          <div className="rounded-full border border-primary/20 bg-surface-container-low p-2.5 text-center text-xs font-bold text-primary">
            Subtotal item: Rp{" "}
            {(Number(form.quantity) * Number(form.unitPrice)).toLocaleString(
              "id-ID",
            )}
          </div>
        )}
      </div>
    </form>
    </OperationalFormSheet>
  );
}
