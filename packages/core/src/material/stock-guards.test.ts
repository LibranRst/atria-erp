import { describe, expect, test } from "bun:test";

import {
  calculateNetProjectUsage,
  exceedsProjectUsage,
  reversalWouldConsumeReservedStock,
  violatesOtherProjectReservation,
} from "./stock-guards";

describe("calculateNetProjectUsage", () => {
  test("nets returns against usage", () => {
    expect(
      calculateNetProjectUsage([
        { movementType: "USE", quantity: 20 },
        { movementType: "RETURN", quantity: 5 },
      ]),
    ).toBe(15);
  });

  test("ignores movement types that are neither use nor return", () => {
    expect(
      calculateNetProjectUsage([
        { movementType: "USE", quantity: 20 },
        { movementType: "WASTE", quantity: 1 },
        { movementType: "GOODS_RECEIPT", quantity: 40 },
        { movementType: "RESERVE", quantity: 8 },
      ]),
    ).toBe(20);
  });

  test("reports zero when a project has only received stock", () => {
    expect(calculateNetProjectUsage([{ movementType: "GOODS_RECEIPT", quantity: 40 }])).toBe(0);
  });
});

describe("exceedsProjectUsage", () => {
  const USED_15 = [
    { movementType: "USE", quantity: 20 },
    { movementType: "RETURN", quantity: 5 },
  ];

  // Bagian C "Excess return".
  test("blocks a return larger than net usage", () => {
    expect(exceedsProjectUsage({ returnQuantity: 16, movements: USED_15 })).toBe(true);
  });

  test("allows returning exactly what remains used", () => {
    expect(exceedsProjectUsage({ returnQuantity: 15, movements: USED_15 })).toBe(false);
  });

  test("blocks any return when the project never used the material", () => {
    expect(exceedsProjectUsage({ returnQuantity: 1, movements: [] })).toBe(true);
  });
});

describe("violatesOtherProjectReservation", () => {
  // Proyek ini memegang 8 dari 20 yang direservasi; 12 sisanya milik proyek lain.
  test("blocks a movement that would eat into another project's reservation", () => {
    expect(
      violatesOtherProjectReservation({
        nextCurrent: 11,
        reserved: 20,
        ownReserved: 8,
        quantity: 8,
      }),
    ).toBe(true);
  });

  test("allows a movement that leaves other reservations covered", () => {
    expect(
      violatesOtherProjectReservation({
        nextCurrent: 12,
        reserved: 20,
        ownReserved: 8,
        quantity: 8,
      }),
    ).toBe(false);
  });

  test("only releases as much of its own reservation as it actually moved", () => {
    // Bergerak 3 dari reservasi sendiri 8: yang tersisa terjaga tetap 17, bukan 12.
    expect(
      violatesOtherProjectReservation({
        nextCurrent: 16,
        reserved: 20,
        ownReserved: 8,
        quantity: 3,
      }),
    ).toBe(true);
    expect(
      violatesOtherProjectReservation({
        nextCurrent: 17,
        reserved: 20,
        ownReserved: 8,
        quantity: 3,
      }),
    ).toBe(false);
  });
});

describe("reversalWouldConsumeReservedStock", () => {
  // Bagian C "Reserved reversal".
  test("blocks a receipt reversal that would drop stock below reservations", () => {
    expect(
      reversalWouldConsumeReservedStock({
        currentStock: 28,
        reversalQuantity: 9,
        reservedStock: 20,
      }),
    ).toBe(true);
  });

  test("allows a reversal that leaves reservations exactly covered", () => {
    expect(
      reversalWouldConsumeReservedStock({
        currentStock: 28,
        reversalQuantity: 8,
        reservedStock: 20,
      }),
    ).toBe(false);
  });

  test("allows a full reversal when nothing is reserved", () => {
    expect(
      reversalWouldConsumeReservedStock({
        currentStock: 28,
        reversalQuantity: 28,
        reservedStock: 0,
      }),
    ).toBe(false);
  });
});
