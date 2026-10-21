import { describe, expect, test } from "bun:test";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import {
  projectOperationsFixtureData,
  projectOperationsFixtureMovements,
  projectOperationsFixturePermissions,
  PROJECT_OPERATIONS_FIXTURE_PROJECT,
} from "./project-operations-data.fixture";
import { getActivityDetail } from "./project-operations-actions.fixture";
import { rapRabFixtureMaterialMovements } from "./rap-rab-data.fixture";

describe("project operations safe preview", () => {
  test("provides complete canonical mixed-unit material coverage and matching movements", () => {
    const data = projectOperationsFixtureData();
    const items = data.projectStockData?.rap?.items ?? [];
    expect(items).toHaveLength(36);
    expect(new Set(items.map((row) => row.unit)).size).toBeGreaterThan(3);
    expect(data.stockMovements.length).toBeGreaterThan(25);
    for (const [index, row] of items.entries()) {
      const projection = projectMaterialProjection(
        rapRabFixtureMaterialMovements(index, false),
        Number(row.totalQuantity),
      );
      expect(row.securedQuantity).toBe(projection.securedQuantity);
      expect(row.needToBuy).toBe(projection.needToBuy);
    }
    expect(data.stockMovements.map((row) => row.id)).toEqual(
      projectOperationsFixtureMovements().map((row) => row.id),
    );
  });
  test("keeps expense IDs and project identity intact for existing action/detail owners", () => {
    const data = projectOperationsFixtureData();
    expect(data.costs.length).toBeGreaterThan(10);
    expect(data.project.id).toBe(PROJECT_OPERATIONS_FIXTURE_PROJECT.id);
    expect(data.costs.every((row) => row.project?.id === data.project.id)).toBe(true);
    expect(data.vendorBills.every((row) => row.projectId === data.project.id)).toBe(true);
    const billIds = new Set(data.vendorBills.map((row) => row.id));
    expect(data.vendorPayments.every((row) => billIds.has(row.vendorBillId))).toBe(true);
  });
  test("does not disguise failed or restricted sources as ready empty; stock-only receives no RAP internals", () => {
    expect(projectOperationsFixtureData("empty").projectStockData?.source.status).toBe("missing");
    const failed = projectOperationsFixtureData("source-error");
    expect(failed.projectStockData?.source.status).toBe("unavailable");
    expect(failed.projectExpensesSource?.costs.status).toBe("unavailable");
    const stock = projectOperationsFixtureData("stock-only");
    expect(stock.project.raps).toHaveLength(0);
    expect(stock.projectStockData?.rap?.items).toHaveLength(36);
    expect(JSON.stringify(stock.projectStockData?.rap)).not.toContain("estimatedUnitCost");
    expect(JSON.stringify(stock.projectStockData?.rap)).not.toContain("internalNote");
    expect(projectOperationsFixturePermissions("stock-only")).toContain("reserve:stock");
    expect(projectOperationsFixturePermissions("stock-only")).not.toContain("use:stock");
    const assigned = projectOperationsFixtureData("assigned");
    expect(assigned.bankAccounts).toHaveLength(0);
    expect(assigned.vendorPayments.every((row) => !row.bankAccount)).toBe(true);
  });
  test("opens exact fixture stock IDs and falls through to existing expense detail", async () => {
    const row = projectOperationsFixtureMovements()[4]!;
    const response = await getActivityDetail({ kind: "STOCK_MOVEMENT", id: row.id });
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.id).toBe(row.id);
      expect(response.data.title).toBe(row.material.name);
      expect(
        response.data.facts.some(
          (fact) => fact.value.type === "QUANTITY" && fact.value.value === Number(row.quantity),
        ),
      ).toBe(true);
    }
    const cost = projectOperationsFixtureData().costs[0]!;
    const expense = await getActivityDetail({ kind: "PROJECT_COST", id: cost.id });
    expect(expense.success).toBe(true);
    if (expense.success) expect(expense.data.id).toBe(cost.id);
  });
});
