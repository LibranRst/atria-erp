import { expect, test } from "bun:test";
import {
  expenseBatchRequestSchema,
  expenseBatchActionInputSchema,
  expenseBatchSubmitSchema,
  expenseBatchActionPermissions,
} from "./expense-batch";
const id = "77777777-7777-7777-7777-777777777777";
const row = { description: "Transport lapangan", quantity: 1, unitPrice: 100000, amount: 100000 };
test("batch is bounded to50, incomplete values stay explicit, historical identifiers are accepted", () => {
  expect(
    expenseBatchRequestSchema.safeParse({
      projectId: id,
      rows: Array.from({ length: 50 }, () => row),
    }).success,
  ).toBe(true);
  expect(
    expenseBatchRequestSchema.safeParse({
      projectId: id,
      rows: Array.from({ length: 51 }, () => row),
    }).success,
  ).toBe(false);
  expect(
    expenseBatchRequestSchema.parse({ projectId: id, rows: [{ ...row, amount: null }] }).rows?.[0]
      .amount,
  ).toBeNull();
  expect(expenseBatchRequestSchema.safeParse({ rows: [row] }).success).toBe(false);
  expect(expenseBatchRequestSchema.safeParse({ reviewDraftId: id, rows: [row] }).success).toBe(
    false,
  );
});
test("save contract uses stored revision and action token, never accepts replacement money/rows", () => {
  const value = { conversationId: id, toolCallId: "expense", expectedRevision: 1, token: id };
  expect(expenseBatchSubmitSchema.safeParse(value).success).toBe(true);
  expect(expenseBatchSubmitSchema.safeParse({ ...value, rows: [row] }).success).toBe(false);
  expect(expenseBatchSubmitSchema.safeParse({ ...value, expectedRevision: 0 }).success).toBe(false);
});
test("payment requires unique human bank references for every selected row and no emergency bypass", () => {
  const other = "88888888-8888-8888-8888-888888888888";
  const valid = {
    action: "PAY",
    projectId: id,
    costIds: [id, other],
    bankAccountId: id,
    references: [
      { costId: id, referenceNumber: "REF-A" },
      { costId: other, referenceNumber: "REF-B" },
    ],
  };
  expect(expenseBatchActionInputSchema.safeParse(valid).success).toBe(true);
  expect(expenseBatchActionInputSchema.safeParse({ ...valid, references: undefined }).success).toBe(
    false,
  );
  expect(
    expenseBatchActionInputSchema.safeParse({
      ...valid,
      references: [
        { costId: id, referenceNumber: "REF-A" },
        { costId: other, referenceNumber: "REF-A" },
      ],
    }).success,
  ).toBe(false);
  expect(expenseBatchActionInputSchema.safeParse({ ...valid, costIds: [id, id] }).success).toBe(
    false,
  );
  expect(
    expenseBatchActionInputSchema.safeParse({
      action: "APPROVE",
      projectId: id,
      costIds: [id],
      notes: "Sudah diperiksa",
      emergencyOverride: true,
    }).success,
  ).toBe(false);
  expect(expenseBatchActionPermissions("VERIFY")).toEqual(["verify:cost", "update:cost"]);
});
