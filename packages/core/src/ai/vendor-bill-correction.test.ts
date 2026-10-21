import { expect, test } from "bun:test";
import {
  vendorBillCorrectionInputSchema,
  procurementWarehouseInputSchema,
  procurementWarehousePermission,
} from "./procurement-warehouse";
const input = {
  action: "VENDOR_BILL_CORRECT",
  vendorBillId: "10000000-0000-4000-8000-000000000001",
  patch: { amount: 125000 },
  reason: "Sesuai invoice revisi pemasok",
};
test("stored bill corrections accept only explicit finite precise partial documentary/amount patches", () => {
  expect(procurementWarehouseInputSchema.parse(input).action).toBe("VENDOR_BILL_CORRECT");
  expect(procurementWarehousePermission("VENDOR_BILL_CORRECT")).toBe("update:vendor_bill");
  for (const patch of [
    {},
    { amount: 0 },
    { amount: -1 },
    { amount: Infinity },
    { amount: 1.001 },
    { amount: 1e14 },
    { dueDate: "2026-02-31" },
    { status: "PAID" },
    { vendorId: input.vendorBillId },
    { projectId: input.vendorBillId },
    { projectBudgetCategoryId: input.vendorBillId },
    { notes: "a".repeat(2001) },
  ])
    expect(vendorBillCorrectionInputSchema.safeParse({ ...input, patch }).success).toBe(false);
  expect(vendorBillCorrectionInputSchema.safeParse({ ...input, reason: "short" }).success).toBe(
    false,
  );
  const metadata = vendorBillCorrectionInputSchema.parse({
    ...input,
    patch: { notes: null, dueDate: "2026-10-20" },
  });
  expect(metadata.patch.amount).toBeUndefined();
  expect(metadata.patch.notes).toBeNull();
});
