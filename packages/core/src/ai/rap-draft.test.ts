import { expect, test } from "bun:test";
import { rapDraftIdentitySchema, rapDraftInputSchema } from "./rap-draft";
const id = "00000000-0000-0000-0000-000000000001";
const row = { materialId: id, requiredQuantity: 10 };
test("RAP drafts accept seeded IDs, explicit zero price and conversation rows", (): void => {
  const parsed = rapDraftInputSchema.parse({
    projectId: id,
    rows: [{ ...row, estimatedUnitCost: 0 }],
  });
  expect(parsed.rows[0].area).toBe("Umum");
  expect(parsed.rows[0].bufferQuantity).toBe(0);
  expect(parsed.rows[0].estimatedUnitCost).toBe(0);
});
test("RAP rejects invalid quantities/precision, overflow batches and forged confirmation values", (): void => {
  expect(
    rapDraftInputSchema.safeParse({ projectId: id, rows: Array.from({ length: 51 }, () => row) })
      .success,
  ).toBe(false);
  expect(
    rapDraftInputSchema.safeParse({ projectId: id, rows: [{ ...row, requiredQuantity: 1.005 }] })
      .success,
  ).toBe(false);
  expect(
    rapDraftInputSchema.safeParse({ projectId: id, rows: [{ ...row, requiredQuantity: -2 }] })
      .success,
  ).toBe(false);
  expect(
    rapDraftIdentitySchema.safeParse({ conversationId: id, toolCallId: "call", rows: [row] })
      .success,
  ).toBe(false);
  expect(
    rapDraftInputSchema.safeParse({ projectId: id, rows: [{ ...row, currentStock: 100 }] }).success,
  ).toBe(false);
});
