import { describe, expect, it } from "bun:test";

import {
  calculateExpenseLineAmount,
  createBlankExpenseDraft,
  createBlankExpenseLine,
  isExpenseLineComplete,
  mergeExpenseLines,
} from "@/features/expenses/components/expense-form-utils";
import { parseLocalExpenseRecovery } from "@/features/expenses/components/use-hybrid-expense-draft";
import {
  expenseDraftPayloadSchema,
  nextExpenseDraftRevision,
  toExpenseSubmission,
  zodIssuesToDetails,
} from "@/lib/validations/expense-draft";
import { submitFieldRequestsSchema } from "@/lib/validations/finance";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

describe("expense draft foundation", () => {
  it("accepts a deliberately incomplete transient draft", () => {
    const result = expenseDraftPayloadSchema.safeParse(createBlankExpenseDraft());
    expect(result.success).toBe(true);
  });

  it("maps strict submission errors to line-item field paths", () => {
    const payload = createBlankExpenseDraft(PROJECT_ID);
    const result = submitFieldRequestsSchema.safeParse(toExpenseSubmission(payload));
    expect(result.success).toBe(false);
    if (result.success) return;
    const details = zodIssuesToDetails(result.error);
    expect(details["items.0.projectBudgetCategoryId"]?.length).toBeGreaterThan(0);
    expect(details["items.0.description"]?.length).toBeGreaterThan(0);
  });

  it("does not forward a recovered legacy budget-item link to active submissions", () => {
    const payload = createBlankExpenseDraft(PROJECT_ID);
    payload.lines[0] = {
      ...createBlankExpenseLine(),
      projectBudgetCategoryId: CATEGORY_ID,
      projectBudgetItemId: "33333333-3333-4333-8333-333333333333",
      quantity: 1,
      unitPrice: 25_000,
      amount: 25_000,
      description: "Biaya operasional",
    };
    expect(toExpenseSubmission(payload).items[0]).not.toHaveProperty("projectBudgetItemId");
  });

  it("increments optimistic revisions and rejects invalid expectations", () => {
    expect(nextExpenseDraftRevision(4)).toBe(5);
    expect(() => nextExpenseDraftRevision(0)).toThrow("EXPECTED_REVISION_INVALID");
  });

  it("calculates amount and completeness consistently", () => {
    const line = {
      ...createBlankExpenseLine(),
      projectBudgetCategoryId: CATEGORY_ID,
      quantity: 3,
      unitPrice: 25_000,
      amount: calculateExpenseLineAmount(3, 25_000),
      description: "Cat putih",
    };
    expect(line.amount).toBe(75_000);
    expect(isExpenseLineComplete(line, "OPERASIONAL")).toBe(true);
    expect(isExpenseLineComplete({ ...line, description: "Cat" }, "OPERASIONAL")).toBe(false);
  });

  it("keeps existing manual lines when OCR append is selected", () => {
    const manual = { ...createBlankExpenseLine(), description: "Biaya manual" };
    const scanned = { ...createBlankExpenseLine(), description: "[OCR] Cat" };
    expect(mergeExpenseLines([manual], [scanned], "APPEND")).toEqual([manual, scanned]);
    expect(mergeExpenseLines([manual], [scanned], "REPLACE")).toEqual([scanned]);
  });

  it("parses valid local recovery and rejects malformed local data", () => {
    const payload = createBlankExpenseDraft(PROJECT_ID);
    const recovered = parseLocalExpenseRecovery(
      JSON.stringify({
        payload,
        draftId: null,
        revision: null,
        changedAt: "2026-07-13T10:00:00.000Z",
      }),
    );
    expect(recovered?.payload.projectId).toBe(PROJECT_ID);
    expect(parseLocalExpenseRecovery("{broken")).toBeNull();
  });
});
