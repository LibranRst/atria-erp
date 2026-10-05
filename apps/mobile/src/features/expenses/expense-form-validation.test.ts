import { expect, test } from "bun:test";
import type { ExpenseDraftPayloadInput } from "@atria/core/validations/expense-draft";
import { validateExpenseForm } from "./expense-form-validation";
const id = "11111111-1111-1111-1111-111111111111";
function draft(): ExpenseDraftPayloadInput {
  return {
    projectId: id,
    inputMode: "MANUAL",
    receipt: null,
    ocrWarning: null,
    lines: [
      {
        key: "one",
        projectBudgetCategoryId: id,
        projectBudgetItemId: "",
        materialId: "",
        projectRapItemId: "",
        projectCategoryPlanItemId: "",
        stockHandling: "EXPENSE_ONLY",
        inventoryLocationId: "",
        quantity: 1,
        unitPrice: 50000,
        amount: 50000,
        description: "Cat interior",
      },
    ],
  };
}
test("valid manual expense needs no receipt or material and performs no mutation", () => {
  expect(validateExpenseForm(draft())).toEqual({ errors: {}, firstField: undefined });
});
test("first invalid field follows form reading order and labels selections without internal IDs", () => {
  const payload = draft();
  payload.projectId = "";
  payload.lines[0].description = "abc";
  const result = validateExpenseForm(payload);
  expect(result.firstField).toBe("project");
  expect(result.errors.project).toBe("Pilih proyek untuk biaya ini.");
  expect(result.errors["one.description"]).toContain("minimal 5");
});
test("a calculated total error focuses its editable price, after the earlier description", () => {
  const payload = draft();
  payload.lines[0].amount = 0;
  payload.lines[0].unitPrice = "";
  expect(validateExpenseForm(payload).firstField).toBe("one.unitPrice");
  payload.lines[0].description = "";
  expect(validateExpenseForm(payload).firstField).toBe("one.description");
});
test("stock selectors are required only when their optional rows are shown", () => {
  const payload = draft();
  payload.lines[0].stockHandling = "STOCK_IN";
  const result = validateExpenseForm(payload);
  expect(result.firstField).toBe("one.materialId");
  expect(result.errors["one.inventoryLocationId"]).toBe("Pilih lokasi stok.");
  payload.lines[0].materialId = id;
  payload.lines[0].inventoryLocationId = id;
  expect(validateExpenseForm(payload).errors).toEqual({});
});
