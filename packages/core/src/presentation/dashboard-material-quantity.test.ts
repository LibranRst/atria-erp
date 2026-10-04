import { describe, expect, test } from "bun:test";
import {
  formatDashboardMaterialQuantity,
  hasDashboardMaterialStockContext,
  type DashboardMaterialQuantityInput,
} from "./dashboard-material-quantity";

function issue(overrides: Partial<DashboardMaterialQuantityInput>): DashboardMaterialQuantityInput {
  return {
    type: "RAP_SHORTAGE",
    availableStock: 2,
    requiredStock: 8,
    quantity: null,
    unit: "lembar",
    ...overrides,
  };
}

describe("dashboard material quantity meaning", () => {
  test("RAP shortage shows the unmet need, not available stock or a movement quantity", () => {
    expect(formatDashboardMaterialQuantity(issue({ quantity: 99 }), true)).toBe("Kurang 6 lembar");
    expect(formatDashboardMaterialQuantity(issue({ availableStock: 10 }), true)).toBe(
      "Kurang 0 lembar",
    );
    expect(formatDashboardMaterialQuantity(issue({ requiredStock: null }), true)).toBeNull();
  });

  test("low stock describes available inventory rather than claiming that amount is a deficit", () => {
    expect(formatDashboardMaterialQuantity(issue({ type: "LOW_STOCK", quantity: 99 }), true)).toBe(
      "Tersedia 2 lembar",
    );
  });

  test("waste and adjustment preserve their movement meaning and supplied sign", () => {
    expect(formatDashboardMaterialQuantity(issue({ type: "WASTE", quantity: 5 }), true)).toBe(
      "Terbuang 5 lembar",
    );
    expect(formatDashboardMaterialQuantity(issue({ type: "ADJUSTMENT", quantity: 3 }), true)).toBe(
      "Penyesuaian 3 lembar",
    );
    expect(formatDashboardMaterialQuantity(issue({ type: "ADJUSTMENT", quantity: -3 }), true)).toBe(
      "Penyesuaian -3 lembar",
    );
  });

  test("missing reversal quantity does not fabricate a stock shortage", () => {
    expect(formatDashboardMaterialQuantity(issue({ type: "REVERSAL_REQUEST" }), true)).toBeNull();
    expect(
      formatDashboardMaterialQuantity(issue({ type: "REVERSAL_REQUEST", quantity: 1.5 }), true),
    ).toBe("Pembatalan 1,5 lembar");
  });

  test("historical movement placeholder stock is not treated as current physical inventory", () => {
    const waste = issue({ type: "WASTE", availableStock: 0, quantity: 5 });
    const adjustment = issue({ type: "ADJUSTMENT", availableStock: 0, quantity: 3 });
    const reversal = issue({ type: "REVERSAL_REQUEST", availableStock: 0 });
    expect(hasDashboardMaterialStockContext(waste)).toBe(false);
    expect(hasDashboardMaterialStockContext(adjustment)).toBe(false);
    expect(hasDashboardMaterialStockContext(reversal)).toBe(false);
    expect(hasDashboardMaterialStockContext(issue({}))).toBe(true);
    expect(hasDashboardMaterialStockContext(issue({ type: "LOW_STOCK" }))).toBe(true);
  });

  test("detailed rows keep their numeric quantity presentation", () => {
    expect(formatDashboardMaterialQuantity(issue({ type: "WASTE", quantity: 5 }))).toBe("5 lembar");
    expect(formatDashboardMaterialQuantity(issue({}))).toBe("6 lembar");
  });
});
