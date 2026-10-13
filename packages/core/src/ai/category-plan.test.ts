import { describe, expect, test } from "bun:test";
import {
  packageInputSchema,
  packageIdentitySchema,
  packageCost,
  packagePlanTotal,
} from "./category-plan";
const id = "00000000-0000-0000-0000-000000000001";
const manual = {
  action: "CREATE",
  category: "TUKANG",
  draft: {
    source: "MANUAL",
    name: "Pasang panel",
    area: "Lantai 1",
    quantity: 1.25,
    unit: "m2",
    estimatedUnitCost: 125000,
  },
};
describe("AI package contracts", () => {
  test("accepts50 candidates and refuses51 or duplicate update IDs", () => {
    expect(
      packageInputSchema.safeParse({
        projectId: id,
        rows: Array.from({ length: 50 }, () => manual),
      }).success,
    ).toBe(true);
    expect(
      packageInputSchema.safeParse({
        projectId: id,
        rows: Array.from({ length: 51 }, () => manual),
      }).success,
    ).toBe(false);
    expect(
      packageInputSchema.safeParse({
        projectId: id,
        rows: [
          { action: "UPDATE", itemId: id, changes: { quantity: 2 } },
          { action: "UPDATE", itemId: id, changes: { unit: "ls" } },
        ],
      }).success,
    ).toBe(false);
  });
  test("preserves omitted update fields while accepting explicit clearing", () => {
    const parsed = packageInputSchema.parse({
      projectId: id,
      rows: [{ action: "UPDATE", itemId: id, changes: { quantity: 2 } }],
    });
    expect(parsed.rows[0]).toEqual({ action: "UPDATE", itemId: id, changes: { quantity: 2 } });
    expect(
      packageInputSchema.safeParse({
        projectId: id,
        rows: [{ action: "UPDATE", itemId: id, changes: { vendorId: null } }],
      }).success,
    ).toBe(true);
    expect(
      packageInputSchema.safeParse({
        projectId: id,
        rows: [{ action: "UPDATE", itemId: id, changes: {} }],
      }).success,
    ).toBe(false);
  });
  test("requires a reason for library price overrides and complete manual input", () => {
    const row = {
      action: "CREATE",
      category: "SUBCON",
      draft: {
        source: "LIBRARY",
        libraryId: id,
        area: "Fasad",
        quantity: 1,
        overrideUnitCost: 150000,
      },
    };
    expect(packageInputSchema.safeParse({ projectId: id, rows: [row] }).success).toBe(false);
    expect(
      packageInputSchema.safeParse({
        projectId: id,
        rows: [{ ...row, draft: { ...row.draft, overrideReason: "Penawaran vendor disetujui" } }],
      }).success,
    ).toBe(true);
    expect(
      packageInputSchema.safeParse({
        projectId: id,
        rows: [{ ...manual, draft: { ...manual.draft, estimatedUnitCost: undefined } }],
      }).success,
    ).toBe(false);
  });
  test("uses exact cents and validates precision/overflow", () => {
    expect(packageCost({ quantity: 1.25, estimatedUnitCost: 125000 })).toBe(156250);
    expect(packageCost({ quantity: 0.15, estimatedUnitCost: 0.15 })).toBe(0.02);
    expect(packagePlanTotal([0.1, 0.2, -0.1])).toBe(0.2);
    expect(() => packageCost({ quantity: 1.001, estimatedUnitCost: 100 })).toThrow();
    expect(() =>
      packageCost({ quantity: 9999999999.99, estimatedUnitCost: 9999999999999.99 }),
    ).toThrow();
  });
  test("confirmation accepts identity only", () => {
    expect(
      packageIdentitySchema.safeParse({ conversationId: id, toolCallId: "package-1" }).success,
    ).toBe(true);
    expect(
      packageIdentitySchema.safeParse({
        conversationId: id,
        toolCallId: "package-1",
        rows: [manual],
      }).success,
    ).toBe(false);
  });
});
