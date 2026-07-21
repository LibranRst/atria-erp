"use client";

import React from "react";

import {
  ConfirmationSheet,
  FieldContextLine,
  FormField,
  FormRiskNotice,
  MoneyInput,
  OptionChoiceGroup,
  QuantityStepper,
  SheetSelect,
  Textarea,
  WorkflowFormSheet,
} from "@/components/ui";
import type {
  CategoryPlanItemOption,
  ExpenseFormProject,
  ExpenseLine,
  InventoryLocationOption,
  MaterialOption,
  ProjectBudgetCategoryOption,
  ProjectRapItemOption,
} from "./expense-form-types";
import {
  cleanLeadingZeros,
  calculateExpenseLineAmount,
  isExpenseLineComplete,
  STOCK_HANDLING_OPTIONS,
} from "./expense-form-utils";

type ExpenseLineEditorProps = {
  readonly open: boolean;
  readonly line: ExpenseLine;
  readonly index: number;
  readonly budgetCategories: readonly ProjectBudgetCategoryOption[];
  readonly materialOptions: readonly MaterialOption[];
  readonly rapItems: readonly ProjectRapItemOption[];
  readonly categoryPlanItems: readonly CategoryPlanItemOption[];
  readonly defaultInventoryLocationId: string;
  readonly inventoryLocations: readonly InventoryLocationOption[];
  readonly onClose: () => void;
  readonly onSave: (line: ExpenseLine) => void;
};

export function ExpenseLineEditor({
  open,
  line,
  index,
  budgetCategories,
  materialOptions,
  rapItems,
  categoryPlanItems,
  defaultInventoryLocationId,
  inventoryLocations,
  onClose,
  onSave,
}: ExpenseLineEditorProps): React.JSX.Element {
  const [draft, setDraft] = React.useState<ExpenseLine>(line);
  const [pendingCategoryId, setPendingCategoryId] = React.useState<string | null>(null);

  const selectedCategory = budgetCategories.find(
    (category) => category.id === draft.projectBudgetCategoryId,
  );
  const isMaterial = selectedCategory?.code === "MATERIAL";
  const isPackage = selectedCategory?.code === "TUKANG" || selectedCategory?.code === "SUBCON";
  const selectedMaterial = materialOptions.find((item) => item.id === draft.materialId);
  const amount = Number(draft.amount) || 0;
  const remaining = Number(selectedCategory?.remainingAmount ?? 0);
  const overBudget = Boolean(selectedCategory && amount > remaining);
  const complete = isExpenseLineComplete(draft, selectedCategory?.code);

  function patch(update: Partial<ExpenseLine>): void {
    setDraft((current) => {
      const next = { ...current, ...update };
      if ("quantity" in update || "unitPrice" in update) {
        next.amount = calculateExpenseLineAmount(next.quantity, next.unitPrice);
      }
      return next;
    });
  }

  function applyCategory(categoryId: string): void {
    const nextCategory = budgetCategories.find((category) => category.id === categoryId);
    patch({
      projectBudgetCategoryId: categoryId,
      projectBudgetItemId: "",
      projectCategoryPlanItemId: "",
      materialId: nextCategory?.code === "MATERIAL" ? draft.materialId : "",
      projectRapItemId: nextCategory?.code === "MATERIAL" ? draft.projectRapItemId : "",
      stockHandling: nextCategory?.code === "MATERIAL" ? draft.stockHandling : "EXPENSE_ONLY",
      inventoryLocationId: nextCategory?.code === "MATERIAL" ? draft.inventoryLocationId : "",
    });
    setPendingCategoryId(null);
  }

  function requestCategoryChange(categoryId: string): void {
    const losesLinks = Boolean(
      draft.materialId ||
      draft.projectRapItemId ||
      draft.projectCategoryPlanItemId ||
      draft.inventoryLocationId,
    );
    if (draft.projectBudgetCategoryId && losesLinks) {
      setPendingCategoryId(categoryId);
      return;
    }
    applyCategory(categoryId);
  }

  const budgetOptions = budgetCategories.map((category) => ({
    value: category.id,
    label: category.name,
    description: `Sisa Rp ${Number(category.remainingAmount).toLocaleString("id-ID")}`,
    meta: `${category.usedPercentage}% terpakai`,
  }));
  const materialSelectOptions = [
    { value: "", label: "Tidak ditautkan", description: "Tetap catat sebagai biaya material." },
    ...materialOptions.map((material) => ({
      value: material.id,
      label: material.name,
      description: `Tersedia ${material.availableStock.toLocaleString("id-ID")} ${material.unit}`,
    })),
  ];
  const packageLabel = selectedCategory?.code === "SUBCON" ? "Paket Subkon" : "Paket Tukang";

  return (
    <>
      <WorkflowFormSheet
        open={open}
        title={`Item ${index + 1}`}
        primaryLabel="Simpan"
        disabled={!complete}
        disabledReason={
          !complete
            ? "Lengkapi kategori, keterangan, jumlah, harga, dan kebutuhan stok."
            : undefined
        }
        statusText={
          overBudget
            ? "Subtotal melebihi sisa kategori."
            : `Subtotal Rp ${amount.toLocaleString("id-ID")}`
        }
        statusTone={overBudget ? "danger" : complete ? "success" : "warning"}
        onClose={onClose}
        onPrimary={() => onSave(draft)}
      >
        <div className="space-y-4">
          <SheetSelect
            label="Kategori Pengeluaran"
            value={draft.projectBudgetCategoryId}
            onChange={requestCategoryChange}
            options={budgetOptions}
            placeholder="Pilih kategori"
            required
            error={!draft.projectBudgetCategoryId ? "Pilih kategori pengeluaran." : undefined}
          />

          <FormField
            label="Keterangan"
            required
            error={
              draft.description.trim().length < 5
                ? "Tulis keterangan minimal 5 karakter."
                : undefined
            }
          >
            <Textarea
              value={draft.description}
              onChange={(description) => patch({ description })}
              rows={2}
              placeholder="Contoh: Cat dinding putih 20 kg"
            />
          </FormField>

          <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
            <FormField
              label={selectedMaterial ? `Jumlah (${selectedMaterial.unit})` : "Jumlah"}
              required
              error={
                draft.quantity === "" || Number(draft.quantity) <= 0
                  ? "Jumlah harus lebih dari 0."
                  : undefined
              }
            >
              <QuantityStepper
                value={draft.quantity}
                onChange={(value) => {
                  const clean = cleanLeadingZeros(value);
                  patch({ quantity: clean === "" ? "" : Math.max(0, Number(clean)) });
                }}
              />
            </FormField>
            <FormField
              label="Harga Satuan"
              required
              error={draft.unitPrice === "" ? "Masukkan harga satuan." : undefined}
            >
              <MoneyInput
                value={draft.unitPrice}
                showPreview={false}
                placeholder="0"
                onChange={(value) => {
                  const clean = cleanLeadingZeros(value);
                  patch({ unitPrice: clean === "" ? "" : Math.max(0, Number(clean)) });
                }}
              />
            </FormField>
          </div>

          {selectedCategory ? (
            <FieldContextLine tone={overBudget ? "danger" : "success"}>
              Rp {amount.toLocaleString("id-ID")} dari sisa Rp {remaining.toLocaleString("id-ID")}{" "}
              kategori {selectedCategory.name}.
            </FieldContextLine>
          ) : null}
          {overBudget ? (
            <FormRiskNotice title="Melebihi sisa kategori" tone="danger">
              Pengajuan tetap dapat ditinjau. Jalur approval akan mengikuti aturan budget di server.
            </FormRiskNotice>
          ) : null}

          {isMaterial ? (
            <div className="space-y-3 border-t border-outline-variant/15 pt-4">
              <OptionChoiceGroup
                label="Perlakuan Stok"
                value={draft.stockHandling}
                options={STOCK_HANDLING_OPTIONS}
                onChange={(stockHandling) =>
                  patch({
                    stockHandling,
                    inventoryLocationId:
                      stockHandling === "EXPENSE_ONLY"
                        ? ""
                        : draft.inventoryLocationId || defaultInventoryLocationId,
                  })
                }
              />
              <SheetSelect
                label="Material"
                value={draft.materialId}
                onChange={(materialId) => patch({ materialId, projectRapItemId: "" })}
                options={materialSelectOptions}
                placeholder="Pilih material"
                required={draft.stockHandling !== "EXPENSE_ONLY"}
                optional={draft.stockHandling === "EXPENSE_ONLY"}
                error={
                  draft.stockHandling !== "EXPENSE_ONLY" && !draft.materialId
                    ? "Pilih material untuk perubahan stok."
                    : undefined
                }
              />
              {draft.stockHandling !== "EXPENSE_ONLY" ? (
                <SheetSelect
                  label="Lokasi Stok"
                  value={draft.inventoryLocationId}
                  onChange={(inventoryLocationId) => patch({ inventoryLocationId })}
                  options={inventoryLocations.map((location) => ({
                    value: location.id,
                    label: location.name,
                  }))}
                  placeholder="Pilih lokasi"
                  required
                  error={!draft.inventoryLocationId ? "Pilih lokasi stok." : undefined}
                />
              ) : null}
              <SheetSelect
                label="Item RAP"
                value={draft.projectRapItemId}
                onChange={(projectRapItemId) => {
                  const rapItem = rapItems.find((item) => item.id === projectRapItemId);
                  patch({ projectRapItemId, materialId: rapItem?.materialId ?? draft.materialId });
                }}
                options={[
                  { value: "", label: "Tidak ditautkan" },
                  ...rapItems
                    .filter((item) => !draft.materialId || item.materialId === draft.materialId)
                    .map((item) => ({
                      value: item.id,
                      label: `${item.area} · ${item.label}`,
                      description: `${item.quantity} ${item.unit}`,
                    })),
                ]}
                optional
              />
              {selectedMaterial && draft.quantity !== "" ? (
                <FieldContextLine
                  tone={
                    selectedMaterial.availableStock >= Number(draft.quantity)
                      ? "success"
                      : "warning"
                  }
                >
                  Stok tersedia {selectedMaterial.availableStock.toLocaleString("id-ID")}{" "}
                  {selectedMaterial.unit}; kebutuhan{" "}
                  {Number(draft.quantity).toLocaleString("id-ID")} {selectedMaterial.unit}.
                </FieldContextLine>
              ) : null}
            </div>
          ) : null}

          {isPackage ? (
            <div className="border-t border-outline-variant/15 pt-4">
              <SheetSelect
                label={packageLabel}
                value={draft.projectCategoryPlanItemId}
                onChange={(projectCategoryPlanItemId) => patch({ projectCategoryPlanItemId })}
                options={[
                  { value: "", label: "Tidak ditautkan" },
                  ...categoryPlanItems
                    .filter(
                      (item) => item.projectBudgetCategoryId === draft.projectBudgetCategoryId,
                    )
                    .map((item) => ({
                      value: item.id,
                      label: `${item.area} · ${item.label}`,
                      description: `Estimasi Rp ${Number(item.estimatedTotalCost).toLocaleString("id-ID")}`,
                    })),
                ]}
                optional
              />
            </div>
          ) : null}
        </div>
      </WorkflowFormSheet>

      <ConfirmationSheet
        open={pendingCategoryId !== null}
        title="Ganti kategori?"
        description="Tautan material, RAP, paket, atau lokasi stok pada item ini akan dikosongkan. Nominal dan keterangan tetap aman."
        confirmLabel="Ganti Kategori"
        onClose={() => setPendingCategoryId(null)}
        onConfirm={() => {
          if (pendingCategoryId) applyCategory(pendingCategoryId);
        }}
      />
    </>
  );
}

export type { ExpenseFormProject };
