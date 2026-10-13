import { describe, test, expect } from "bun:test";
import { financeInputSchema, financeInputPermission } from "./finance-input";
import {
  approvalThresholdInputSchema,
  expenseCategoryInputSchema,
  isCoreExpenseCode,
} from "./operational-settings";
const id = "00000000-0000-4000-8000-000000000001";
const reason = "Perubahan kebijakan yang sudah ditinjau Owner";
describe("operational Settings contract", () => {
  test("thresholds are partial rupiah patches, preserve zero and exact cents", () => {
    const input = financeInputSchema.parse({
      action: "APPROVAL_THRESHOLDS",
      patch: { fieldCostAmount: 0, vendorPaymentAmount: 100.5 },
      reason,
    });
    expect(input.action).toBe("APPROVAL_THRESHOLDS");
    expect(financeInputPermission(input)).toBe("manage:approval_settings");
    expect(
      approvalThresholdInputSchema.parse({
        action: "APPROVAL_THRESHOLDS",
        patch: { fieldCostAmount: 0 },
        reason,
      }).patch.vendorPaymentAmount,
    ).toBeUndefined();
  });
  test("empty, invalid and disguised security changes are rejected", () => {
    for (const patch of [
      {},
      { fieldCostAmount: -1 },
      { fieldCostAmount: 0.001 },
      { fieldCostAmount: Infinity },
      { fieldCostAmount: 1_000_000_001 },
      { roleId: id },
      { requiresOwnerApproval: false },
    ]) {
      expect(
        approvalThresholdInputSchema.safeParse({ action: "APPROVAL_THRESHOLDS", patch, reason })
          .success,
      ).toBe(false);
    }
    expect(
      approvalThresholdInputSchema.safeParse({
        action: "APPROVAL_THRESHOLDS",
        patch: { fieldCostAmount: 1 },
        reason: "ok",
      }).success,
    ).toBe(false);
  });
  test("category identity/code cannot be patched; omissions and explicit clearing differ", () => {
    const input = expenseCategoryInputSchema.parse({
      action: "EXPENSE_CATEGORY_SETTINGS",
      expenseCategoryId: id,
      patch: { description: null },
      reason,
    });
    expect(input.patch.description).toBeNull();
    expect(input.patch.name).toBeUndefined();
    expect(financeInputPermission(input)).toBe("manage:expense_categories");
    for (const patch of [
      {},
      { code: "TUKANG" },
      { expenseCategoryId: id },
      { name: " " },
      { defaultRatio: 1.1 },
      { defaultRatio: 0.0000001 },
    ])
      expect(expenseCategoryInputSchema.safeParse({ ...input, patch }).success).toBe(false);
  });
  test("canonical bucket identity is independent of display name", () => {
    expect(isCoreExpenseCode("MATERIAL")).toBe(true);
    expect(isCoreExpenseCode("LAIN_LAIN")).toBe(true);
    expect(isCoreExpenseCode("Custom QA")).toBe(false);
  });
});
