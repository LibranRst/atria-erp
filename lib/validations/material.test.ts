import { describe, expect, it } from "bun:test";
import {
  adjustMaterialStockSchema,
  createMaterialSchema,
  reserveMaterialSchema,
  wasteMaterialSchema,
} from "./material";

const MATERIAL_ID = "13131313-1313-1313-1313-131313131301";
const LOCATION_ID = "14141414-1414-1414-1414-141414141401";
const PROJECT_ID = "77777777-7777-7777-7777-777777777771";
const CATEGORY_ID = "12121212-1212-1212-1212-121212121201";

describe("Material control validations", () => {
  it("harus menerima material master dengan data minimal yang valid", () => {
    const parsed = createMaterialSchema.safeParse({
      categoryId: CATEGORY_ID,
      name: "Multipleks 18mm Meranti",
      unit: "lembar",
    });

    expect(parsed.success).toBe(true);
  });

  it("harus menolak reservasi tanpa project ID valid", () => {
    const parsed = reserveMaterialSchema.safeParse({
      materialId: MATERIAL_ID,
      inventoryLocationId: LOCATION_ID,
      projectId: "not-a-project-id",
      quantity: 5,
      note: "Reservasi untuk kitchen set",
    });

    expect(parsed.success).toBe(false);
  });

  it("harus mewajibkan catatan audit panjang untuk stock adjustment", () => {
    const parsed = adjustMaterialStockSchema.safeParse({
      materialId: MATERIAL_ID,
      inventoryLocationId: LOCATION_ID,
      projectId: PROJECT_ID,
      quantity: 1,
      direction: "DECREASE",
      note: "pendek",
    });

    expect(parsed.success).toBe(false);
  });

  it("harus menerima stock adjustment dengan catatan audit jelas", () => {
    const parsed = adjustMaterialStockSchema.safeParse({
      materialId: MATERIAL_ID,
      inventoryLocationId: LOCATION_ID,
      projectId: PROJECT_ID,
      quantity: 1,
      direction: "DECREASE",
      note: "Koreksi hasil stock opname gudang Dekoria",
    });

    expect(parsed.success).toBe(true);
  });

  it("mewajibkan audit note minimal 10 karakter untuk waste", () => {
    expect(wasteMaterialSchema.safeParse({ materialId: MATERIAL_ID, inventoryLocationId: LOCATION_ID, projectId: PROJECT_ID, quantity: 1, note: "rusak" }).success).toBe(false);
    expect(wasteMaterialSchema.safeParse({ materialId: MATERIAL_ID, inventoryLocationId: LOCATION_ID, projectId: PROJECT_ID, quantity: 1, note: "Rusak terkena air saat instalasi" }).success).toBe(true);
  });
});
