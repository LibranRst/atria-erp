import { describe, expect, test } from "bun:test";

import { calculateRabSellingUnitPrice, getRapItemAvailabilityStatus } from "./rap-rab";
import {
  addProjectRapItemSchema,
  createRabBundleSchema,
  generateRabFromSelectedSourcesSchema,
  updateRabEstimateItemSchema,
} from "../validations/rap-rab";
import { createProjectCategoryPlanItemSchema } from "../validations/category-plan";
import { calculateQuotationTotal } from "./quotation-total";

describe("RAP material plan and RAB generation helpers", () => {
  test("calculates RAP material readiness from stock and purchase source", () => {
    expect(
      getRapItemAvailabilityStatus({
        totalQuantity: 10,
        availableStock: 12,
        source: "STOCK",
      }),
    ).toBe("READY");
    expect(
      getRapItemAvailabilityStatus({
        totalQuantity: 10,
        availableStock: 4,
        source: "STOCK_AND_PURCHASE",
      }),
    ).toBe("WAITING_PURCHASE");
    expect(
      getRapItemAvailabilityStatus({
        totalQuantity: 10,
        availableStock: 0,
        source: "PURCHASE",
      }),
    ).toBe("SHORTAGE");
  });

  test("uses target margin pricing for generated client RAB draft", () => {
    expect(
      calculateRabSellingUnitPrice({
        costUnitPrice: 900_000,
        targetGrossPercentage: 10,
      }),
    ).toBe(1_000_000);
    expect(
      calculateRabSellingUnitPrice({
        costUnitPrice: 500_000,
        targetGrossPercentage: 0,
      }),
    ).toBe(500_000);
  });

  test("validates RAP item input with internal-only note", () => {
    const parsed = addProjectRapItemSchema.safeParse({
      projectRapId: "77777777-7777-7777-7777-777777777773",
      materialId: "13131313-1313-1313-1313-131313131301",
      area: "Kitchen",
      name: "Multipleks kabinet bawah",
      requiredQuantity: 12,
      bufferQuantity: 1,
      unit: "lembar",
      estimatedUnitCost: 350_000,
      source: "STOCK_AND_PURCHASE",
      internalNote: "Harga vendor internal, jangan tampil ke client",
    });

    expect(parsed.success).toBe(true);
  });

  test("validates RAB item input as client-safe commercial fields only", () => {
    const parsed = updateRabEstimateItemSchema.safeParse({
      rabEstimateItemId: "88888888-8888-8888-8888-888888888801",
      clientLabel: "Pekerjaan kabinet kitchen",
      description: "Supply dan install kabinet sesuai desain.",
      quantity: 1,
      unit: "ls",
      unitPrice: 17_500_000,
      displayOrder: 1,
      isHidden: false,
      isBundle: true,
    });

    expect(parsed.success).toBe(true);
  });

  test("validates light Tukang/Subcon package planning input", () => {
    const parsed = createProjectCategoryPlanItemSchema.safeParse({
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323101",
      name: "Kitchen installation crew",
      scopeDescription: "Scope kerja tukang untuk area kitchen.",
      area: "Kitchen",
      quantity: 1,
      unit: "paket",
      estimatedUnitCost: 45_000_000,
      internalNote: "Catatan internal tidak boleh masuk quotation client.",
    });

    expect(parsed.success).toBe(true);
  });

  test("validates mixed quotation source generation", () => {
    const parsed = generateRabFromSelectedSourcesSchema.safeParse({
      projectId: "77777777-7777-7777-7777-777777777771",
      projectRapItemIds: ["17171717-1717-1717-1717-171717171701"],
      projectCategoryPlanItemIds: ["35353535-3535-3535-3535-353535353501"],
      manualLines: [
        {
          clientLabel: "Project coordination",
          description: "Koordinasi proyek dan dokumentasi progress.",
          quantity: 1,
          unit: "paket",
          unitPrice: 12_500_000,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  test("rejects empty quotation source generation", () => {
    const parsed = generateRabFromSelectedSourcesSchema.safeParse({
      projectId: "77777777-7777-7777-7777-777777777771",
      projectRapItemIds: [],
      projectCategoryPlanItemIds: [],
      manualLines: [],
    });

    expect(parsed.success).toBe(false);
  });

  test("calculates named bundle once without double-counting its members", () => {
    expect(
      calculateQuotationTotal(
        [
          { bundleId: "bundle-1", isHidden: false, lineTotal: 80_000_000 },
          { bundleId: "bundle-1", isHidden: false, lineTotal: 55_000_000 },
          { bundleId: null, isHidden: false, lineTotal: 30_000_000 },
          { bundleId: null, isHidden: true, lineTotal: 9_000_000 },
        ],
        [{ id: "bundle-1", isHidden: false, lineTotal: 135_000_000 }],
      ),
    ).toBe(165_000_000);
  });

  test("named bundle requires at least two member lines", () => {
    const parsed = createRabBundleSchema.safeParse({
      rabEstimateId: "88888888-8888-8888-8888-888888888801",
      itemIds: ["99999999-9999-9999-9999-999999999901"],
      clientLabel: "Kitchen package",
      quantity: 1,
      unit: "paket",
      unitPrice: 135_000_000,
    });
    expect(parsed.success).toBe(false);
  });
});
