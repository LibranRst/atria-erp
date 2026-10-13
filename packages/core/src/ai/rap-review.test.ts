import { expect, test } from "bun:test";
import { rapDraftProposalSchema, rapDraftPatchSchema } from "./rap-draft";
import { applyRapDraftPatches, rapEditableFields } from "./rap-review";
const id = "00000000-0000-0000-0000-000000000001";
const base = rapDraftProposalSchema.parse({
  kind: "RAP_MATERIAL_DRAFT",
  projectId: id,
  projectName: "Fixture",
  projectRapId: null,
  expectedContext: "a".repeat(64),
  notes: null,
  rows: [
    {
      rowId: id,
      materialId: id,
      materialName: "Panel",
      name: "Panel",
      unit: "lembar",
      area: "Utama",
      requiredQuantity: 2,
      bufferQuantity: 0.25,
      estimatedUnitCost: 50000,
      totalQuantity: 2.25,
      estimatedTotalCost: 112500,
      availableStock: 1,
      priceSource: "REFERENCE",
      priceSourceLabel: "Harga referensi",
      source: "PURCHASE",
    },
  ],
  budget: {
    categoryId: id,
    categoryName: "Material",
    allocated: 315000,
    actual: 10000,
    pending: 5000,
    remaining: 300000,
    existingPlan: 100000,
    addition: 112500,
    afterPlan: 212500,
    overAllocation: 0,
  },
  stock: [
    {
      materialId: id,
      materialName: "Panel",
      unit: "lembar",
      planQuantity: 7.25,
      available: 1,
      shortage: 6.25,
    },
  ],
});
test("row corrections recalculate plan and stock without changing source identity or budget usage", (): void => {
  const snapshot = JSON.stringify(base);
  const updated = applyRapDraftPatches(base, [
    {
      rowId: id,
      fields: {
        ...rapEditableFields(base.rows[0]),
        requiredQuantity: 3,
        bufferQuantity: 0.5,
        estimatedUnitCost: 100000,
      },
    },
  ]);
  expect(updated.rows[0]).toMatchObject({
    rowId: id,
    materialId: id,
    unit: "lembar",
    totalQuantity: 3.5,
    estimatedTotalCost: 350000,
    priceSource: "USER",
  });
  expect(updated.budget).toMatchObject({
    actual: 10000,
    pending: 5000,
    remaining: 300000,
    existingPlan: 100000,
    addition: 350000,
    afterPlan: 450000,
    overAllocation: 135000,
  });
  expect(updated.stock[0]).toMatchObject({ planQuantity: 8.5, shortage: 7.5 });
  expect(JSON.stringify(base)).toBe(snapshot);
  expect(
    applyRapDraftPatches(base, [
      { rowId: id, fields: { ...rapEditableFields(base.rows[0]), requiredQuantity: 1 } },
    ]).rows[0].priceSource,
  ).toBe("REFERENCE");
});
test("corrections preserve exact cents, reject foreign/duplicate rows and forged identity fields", (): void => {
  expect(
    applyRapDraftPatches(base, [
      {
        rowId: id,
        fields: {
          area: "Utama",
          requiredQuantity: 0.7,
          bufferQuantity: 0,
          estimatedUnitCost: 0.05,
        },
      },
    ]).rows[0].estimatedTotalCost,
  ).toBe(0.04);
  const patch = { rowId: id, fields: rapEditableFields(base.rows[0]) };
  expect(() => applyRapDraftPatches(base, [patch, patch])).toThrow();
  expect(() =>
    applyRapDraftPatches(base, [{ ...patch, rowId: "00000000-0000-0000-0000-000000000002" }]),
  ).toThrow();
  expect(
    rapDraftPatchSchema.safeParse({
      conversationId: id,
      toolCallId: "call",
      expectedRevision: 1,
      rows: [{ ...patch, fields: { ...patch.fields, unit: "kg" } }],
    }).success,
  ).toBe(false);
});
