import { describe, expect, test } from "bun:test";
import { calculateQuotationTotal } from "@atria/core/project/quotation-total";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import { rabExportTotal, rabPrintableSchema } from "@atria/core/ai/rab-export";
import { buildRabExcelRows } from "@/features/projects/detail/utils/rab-export-utils";
import {
  buildRabDesktopRows,
  filterRabDesktopRows,
} from "@/features/projects/detail/components/rab/rab-desktop-model";
import {
  rapRabFixtureData,
  rapRabFixturePermissions,
  rapRabFixtureMaterialMovements,
} from "./rap-rab-data.fixture";
import {
  createProjectRap,
  rapRabFixtureCalls,
  setRapRabFixtureScenario,
} from "./rap-rab-actions.fixture";

describe("safe RAP/RAB visual fixtures", () => {
  test("material facts are projected from representative receipt, reservation and usage records", () => {
    for (const kind of ["complete", "draft-material"] as const) {
      const data = rapRabFixtureData(kind);
      data.rap?.items.forEach((item, index) => {
        const expected = projectMaterialProjection(
          rapRabFixtureMaterialMovements(index, kind === "draft-material"),
          Number(item.totalQuantity),
        );
        for (const [key, value] of Object.entries(expected))
          expect(Reflect.get(item, key)).toBe(value);
      });
    }
    const ready = rapRabFixtureData().rap?.items[1];
    expect(ready?.totalQuantity).toBe("6.00");
    expect(ready?.reservedQuantity).toBe(5);
    expect(ready?.boughtQuantity).toBe(6);
    expect(ready?.usedQuantity).toBe(1);
    expect(ready?.securedQuantity).toBe(6);
    expect(ready?.needToBuy).toBe(0);
  });
  test("complete source exercises pagination, mixed units, procurement, cents and exact package scope", () => {
    const data = rapRabFixtureData();
    expect(data.rap?.items.length).toBeGreaterThan(25);
    expect(new Set(data.rap?.items.map((item) => item.unit)).size).toBeGreaterThan(3);
    expect(data.rap?.items.some((item) => item.needToBuy === 0)).toBe(true);
    expect(data.rap?.items.some((item) => item.needToBuy > 0)).toBe(true);
    expect(data.rap?.items.some((item) => !Number.isInteger(Number(item.estimatedTotalCost)))).toBe(
      true,
    );
    expect(
      data.categoryPlanItems.filter((item) => item.expenseCategoryCode === "TUKANG").length,
    ).toBeGreaterThan(10);
    expect(
      data.categoryPlanItems.filter((item) => item.expenseCategoryCode === "SUBCON").length,
    ).toBeGreaterThan(10);
    for (const material of data.materials)
      expect(material.inventories.reduce((sum, location) => sum + location.availableStock, 0)).toBe(
        material.availableStock,
      );
    expect(data.rap?.status).toBe("LOCKED");
    expect(data.rap?.setupStage).toBe("COMPLETE");
  });
  test("four draft stages have valid completed predecessors and skipped scope has no conflicting packages", () => {
    for (const [kind, stage] of [
      ["draft-material", "MATERIAL"],
      ["draft-tukang", "TUKANG"],
      ["draft-subcon", "SUBCON"],
      ["draft-review", "REVIEW"],
    ] as const) {
      const data = rapRabFixtureData(kind);
      expect(data.rap?.status).toBe("DRAFT");
      expect(data.rap?.setupStage).toBe(stage);
      expect(data.rabEstimate).toBeNull();
      if (stage === "SUBCON" || stage === "REVIEW")
        expect(
          data.categoryPlanItems
            .filter((item) => item.expenseCategoryCode === "TUKANG")
            .every((item) => item.status === "ACTIVE"),
        ).toBe(true);
      if (stage === "REVIEW")
        expect(data.categoryPlanItems.every((item) => item.status === "ACTIVE")).toBe(true);
    }
    const skipped = rapRabFixtureData("skipped-scope");
    expect(skipped.rap?.tukangScopeSkipped).toBe(true);
    expect(skipped.rap?.subconScopeSkipped).toBe(true);
    expect(skipped.categoryPlanItems).toHaveLength(0);
    expect(rapRabFixtureData("empty").rap).toBeNull();
    expect(rapRabFixtureData("empty").rabEstimate).toBeNull();
    const emptyRab = rapRabFixtureData("rab-empty");
    expect(emptyRab.rap?.status).toBe("LOCKED");
    expect(emptyRab.rap?.items.length).toBe(36);
    expect(emptyRab.rabEstimate).toBeNull();
    expect(emptyRab.categoryPlanItems.some((item) => item.status === "ACTIVE")).toBe(true);
  });
  test("RAB totals count visible bundles once and cover manual, package, fee, hidden and member states", () => {
    const data = rapRabFixtureData();
    const estimate = data.rabEstimate;
    if (!estimate) throw new Error("RAB fixture missing");
    expect(estimate.items.length).toBeGreaterThan(25);
    expect(new Set(estimate.items.map((item) => item.sourceType))).toEqual(
      new Set(["RAP_MATERIAL", "CATEGORY_PLAN", "MANUAL_CLIENT_LINE"]),
    );
    expect(estimate.items.some((item) => item.itemNature === "SERVICE_FEE")).toBe(true);
    expect(estimate.items.some((item) => item.bundleId && !item.isHidden)).toBe(true);
    expect(estimate.items.some((item) => item.isHidden)).toBe(true);
    expect(estimate.bundles.some((bundle) => bundle.isHidden)).toBe(true);
    expect(Number(estimate.approvedValue)).toBe(
      calculateQuotationTotal(estimate.items, estimate.bundles),
    );
    expect(rabExportTotal(estimate)).toBe(estimate.approvedValue);
    const rows = buildRabDesktopRows(estimate);
    expect(
      filterRabDesktopRows(rows, { kind: "all", visibility: "all", search: "" }).length,
    ).toBeGreaterThan(25);
    expect(
      filterRabDesktopRows(rows, { kind: "members", visibility: "all", search: "" }),
    ).toHaveLength(5);
  });
  test("revision and stale-source states retain approved history, while permission fixtures split editing from approving", () => {
    const revision = rapRabFixtureData("rab-revision");
    expect(revision.rabEstimate?.status).toBe("DRAFT");
    expect(revision.rabEstimate?.supersedesRabEstimateId).toBe(revision.baselineApprovedRabId);
    expect(revision.revisionHistory.some((row) => row.status === "APPROVED")).toBe(true);
    expect(revision.revisionHistory.some((row) => row.status === "VOID" && row.voidReason)).toBe(
      true,
    );
    expect(rapRabFixtureData("stale-source").staleSourceLabels).toHaveLength(3);
    expect(rapRabFixturePermissions("editor")).toContain("update:rab");
    expect(rapRabFixturePermissions("editor")).not.toContain("approve:rab");
    expect(rapRabFixturePermissions("approver")).toContain("approve:rab");
    expect(rapRabFixturePermissions("approver")).not.toContain("update:rab");
    expect(
      rapRabFixturePermissions("read-only").every((permission) => permission.startsWith("view:")),
    ).toBe(true);
  });
  test("client-safe document projection and Excel rows exclude internal source/stock/notes and hidden values", () => {
    const data = rapRabFixtureData();
    if (!data.rabEstimate) throw new Error("RAB fixture missing");
    const printable = rabPrintableSchema.parse(data.rabEstimate);
    const payload = JSON.stringify(printable);
    expect(payload).not.toContain("sourceProjectRapItemId");
    expect(payload).not.toContain("sourceUpdatedAt");
    const excel = JSON.stringify(buildRabExcelRows(printable, data.exportMetadata));
    expect(excel).toContain("Jasa desain, gambar kerja dan supervisi proyek");
    expect(excel).not.toContain("Catatan internal sintetis");
    expect(excel).not.toContain("Alternatif finishing foyer");
    expect(excel).not.toContain("estimatedUnitCost");
    expect(excel).not.toContain("availableStock");
  });
  test("actual action fixture returns a safe failure and records the invocation without network or persistence", async () => {
    setRapRabFixtureScenario("complete");
    const result = await createProjectRap({ projectId: rapRabFixtureData().projectId });
    expect(result.success).toBe(false);
    expect(rapRabFixtureCalls()).toEqual(["createProjectRap"]);
    setRapRabFixtureScenario("complete");
  });
});
