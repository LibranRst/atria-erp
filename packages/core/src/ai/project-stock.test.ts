import { expect, test } from "bun:test";
import { previewProjectStock, projectStockInputSchema } from "./project-stock";
const before = { current: 100, reserved: 70, available: 30, ownReserved: 20, netUsed: 10 };
test("reservation only changes available/committed stock, while use releases its own quota before free stock", () => {
  expect(previewProjectStock("RESERVE", before, 10)).toEqual({
    ...before,
    reserved: 80,
    available: 20,
    ownReserved: 30,
  });
  expect(previewProjectStock("USE", before, 25)).toEqual({
    current: 75,
    reserved: 50,
    available: 25,
    ownReserved: 0,
    netUsed: 35,
  });
  expect(() => previewProjectStock("USE", before, 51)).toThrow("STOCK_RESERVED_FOR_OTHER_PROJECTS");
  expect(() => previewProjectStock("RESERVE", before, 31)).toThrow("INSUFFICIENT_AVAILABLE_STOCK");
});
test("returns cannot invent stock or re-reserve returned units", () => {
  expect(previewProjectStock("RETURN", before, 4)).toEqual({
    ...before,
    current: 104,
    available: 34,
    netUsed: 6,
  });
  expect(() => previewProjectStock("RETURN", before, 11)).toThrow("RETURN_EXCEEDS_PROJECT_USAGE");
  expect(() => previewProjectStock("USE", before, 0.001)).toThrow();
  expect(
    previewProjectStock(
      "RESERVE",
      { current: 0.3, reserved: 0.1, available: 0.2, ownReserved: 0.1, netUsed: 0 },
      0.2,
    ).available,
  ).toBe(0);
});
test("bounded batches reject duplicate inventories, cost sources, non-finite/overprecision inputs and client identities", () => {
  const id = "00000000-0000-4000-8000-000000000001",
    row = { materialId: id, inventoryLocationId: id, quantity: 2, note: "Permintaan proyek" };
  expect(
    projectStockInputSchema.safeParse({ projectId: id, action: "RESERVE", rows: [row] }).success,
  ).toBe(true);
  expect(
    projectStockInputSchema.safeParse({ projectId: id, action: "RESERVE", rows: [row, row] })
      .success,
  ).toBe(false);
  expect(
    projectStockInputSchema.safeParse({
      projectId: id,
      action: "RESERVE",
      rows: Array.from({ length: 21 }, (_, i) => ({
        ...row,
        materialId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      })),
    }).success,
  ).toBe(false);
  for (const quantity of [0, -1, Infinity, 0.001])
    expect(
      projectStockInputSchema.safeParse({
        projectId: id,
        action: "USE",
        rows: [{ ...row, quantity }],
      }).success,
    ).toBe(false);
  expect(
    projectStockInputSchema.safeParse({ projectId: id, action: "USE", userId: id, rows: [row] })
      .success,
  ).toBe(false);
});

test("release frees only own quota without stock/cost changes; waste consumes stock without creating returnable usage", () => {
  expect(previewProjectStock("RELEASE_RESERVATION", before, 12)).toEqual({
    ...before,
    reserved: 58,
    available: 42,
    ownReserved: 8,
  });
  expect(() => previewProjectStock("RELEASE_RESERVATION", before, 21)).toThrow(
    "RELEASE_EXCEEDS_PROJECT_RESERVATION",
  );
  expect(previewProjectStock("WASTE", before, 25)).toEqual({
    current: 75,
    reserved: 50,
    available: 25,
    ownReserved: 0,
    netUsed: 10,
  });
  expect(() => previewProjectStock("WASTE", before, 51)).toThrow(
    "STOCK_RESERVED_FOR_OTHER_PROJECTS",
  );
  const id = "10000000-0000-4000-8000-000000000001",
    row = { materialId: id, inventoryLocationId: id, quantity: 2, note: "rusak" };
  expect(
    projectStockInputSchema.safeParse({ projectId: id, action: "WASTE", rows: [row] }).success,
  ).toBe(false);
  expect(
    projectStockInputSchema.safeParse({
      projectId: id,
      action: "RELEASE_RESERVATION",
      rows: [{ ...row, unitCost: 1 }],
    }).success,
  ).toBe(false);
});

test("existing PostgreSQL GUID identifiers remain valid through the shared manual/AI stock writer", () => {
  const legacy = "77777777-7777-7777-7777-777777777771";
  expect(
    projectStockInputSchema.safeParse({
      projectId: legacy,
      action: "RESERVE",
      rows: [
        {
          materialId: "cccccccc-cccc-cccc-cccc-cccccccccc01",
          inventoryLocationId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01",
          quantity: 2,
          note: "Reservasi fixture lama",
        },
      ],
    }).success,
  ).toBe(true);
  expect(
    projectStockInputSchema.safeParse({ projectId: "bad-id", action: "RESERVE", rows: [] }).success,
  ).toBe(false);
});
