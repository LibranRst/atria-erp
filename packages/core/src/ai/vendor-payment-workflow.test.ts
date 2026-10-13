import { expect, test } from "bun:test";
import {
  vendorPaymentScheduleSchema,
  vendorPaymentDecisionSchema,
  vendorPaymentPaySchema,
  vendorPaymentWorkflowIdentitySchema,
  vendorPaymentWorkflowPermission,
} from "./vendor-payment-workflow";
const id = "77777777-7777-7777-7777-777777777777";
test("schedule requires exact positive cents, explicit calendar date and verified identifiers", () => {
  const valid = {
    action: "SCHEDULE",
    vendorBillId: id,
    bankAccountId: id,
    amount: 125000.25,
    paymentDate: "2026-10-31",
  };
  expect(vendorPaymentScheduleSchema.safeParse(valid).success).toBe(true);
  for (const patch of [
    { amount: 0 },
    { amount: 1.001 },
    { amount: Infinity },
    { paymentDate: "2026-02-30" },
    { bankAccountId: "x" },
    { paymentDate: "tomorrow" },
  ])
    expect(vendorPaymentScheduleSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
});
test("decision needs reason and cannot carry an emergency override", () => {
  const input = { action: "APPROVE", vendorPaymentId: id, notes: "Pembayaran diverifikasi." };
  expect(vendorPaymentDecisionSchema.safeParse(input).success).toBe(true);
  expect(vendorPaymentDecisionSchema.safeParse({ ...input, emergencyOverride: true }).success).toBe(
    false,
  );
  expect(vendorPaymentDecisionSchema.safeParse({ ...input, notes: " " }).success).toBe(false);
  expect(vendorPaymentWorkflowPermission(vendorPaymentDecisionSchema.parse(input))).toBe(
    "approve:cost",
  );
});
test("payment requires human reference and explicit account; confirmation cannot replace values", () => {
  expect(
    vendorPaymentPaySchema.safeParse({ action: "PAY", vendorPaymentId: id, bankAccountId: id })
      .success,
  ).toBe(false);
  expect(
    vendorPaymentPaySchema.parse({
      action: "PAY",
      vendorPaymentId: id,
      bankAccountId: id,
      referenceNumber: "  BANK-123  ",
    }).referenceNumber,
  ).toBe("BANK-123");
  expect(
    vendorPaymentWorkflowIdentitySchema.safeParse({
      conversationId: id,
      toolCallId: "tool",
      amount: 100,
    }).success,
  ).toBe(false);
});
