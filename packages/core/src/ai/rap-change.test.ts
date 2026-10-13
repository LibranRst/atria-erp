import { expect, test } from "bun:test";
import {
  buildRapChangeRows,
  rapChangePlanTotals,
  rapChangeInputSchema,
  rapChangeIdentitySchema,
  type RapItemSnapshot,
} from "./rap-change";
const id = "11111111-1111-1111-1111-111111111111",
  other = "22222222-2222-2222-2222-222222222222";
const item: RapItemSnapshot = {
  itemId: id,
  materialId: null,
  name: "Panel",
  unit: "lembar",
  description: null,
  internalNote: null,
  source: "PURCHASE",
  area: "Utama",
  requiredQuantity: 0.1,
  bufferQuantity: 0.2,
  estimatedUnitCost: 1000.1,
  totalQuantity: 0.3,
  estimatedTotalCost: 300.03,
};
test("mixed saved RAP changes preserve identities, exact math, and untouched items", () => {
  const items = [item, { ...item, itemId: other, estimatedTotalCost: 200 }];
  const rows = buildRapChangeRows(
    rapChangeInputSchema.parse({
      projectId: id,
      rows: [
        { action: "UPDATE", itemId: id, changes: { requiredQuantity: 0.2 } },
        { action: "DELETE", itemId: other },
      ],
    }),
    items,
  );
  expect(rows[0].after).toMatchObject({
    materialId: null,
    name: "Panel",
    unit: "lembar",
    totalQuantity: 0.4,
    estimatedTotalCost: 400.04,
  });
  expect(rapChangePlanTotals(items, rows)).toEqual({
    beforePlan: 500.03,
    afterPlan: 400.04,
    delta: -99.99,
  });
});
test("50 change boundary, duplicate IDs, missing targets and no-op edits", () => {
  expect(
    rapChangeInputSchema.safeParse({
      projectId: id,
      rows: Array.from({ length: 50 }, (_, i) => ({
        action: "DELETE",
        itemId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      })),
    }).success,
  ).toBe(true);
  expect(
    rapChangeInputSchema.safeParse({
      projectId: id,
      rows: Array.from({ length: 51 }, (_, i) => ({
        action: "DELETE",
        itemId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      })),
    }).success,
  ).toBe(false);
  expect(
    rapChangeInputSchema.safeParse({
      projectId: id,
      rows: [
        { action: "DELETE", itemId: id },
        { action: "DELETE", itemId: id },
      ],
    }).success,
  ).toBe(false);
  expect(() =>
    buildRapChangeRows({ projectId: id, rows: [{ action: "DELETE", itemId: other }] }, [item]),
  ).toThrow();
  expect(() =>
    buildRapChangeRows(
      { projectId: id, rows: [{ action: "UPDATE", itemId: id, changes: { area: "Utama" } }] },
      [item],
    ),
  ).toThrow();
});
test("two decimals, explicit identity changes and confirmations accept no business patch", () => {
  expect(
    rapChangeInputSchema.safeParse({
      projectId: id,
      rows: [{ action: "UPDATE", itemId: id, changes: { requiredQuantity: 0.123 } }],
    }).success,
  ).toBe(false);
  expect(
    rapChangeInputSchema.safeParse({
      projectId: id,
      rows: [{ action: "UPDATE", itemId: id, changes: { itemId: other } }],
    }).success,
  ).toBe(false);
  expect(
    rapChangeIdentitySchema.safeParse({ conversationId: id, toolCallId: "x", rows: [] }).success,
  ).toBe(false);
});

test("unspecified saved area is preserved verbatim", () => {
  const existing = { ...item, area: "  Ruang lama  " };
  const input = rapChangeInputSchema.parse({
    projectId: id,
    rows: [{ action: "UPDATE", itemId: id, changes: { requiredQuantity: 0.2 } }],
  });
  expect(buildRapChangeRows(input, [existing])[0].after?.area).toBe(existing.area);
});

test("explicit identity/detail changes retain row identity and exact amounts", () => {
  const rows = buildRapChangeRows(
    rapChangeInputSchema.parse({
      projectId: id,
      rows: [
        {
          action: "UPDATE",
          itemId: id,
          changes: { name: "Panel baru", description: "Spesifikasi", source: "VENDOR" },
        },
      ],
    }),
    [item],
  );
  expect(rows[0].after).toMatchObject({
    itemId: id,
    name: "Panel baru",
    description: "Spesifikasi",
    source: "VENDOR",
    estimatedTotalCost: 300.03,
  });
});
