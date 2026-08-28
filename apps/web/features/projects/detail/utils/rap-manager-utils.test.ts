import { describe, expect, test } from "bun:test";

import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import type { MaterialOption } from "../types/rap-rab-types";
import {
  applyMaterialToRapForm,
  emptyCategoryPlanForm,
  emptyRapForm,
  getRapManagerDerivedValues,
} from "./rap-manager-utils";

/**
 * Mengunci satu aturan pengadaan: stok gudang yang masih bebas belum menjadi
 * milik proyek ini sampai direservasi, jadi ia tidak boleh mengecilkan
 * kebutuhan pembelian.
 *
 * Cacat yang dijaga di sini pernah nyata — form Tambah Material RAP menampilkan
 * "Perlu dibeli 0" sementara tab Stok proyek membantah dengan "Beli 20" untuk
 * item yang sama, dan angka form-lah yang salah. Perbaikannya (`51c2dde`)
 * sebelumnya hanya dijaga oleh komentar; berkas ini yang membuatnya gagal kalau
 * pengurangan itu kembali.
 */

function materialWithFreeStock(availableStock: number): MaterialOption {
  return {
    id: "material-1",
    name: "Plywood 12mm",
    unit: "lembar",
    lastPurchasePrice: "185000",
    availableStock,
    categoryName: "Kayu",
    inventories: [
      {
        inventoryId: "inv-1",
        locationId: "loc-1",
        locationName: "Gudang Utama",
        currentStock: availableStock,
        reservedStock: 0,
        availableStock,
        averageCost: 185000,
      },
    ],
  };
}

function derive(material: MaterialOption, requiredQuantity: string, bufferQuantity = "0") {
  return getRapManagerDerivedValues({
    rap: null,
    materials: [material],
    categoryPlanItems: [],
    rapForm: {
      ...emptyRapForm,
      materialId: material.id,
      unit: material.unit,
      requiredQuantity,
      bufferQuantity,
      estimatedUnitCost: "185000",
    },
    categoryPlanForm: emptyCategoryPlanForm,
  });
}

describe("kebutuhan pengadaan pada form RAP", () => {
  test("stok gudang bebas tidak mengurangi kebutuhan pembelian", () => {
    const derived = derive(materialWithFreeStock(22), "20");

    expect(derived.formTotalQty).toBe(20);
    expect(derived.formNeedToBuy).toBe(20);
  });

  test("stok bebas tetap ditampilkan sebagai konteks, terpisah dari kebutuhan", () => {
    const derived = derive(materialWithFreeStock(22), "20");

    expect(derived.formAvailableStock).toBe(22);
    expect(derived.formAvailableStock).not.toBe(derived.formNeedToBuy);
  });

  test("buffer ikut dihitung sebagai kebutuhan yang harus diamankan", () => {
    const derived = derive(materialWithFreeStock(50), "20", "5");

    expect(derived.formTotalQty).toBe(25);
    expect(derived.formNeedToBuy).toBe(25);
  });

  test("stok gudang nol memberi kebutuhan yang sama dengan stok berlimpah", () => {
    const kosong = derive(materialWithFreeStock(0), "20");
    const berlimpah = derive(materialWithFreeStock(999), "20");

    expect(kosong.formNeedToBuy).toBe(berlimpah.formNeedToBuy);
  });

  test("form dan projeksi proyek sepakat untuk material yang belum direservasi", () => {
    // Inti cacat lama: dua layar menjawab pertanyaan yang sama dengan angka
    // berbeda. Selama belum ada satu pun pergerakan stok untuk proyek ini,
    // keduanya harus menyebut angka penuh.
    const requiredQuantity = 20;
    const derived = derive(materialWithFreeStock(22), String(requiredQuantity));
    const projection = projectMaterialProjection([], requiredQuantity);

    expect(derived.formNeedToBuy).toBe(projection.needToBuy);
  });

  test("setelah reservasi, projeksi proyek turun sementara form tetap menyebut rencana penuh", () => {
    // Form menjawab "rencana ini butuh berapa", projeksi menjawab "berapa yang
    // belum aman". Keduanya berbeda hanya setelah ada reservasi nyata — dan
    // perbedaan itu benar.
    const projection = projectMaterialProjection(
      [{ movementType: "RESERVE", quantity: 20, materialId: "material-1" }],
      20,
    );

    expect(projection.needToBuy).toBe(0);
    expect(derive(materialWithFreeStock(22), "20").formNeedToBuy).toBe(20);
  });

  test("memilih material berstok bebas memakai sumber campuran, bukan mengubah kebutuhan", () => {
    const form = applyMaterialToRapForm({
      current: emptyRapForm,
      materialId: "material-1",
      materials: [materialWithFreeStock(22)],
    });

    expect(form.source).toBe("STOCK_AND_PURCHASE");
    expect(form.unit).toBe("lembar");
  });

  test("material tanpa stok bebas langsung berstatus pembelian", () => {
    const form = applyMaterialToRapForm({
      current: emptyRapForm,
      materialId: "material-1",
      materials: [materialWithFreeStock(0)],
    });

    expect(form.source).toBe("PURCHASE");
  });
});
