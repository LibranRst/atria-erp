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
