import { expect, test } from "bun:test";
import { budgetUsageSummary } from "./usage-summary";
import { budgetSyncInputSchema, budgetSyncIdentitySchema } from "../ai/budget-sync";
test("canonical usage keeps exact cents, excludes draft/rejected/void and counts partial settlement once", () => {
  const summary = budgetUsageSummary("1.00", {
    expenses: [
      { amount: "0.10", status: "SUBMITTED", vendorBillId: null },
      { amount: "0.20", status: "VERIFIED", vendorBillId: null },
      { amount: "0.30", status: "APPROVED", vendorBillId: "bill" },
      { amount: "0.45", status: "PAID", vendorBillId: null },
      ...["DRAFT", "REJECTED", "VOID"].map((status) => ({
        amount: "100.00",
        status,
        vendorBillId: null,
      })),
    ],
    payments: [
      { vendorBillId: "bill", status: "COMPLETED", amountPaid: "0.10" },
      { vendorBillId: "bill", status: "PENDING", amountPaid: "99.00" },
    ],
  });
  expect(summary).toEqual({
    pendingAmount: "0.30",
    actualAmount: "0.75",
    paidAmount: "0.55",
    remainingAmount: "0.25",
    usedPercentage: "75.0000",
    status: "WATCH",
  });
});
test("full settlement is capped and paid expense is not counted twice; over-budget uses negative remaining", () => {
  expect(
    budgetUsageSummary("10.00", {
      expenses: [{ amount: "12.25", status: "PAID", vendorBillId: "bill" }],
      payments: [{ vendorBillId: "bill", status: "COMPLETED", amountPaid: "99.00" }],
    }),
  ).toEqual({
    pendingAmount: "0.00",
    actualAmount: "12.25",
    paidAmount: "12.25",
    remainingAmount: "-2.25",
    usedPercentage: "122.5000",
    status: "OVER_BUDGET",
  });
  expect(
    budgetUsageSummary("10.00", {
      expenses: [{ amount: "9.50", status: "APPROVED", vendorBillId: null }],
      payments: [],
    }).status,
  ).toBe("CRITICAL");
});
test("inspection input and confirmation cannot accept arbitrary values or actor identities", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  expect(budgetSyncInputSchema.safeParse({ projectId: id, allocatedAmount: "1.00" }).success).toBe(
    false,
  );
  expect(
    budgetSyncIdentitySchema.safeParse({ conversationId: id, toolCallId: "call", userId: id })
      .success,
  ).toBe(false);
});
