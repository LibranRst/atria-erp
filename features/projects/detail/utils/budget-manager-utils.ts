import type { BudgetItem, BudgetItemFormState } from "../types/budget-manager-types";

export function groupBudgetItemsByCategory(
  budgetItems: readonly BudgetItem[],
): Record<string, BudgetItem[]> {
  const itemsByCategory: Record<string, BudgetItem[]> = {};

  for (const item of budgetItems) {
    const categoryName = item.budgetCategory || "Umum";
    itemsByCategory[categoryName] ??= [];
    itemsByCategory[categoryName].push(item);
  }

  return itemsByCategory;
}

export function isBudgetEditable(status: string): boolean {
  return status === "DRAFT" || status === "REJECTED";
}

export function isBudgetItemFormValid(form: BudgetItemFormState): boolean {
  return (
    Boolean(form.itemName.trim()) &&
    Boolean(form.budgetCategory.trim()) &&
    Boolean(form.selectedCategoryId) &&
    form.quantity !== "" &&
    Number(form.quantity) > 0 &&
    Boolean(form.unit.trim()) &&
    form.unitPrice !== "" &&
    Number(form.unitPrice) >= 0
  );
}

export function getBudgetItemFormValidationMessage(): string {
  return "Silakan isi nama item, kategori anggaran, kelompok biaya, kuantitas, satuan, dan harga satuan yang valid.";
}
