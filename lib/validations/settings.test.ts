import { describe, expect, it } from "bun:test";

import {
  createMaterialWithInventoryDefaultsSchema,
  createItemPriceLibraryItemSchema,
  updateBudgetAllocationDefaultsSchema,
  updateBudgetAllocationCategoryRatioSchema,
  updateMaterialInventoryDefaultsSchema,
} from "./settings";

const CATEGORY_ID = "31313131-3131-3131-3131-313131313102";
const SETTING_CATEGORY_ID = "42424242-4242-4242-4242-424242424102";
const INVENTORY_ID = "15151515-1515-1515-1515-151515151501";
const SETTING_ID = "42424242-4242-4242-4242-424242424101";
const LOCATION_ID = "15151515-1515-1515-1515-151515151502";

describe("Settings validations", () => {
  it("menerima ratio budget allocation dalam rentang 0 sampai 1", () => {
    const parsed = updateBudgetAllocationCategoryRatioSchema.safeParse({
      budgetAllocationSettingCategoryId: SETTING_CATEGORY_ID,
      ratioPercentage: 0.35,
      isEnabled: true,
    });

    expect(parsed.success).toBe(true);
  });

  it("menolak ratio budget allocation di atas 100%", () => {
    const parsed = updateBudgetAllocationCategoryRatioSchema.safeParse({
      budgetAllocationSettingCategoryId: SETTING_CATEGORY_ID,
      ratioPercentage: 1.2,
      isEnabled: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("menerima batch allocation di bawah 100% sebagai buffer", () => {
    const parsed = updateBudgetAllocationDefaultsSchema.safeParse({
      budgetAllocationSettingId: SETTING_ID,
      name: "Default Project Budget",
      budgetCapRatio: 0.9,
      categories: [
        { budgetAllocationSettingCategoryId: SETTING_CATEGORY_ID, ratioPercentage: 0.545, isEnabled: true },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("menolak total kategori aktif di atas 100%", () => {
    const parsed = updateBudgetAllocationDefaultsSchema.safeParse({
      budgetAllocationSettingId: SETTING_ID,
      name: "Default Project Budget",
      budgetCapRatio: 0.9,
      categories: [
        { budgetAllocationSettingCategoryId: SETTING_CATEGORY_ID, ratioPercentage: 0.6, isEnabled: true },
        { budgetAllocationSettingCategoryId: "42424242-4242-4242-4242-424242424103", ratioPercentage: 0.5, isEnabled: true },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("menolak harga negatif untuk item price library", () => {
    const parsed = createItemPriceLibraryItemSchema.safeParse({
      expenseCategoryId: CATEGORY_ID,
      itemType: "MATERIAL_ITEM",
      itemCategory: "Panel Kayu",
      name: "Multipleks 18mm",
      unit: "lembar",
      defaultClientPrice: 350000,
      defaultInternalCost: -1,
    });

    expect(parsed.success).toBe(false);
  });

  it("menolak minimum stock negatif", () => {
    const parsed = updateMaterialInventoryDefaultsSchema.safeParse({
      materialInventoryId: INVENTORY_ID,
      minimumStock: -1,
      averageCost: 250000,
      lastPurchasePrice: 250000,
    });

    expect(parsed.success).toBe(false);
  });

  it("menolak lokasi inventory duplikat saat membuat material", () => {
    const inventoryDefault = { inventoryLocationId: LOCATION_ID, minimumStock: 5, lastPurchasePrice: 250000 };
    const parsed = createMaterialWithInventoryDefaultsSchema.safeParse({
      categoryId: CATEGORY_ID,
      name: "Multipleks 18mm",
      unit: "lembar",
      inventoryDefaults: [inventoryDefault, inventoryDefault],
    });
    expect(parsed.success).toBe(false);
  });
});
