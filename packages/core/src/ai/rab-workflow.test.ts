import { test, expect } from "bun:test";
import {
  previewRabChanges,
  rabWorkflowRequestSchema,
  rabWorkflowLineFieldsSchema,
  rabWorkflowProposalSchema,
  rabWorkflowTotal,
  type RabWorkflowItem,
} from "./rab-workflow";
const ids = ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"];
const fields = rabWorkflowLineFieldsSchema.parse({
  clientLabel: "Panel dapur",
  description: "Untuk klien",
  quantity: 2,
  unit: "lembar",
  unitPrice: 125000,
});
const items: RabWorkflowItem[] = ids.map((id) => ({ ...fields, id, bundleId: null }));
test("bundles replace member totals and dissolution restores selling totals", () => {
  const bundled = previewRabChanges(
    items,
    [],
    rabWorkflowRequestSchema.parse({
      action: "CREATE_BUNDLE",
      itemIds: ids,
      fields: {
        clientLabel: "Paket dapur",
        description: "",
        quantity: 1,
        unit: "paket",
        unitPrice: 400000,
      },
    }),
  );
  expect(rabWorkflowTotal(bundled.items, bundled.bundles)).toBe(400000);
  const dissolved = previewRabChanges(bundled.items, bundled.bundles, {
    action: "DISSOLVE_BUNDLE",
    bundleId: "new-bundle",
  });
  expect(rabWorkflowTotal(dissolved.items, dissolved.bundles)).toBe(500000);
  expect(bundled.rows[0].after).not.toHaveProperty("itemIds");
});
test("exclusion preserves the source while removing selling value", () => {
  const preview = previewRabChanges(items, [], {
    action: "EDIT_DRAFT",
    rows: [{ action: "EXCLUDE", itemId: ids[0] }],
  });
  expect(preview.items).toHaveLength(2);
  expect(rabWorkflowTotal(preview.items, preview.bundles)).toBe(250000);
  expect(preview.rows[0].before?.isHidden).toBe(false);
  expect(preview.rows[0].after?.isHidden).toBe(true);
  expect(() =>
    rabWorkflowProposalSchema.parse({
      kind: "RAB_WORKFLOW",
      projectId: ids[0],
      projectName: "Proyek",
      rabEstimateId: ids[1],
      title: "Penawaran",
      revision: 1,
      request: { action: "EDIT_DRAFT", rows: [{ action: "EXCLUDE", itemId: ids[0] }] },
      expectedContext: "a".repeat(64),
      rows: preview.rows,
      totalBefore: 500000,
      totalAfter: 250000,
      budgetImpact: null,
      warning: null,
    }),
  ).not.toThrow();
});
test("ambiguous changes, hidden members and missing override reasons fail", () => {
  expect(rabWorkflowRequestSchema.safeParse({ action: "EDIT_DRAFT", rows: [] }).success).toBe(
    false,
  );
  expect(
    rabWorkflowRequestSchema.safeParse({
      action: "APPROVE_CHANGE_ORDER",
      changeOrderId: ids[0],
      emergencyOverride: true,
    }).success,
  ).toBe(false);
  expect(() =>
    previewRabChanges(
      items.map((row) => ({ ...row, isHidden: true })),
      [],
      { action: "CREATE_BUNDLE", itemIds: ids, fields },
    ),
  ).toThrow();
});
