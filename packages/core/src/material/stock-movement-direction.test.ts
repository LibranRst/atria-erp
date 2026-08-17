import { describe, expect, test } from "bun:test";

import { resolveStockMovementDirection } from "./stock-movement-direction";

describe("resolveStockMovementDirection", () => {
  test("marks stock leaving the location as OUT", () => {
    // Pemakaian dan material terbuang mengurangi `current_stock`. Ketika arahnya
    // tersimpan NEUTRAL, buku pergerakan menjumlah lebih besar daripada saldo
    // sebenarnya: 10 masuk + 20 diterima - 8 dipakai menghasilkan stok 22,
    // tetapi ledger membaca 30.
    expect(resolveStockMovementDirection("USE")).toBe("OUT");
    expect(resolveStockMovementDirection("WASTE")).toBe("OUT");
    expect(resolveStockMovementDirection("TRANSFER_OUT")).toBe("OUT");
    expect(resolveStockMovementDirection("GOODS_RECEIPT_REVERSAL")).toBe("OUT");
  });

  test("marks stock entering the location as IN", () => {
    expect(resolveStockMovementDirection("OPENING_BALANCE")).toBe("IN");
    expect(resolveStockMovementDirection("STOCK_IN")).toBe("IN");
    expect(resolveStockMovementDirection("GOODS_RECEIPT")).toBe("IN");
    expect(resolveStockMovementDirection("RETURN")).toBe("IN");
    expect(resolveStockMovementDirection("TRANSFER_IN")).toBe("IN");
  });

  test("keeps reservation neutral because no goods move", () => {
    expect(resolveStockMovementDirection("RESERVE")).toBe("NEUTRAL");
  });

  test("leaves sign-dependent types to their writer", () => {
    // Penyesuaian dan transfer bisa menambah atau mengurangi; penulisnya
    // menentukan arah dari tanda selisih.
    expect(resolveStockMovementDirection("ADJUSTMENT")).toBe("NEUTRAL");
    expect(resolveStockMovementDirection("STOCK_COUNT_ADJUSTMENT")).toBe("NEUTRAL");
    expect(resolveStockMovementDirection("TRANSFER")).toBe("NEUTRAL");
  });

  test("reconciles a full receive-and-use cycle back to the stock balance", () => {
    const movements = [
      { type: "OPENING_BALANCE", quantity: 10 },
      { type: "RESERVE", quantity: 8 },
      { type: "GOODS_RECEIPT", quantity: 20 },
      { type: "USE", quantity: 8 },
      { type: "RETURN", quantity: 1 },
      { type: "WASTE", quantity: 1 },
    ];

    const ledger = movements.reduce((total, movement) => {
      const direction = resolveStockMovementDirection(movement.type);
      if (direction === "IN") return total + movement.quantity;
      if (direction === "OUT") return total - movement.quantity;
      return total;
    }, 0);

    expect(ledger).toBe(22);
  });
});
