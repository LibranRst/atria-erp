import { describe, expect, test } from "bun:test";
import { projectMaterialProjection } from "./project-material-projection";

describe("project material projection", () => {
  test("does not count received stock again when the same units are reserved", () => {
    const projection = projectMaterialProjection(
      [
        { movementType: "GOODS_RECEIPT", quantity: 10 },
        { movementType: "RESERVE", quantity: 10 },
        { movementType: "USE", quantity: 6 },
      ],
      10,
    );
    expect(projection).toMatchObject({
      boughtQuantity: 10,
      reservedQuantity: 4,
      usedQuantity: 6,
      leftoverQuantity: 4,
      securedQuantity: 10,
      needToBuy: 0,
    });
  });

  test("waste consumes reservations and creates a replacement shortage", () => {
    const projection = projectMaterialProjection(
      [
        { movementType: "GOODS_RECEIPT", quantity: 10 },
        { movementType: "RESERVE", quantity: 10 },
        { movementType: "USE", quantity: 6 },
        { movementType: "WASTE", quantity: 2 },
      ],
      10,
    );
    expect(projection).toMatchObject({
      reservedQuantity: 2,
      usedQuantity: 6,
      wasteQuantity: 2,
      leftoverQuantity: 2,
      securedQuantity: 8,
      needToBuy: 2,
    });
  });

  test("return reverses usage but does not silently re-secure project stock", () => {
    const projection = projectMaterialProjection(
      [
        { movementType: "GOODS_RECEIPT", quantity: 10 },
        { movementType: "RESERVE", quantity: 10 },
        { movementType: "USE", quantity: 6 },
        { movementType: "RETURN", quantity: 2 },
      ],
      10,
    );
    expect(projection).toMatchObject({
      reservedQuantity: 4,
      usedQuantity: 4,
      returnedQuantity: 2,
      leftoverQuantity: 4,
      securedQuantity: 8,
      needToBuy: 2,
    });
  });

  test("usage before a later reservation does not consume that reservation", () => {
    const projection = projectMaterialProjection(
      [
        { movementType: "USE", quantity: 5 },
        { movementType: "RESERVE", quantity: 10 },
      ],
      15,
    );
    expect(projection.reservedQuantity).toBe(10);
    expect(projection.securedQuantity).toBe(15);
    expect(projection.needToBuy).toBe(0);
  });
});

describe("free warehouse stock is not secured stock", () => {
  // Regresi: form RAP dahulu mengurangkan stok gudang bebas dari kebutuhan,
  // menampilkan "Perlu dibeli 0" padahal daftar RAP langsung menyatakan
  // "Beli 20" untuk item yang sama. Stok bebas milik gudang, bukan proyek.
  test("counts nothing as secured before the project reserves or receives", () => {
    const projection = projectMaterialProjection([], 20);
    expect(projection.securedQuantity).toBe(0);
    expect(projection.needToBuy).toBe(20);
  });

  test("only a reservation turns warehouse stock into secured stock", () => {
    const projection = projectMaterialProjection([{ movementType: "RESERVE", quantity: 20 }], 20);
    expect(projection.reservedQuantity).toBe(20);
    expect(projection.needToBuy).toBe(0);
  });
});

test("released reservation history stays released after later reserve/use/waste", () => {
  expect(
    projectMaterialProjection(
      [
        { movementType: "RESERVE", quantity: 10 },
        { movementType: "RELEASE_RESERVATION", quantity: 4 },
        { movementType: "USE", quantity: 2 },
        { movementType: "WASTE", quantity: 1 },
      ],
      10,
    ),
  ).toMatchObject({
    reservedQuantity: 3,
    usedQuantity: 2,
    wasteQuantity: 1,
    securedQuantity: 5,
    needToBuy: 5,
  });
});
