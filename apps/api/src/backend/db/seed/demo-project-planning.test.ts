import { describe, expect, test } from "bun:test";
import { calculateRabBudgetDerivation } from "@atria/core/budget/excel-budget";
import { createDemoClock, DEMO_IDS, parseMoneyToMinor } from "./demo-contract";
import { buildDevelopmentPlanningDataset } from "./demo-project-planning";

const clock = createDemoClock({ anchorDate: "2026-10-06" });

describe("development project planning", () => {
  test("client totals reconcile exactly while bundled details are charged once", () => {
    const data = buildDevelopmentPlanningDataset(clock);
    for (const scenario of data.scenarios) {
      if (!scenario.rabEstimateId) continue;
      const items = data.rabItems.filter((row) => row.rabEstimateId === scenario.rabEstimateId);
      const bundles = data.rabBundles.filter((row) => row.rabEstimateId === scenario.rabEstimateId);
      const result = calculateRabBudgetDerivation({
        items: items.map((row) => ({ ...row, isHidden: row.isHidden ?? false })),
        bundles: bundles.map((row) => ({
          ...row,
          id: row.id ?? "",
          isHidden: row.isHidden ?? false,
        })),
        budgetCapRatio: 0.9,
      });
      expect(parseMoneyToMinor(result.approvedValue.toFixed(2))).toBe(
        parseMoneyToMinor(scenario.contractValue),
      );
      expect(bundles.length).toBe(scenario.roomCount);
      expect(items.filter((row) => row.bundleId).length).toBeGreaterThan(
        scenario.materialItemCount,
      );
      for (const row of [...items, ...bundles]) {
        const calculated =
          (parseMoneyToMinor(row.quantity ?? "1.00") * parseMoneyToMinor(row.unitPrice) + 50n) /
          100n;
        expect(parseMoneyToMinor(row.lineTotal)).toBe(calculated);
        expect(parseMoneyToMinor(row.lineTotal)).toBe(
          (parseMoneyToMinor(row.quantity ?? "1.00") * parseMoneyToMinor(row.unitPrice)) / 100n,
        );
      }
    }
  });

  test("material quantities, budget scopes and source snapshots form a connected graph", () => {
    const data = buildDevelopmentPlanningDataset(clock);
    const materials = new Map(data.rapItems.map((row) => [row.id, row]));
    const packages = new Map(data.categoryPlanItems.map((row) => [row.id, row]));
    const rapById = new Map(data.projectRaps.map((row) => [row.id, row]));
    const rabById = new Map(data.rabEstimates.map((row) => [row.id, row]));
    for (const scenario of data.scenarios) {
      expect(scenario.materialItemCount).toBeGreaterThanOrEqual(18);
      expect(scenario.categoryPlanItemCount).toBeGreaterThanOrEqual(6);
    }
    for (const item of materials.values()) {
      const quantity =
        parseMoneyToMinor(item.requiredQuantity) + parseMoneyToMinor(item.bufferQuantity ?? "0.00");
      expect(parseMoneyToMinor(item.totalQuantity)).toBe(quantity);
      expect(parseMoneyToMinor(item.estimatedTotalCost ?? "0.00")).toBe(
        (quantity * parseMoneyToMinor(item.estimatedUnitCost ?? "0.00")) / 100n,
      );
    }
    for (const item of data.rabItems) {
      const estimate = rabById.get(item.rabEstimateId);
      expect(estimate).toBeDefined();
      expect(item.createdAt?.getTime()).toBeGreaterThanOrEqual(estimate?.createdAt?.getTime() ?? 0);
      if (item.sourceType === "RAP_MATERIAL") {
        const source = materials.get(item.sourceProjectRapItemId ?? "");
        expect(source).toBeDefined();
        expect(rapById.get(source?.projectRapId ?? "")?.projectId).toBe(estimate?.projectId);
        expect(item.sourceUpdatedAt?.getTime()).toBe(source?.updatedAt?.getTime());
        expect(item.sourceRevision).toBe(rapById.get(source?.projectRapId ?? "")?.revision);
      } else if (item.sourceType === "CATEGORY_PLAN") {
        const source = packages.get(item.sourceProjectCategoryPlanItemId ?? "");
        expect(source?.projectId).toBe(estimate?.projectId);
        expect(item.sourceUpdatedAt?.getTime()).toBe(source?.updatedAt?.getTime());
        expect(item.sourceRevision).toBe(source?.revision);
      }
      expect(item.description ?? "").not.toMatch(
        /internalNote|margin|markup|quotation vendor aktual/i,
      );
    }
    expect(materials.has("17171717-1717-1717-1717-171717171701")).toBe(true);
    expect(packages.has("35353535-3535-3535-3535-353535353510")).toBe(true);
  });

  test("lifecycle gates and change-order delta stay actionable", () => {
    const data = buildDevelopmentPlanningDataset(clock);
    const cipete = data.scenarios.find((row) => row.projectId === DEMO_IDS.projects.cipete);
    expect(cipete?.rabEstimateId).toBeNull();
    expect(data.projectRaps.find((row) => row.id === cipete?.projectRapId)?.setupStage).toBe(
      "REVIEW",
    );
    expect(data.projectRaps.some((row) => row.projectId === DEMO_IDS.projects.pakubuwono)).toBe(
      false,
    );
    const base = data.scenarios.find((row) => row.key === "sudirman");
    const revised = data.scenarios.find((row) => row.key === "sudirman-revision");
    expect(
      parseMoneyToMinor(revised?.contractValue ?? "0.00") -
        parseMoneyToMinor(base?.contractValue ?? "0.00"),
    ).toBe(13500000000n);
    expect(data.projectRaps.find((row) => row.id === revised?.projectRapId)?.status).toBe("LOCKED");
    const cancelledEstimateId = "19191919-1919-1919-1919-191919191904";
    const cancelledDerivation = calculateRabBudgetDerivation({
      items: data.rabItems
        .filter((row) => row.rabEstimateId === cancelledEstimateId)
        .map((row) => ({ ...row, isHidden: row.isHidden ?? false })),
      bundles: data.rabBundles
        .filter((row) => row.rabEstimateId === cancelledEstimateId)
        .map((row) => ({ ...row, id: row.id ?? "", isHidden: row.isHidden ?? false })),
      budgetCapRatio: 0.9,
    });
    expect(cancelledDerivation.approvedValue).toBe(890000000);
    expect(data.rabEstimates.find((row) => row.id === cancelledEstimateId)?.status).toBe("VOID");
    for (const scenario of data.scenarios.filter((row) => row.key !== "sudirman")) {
      const categories = [...data.newBudgetCategories, ...data.categoryAllocationUpdates].filter(
        (row) =>
          row.id?.startsWith(
            `32323232-3232-3232-3232-323232323${scenario.key === "sudirman-revision" ? 2 : scenario.key === "bsd" ? 7 : scenario.key === "kemang" ? 8 : scenario.key === "senopati" ? 4 : scenario.key === "brawijaya" ? 3 : scenario.key === "cipete" ? 6 : 1}0`,
          ),
      );
      const planned = [
        scenario.plannedTukangCost,
        scenario.plannedMaterialCost,
        "0.00",
        "0.00",
        scenario.plannedSubconCost,
      ];
      for (const [index, category] of categories.entries()) {
        if (scenario.key === "cipete" && index === 4) {
          expect(category.allocatedAmount).toBe("0.00");
        } else
          expect(parseMoneyToMinor(category.allocatedAmount ?? "0.00")).toBeGreaterThanOrEqual(
            parseMoneyToMinor(planned[index] ?? "0.00"),
          );
      }
    }
  });
});
