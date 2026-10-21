import { expect, test } from "bun:test";
import { materialsFixtureData } from "../../../../.storybook/materials-data.fixture";
import { materialNeedComparisons, materialStockComparisons } from "./material-desktop-model";
import { getGroupedMaterialStockSummary } from "../../utils/material-ui-utils";

test("a warehouse filter changes the quantities being compared, rather than only hiding material names", () => {
  const data = materialsFixtureData("complete");
  const first = data.inventory[0];
  if (!first) throw new Error("Inventory fixture is empty");
  const group = {
    id: first.materialId,
    name: first.materialName,
    categoryName: first.categoryName,
    rows: [
      { ...first, currentStock: 8.25, reservedStock: 1.5, availableStock: 6.75 },
      {
        ...first,
        inventoryId: "second",
        locationId: "other",
        currentStock: 100,
        reservedStock: 20,
        availableStock: 80,
      },
    ],
    shortages: [],
  };
  const scoped = materialStockComparisons([group], first.locationId);
  expect(scoped[0]?.summary.currentStock).toBe(8.25);
  expect(scoped[0]?.summary.reservedStock).toBe(1.5);
  expect(scoped[0]?.summary.availableStock).toBe(6.75);
  expect(materialStockComparisons([group], "ALL")[0]?.summary).toEqual(
    getGroupedMaterialStockSummary(group),
  );
  expect(materialStockComparisons([group], "missing")).toEqual([]);
});

test("RAP comparison retains each source unit and refuses to invent a project or unit", () => {
  const data = materialsFixtureData("complete");
  const project = data.projects[0];
  const item = project?.rapItems[0];
  const row = data.shortages[0];
  if (!project || !item || !row) throw new Error("Need fixture is empty");
  const known = materialNeedComparisons({
    ...data,
    shortages: [{ ...row, projectRapItemId: item.id }],
  });
  expect(known[0]?.unit).toBe(item.unit);
  expect(known[0]?.projectId).toBe(project.id);
  const missing = materialNeedComparisons({ ...data, projects: [], shortages: [row] });
  expect(missing[0]?.unit).toBeNull();
  expect(missing[0]?.projectId).toBeNull();
  expect(missing[0]?.needToBuy).toBe(row.needToBuy);
  expect(missing[0]?.estimatedTotalCost).toBe(row.estimatedTotalCost);
  const historic = materialNeedComparisons({
    ...data,
    projects: [],
    shortages: [{ ...row, projectId: "closed-project", projectName: "Sumber selesai", unit: "m²" }],
  });
  expect(historic[0]?.projectId).toBe("closed-project");
  expect(historic[0]?.projectName).toBe("Sumber selesai");
  expect(historic[0]?.unit).toBe("m²");
  expect(historic[0]?.needToBuy).toBe(row.needToBuy);
  const baseline = materialNeedComparisons({
    ...data,
    shortages: [
      { ...row, projectId: "baseline-project", projectName: "Baseline sumber", unit: "kg" },
    ],
  });
  expect(baseline[0]?.projectId).toBe("baseline-project");
  expect(baseline[0]?.unit).toBe("kg");
});
