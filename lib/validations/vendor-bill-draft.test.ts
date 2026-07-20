import { describe, expect, test } from "bun:test";

import { toVendorBillSubmission, vendorBillDraftPayloadSchema } from "@/lib/validations/vendor-bill-draft";

const id = "11111111-1111-4111-8111-111111111111";

describe("vendor bill draft", () => {
  test("accepts incomplete recoverable input without treating it as submittable", () => {
    const payload = vendorBillDraftPayloadSchema.parse({ vendorId: "", projectId: "", projectBudgetCategoryId: "", projectBudgetItemId: "", projectCategoryPlanItemId: "", billNumber: "", amount: "", dueDate: "", notes: "" });
    expect(toVendorBillSubmission(payload).success).toBe(false);
  });

  test("maps a complete draft to the final vendor bill contract", () => {
    const payload = vendorBillDraftPayloadSchema.parse({ vendorId: id, projectId: id, projectBudgetCategoryId: id, projectBudgetItemId: "22222222-2222-4222-8222-222222222222", projectCategoryPlanItemId: "", billNumber: "VB-2026-001", amount: 2_500_000, dueDate: "2026-07-20", notes: "Material kitchen" });
    const result = toVendorBillSubmission(payload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("projectBudgetItemId");
  });
});
