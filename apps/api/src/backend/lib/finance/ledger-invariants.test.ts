import { describe, expect, test } from "bun:test";

import {
  evaluateBankBalanceMatchesLedger,
  evaluateBudgetAllocations,
  evaluateCompletedVendorPaymentsHaveCashEntry,
  evaluateEveryLedgerEntryHasAudit,
  evaluateInventoryMatchesMovements,
  evaluateStockMovementsHaveDirection,
  type MovementRow,
} from "./ledger-invariants";

/**
 * Setiap invarian diuji dua arah: ia diam untuk data yang sehat, dan ia
 * mengeluh untuk kerusakan yang persis pernah terjadi atau paling mungkin
 * terjadi. Yang kedua yang penting — pemeriksa yang tidak pernah terbukti
 * menangkap apa pun tidak lebih terpercaya daripada tidak ada pemeriksa.
 */

function movement(overrides: Partial<MovementRow> = {}): MovementRow {
  return {
    id: "mov-1",
    materialId: "mat-1",
    locationId: "loc-1",
    movementType: "GOODS_RECEIPT",
    direction: "IN",
    quantity: "10.00",
    ...overrides,
  };
}

describe("I1 saldo rekening sama dengan buku besar", () => {
  const account = { id: "acc-1", name: "BCA", balance: "94000000.00" };

  test("diam saat saldo sama dengan jumlah bersih ledger", () => {
    const result = evaluateBankBalanceMatchesLedger(
      [account],
      [
        { bankAccountId: "acc-1", type: "INFLOW", amount: "92000000.00" },
        { bankAccountId: "acc-1", type: "INFLOW", amount: "2000000.00" },
      ],
    );

    expect(result.violations).toEqual([]);
    expect(result.checked).toBe(1);
  });

  test("menangkap saldo yang bergerak tanpa baris ledger", () => {
    const result = evaluateBankBalanceMatchesLedger(
      [account],
      [{ bankAccountId: "acc-1", type: "INFLOW", amount: "92000000.00" }],
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].expected).toBe("92000000.00");
    expect(result.violations[0].actual).toBe("94000000.00");
    expect(result.violations[0].detail).toContain("2000000.00");
  });

  test("mengurangi OUTFLOW, bukan menjumlahkannya", () => {
    const result = evaluateBankBalanceMatchesLedger(
      [{ id: "acc-1", name: "BCA", balance: "3000000.00" }],
      [
        { bankAccountId: "acc-1", type: "INFLOW", amount: "5000000.00" },
        { bankAccountId: "acc-1", type: "OUTFLOW", amount: "2000000.00" },
      ],
    );

    expect(result.violations).toEqual([]);
  });

  test("rekening tanpa satu pun transaksi harus bersaldo nol", () => {
    const result = evaluateBankBalanceMatchesLedger(
      [{ id: "acc-2", name: "Kas Kecil", balance: "500000.00" }],
      [],
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].expected).toBe("0.00");
  });

  test("tidak kehilangan presisi pada nominal besar dengan sen", () => {
    // Float akan menggeser angka ini; bigint sen tidak.
    const result = evaluateBankBalanceMatchesLedger(
      [{ id: "acc-1", name: "BCA", balance: "9007199254.75" }],
      [{ bankAccountId: "acc-1", type: "INFLOW", amount: "9007199254.75" }],
    );

    expect(result.violations).toEqual([]);
  });
});

describe("I2 stok tercatat sama dengan pergerakannya", () => {
  test("diam saat masuk dikurangi keluar sama dengan stok", () => {
    const result = evaluateInventoryMatchesMovements(
      [{ id: "inv-1", materialId: "mat-1", locationId: "loc-1", currentStock: "8.00" }],
      [
        movement({ id: "m1", direction: "IN", quantity: "10.00" }),
        movement({ id: "m2", movementType: "USE", direction: "OUT", quantity: "2.00" }),
      ],
    );

    expect(result.violations).toEqual([]);
  });

  test("RESERVE tidak menggeser current_stock", () => {
    const result = evaluateInventoryMatchesMovements(
      [{ id: "inv-1", materialId: "mat-1", locationId: "loc-1", currentStock: "10.00" }],
      [
        movement({ id: "m1", direction: "IN", quantity: "10.00" }),
        movement({ id: "m2", movementType: "RESERVE", direction: "NEUTRAL", quantity: "6.00" }),
      ],
    );

    expect(result.violations).toEqual([]);
  });

  test("menangkap stok yang bergerak tanpa pergerakan tercatat", () => {
    const result = evaluateInventoryMatchesMovements(
      [{ id: "inv-1", materialId: "mat-1", locationId: "loc-1", currentStock: "20.00" }],
      [movement({ direction: "IN", quantity: "10.00" })],
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].expected).toBe("10.00");
    expect(result.violations[0].actual).toBe("20.00");
  });

  test("memisahkan material yang sama di lokasi berbeda", () => {
    const result = evaluateInventoryMatchesMovements(
      [
        { id: "inv-1", materialId: "mat-1", locationId: "loc-1", currentStock: "10.00" },
        { id: "inv-2", materialId: "mat-1", locationId: "loc-2", currentStock: "0.00" },
      ],
      [movement({ locationId: "loc-1", direction: "IN", quantity: "10.00" })],
    );

    expect(result.violations).toEqual([]);
  });
});

describe("I3 alokasi kategori sama dengan rasio atas internal budget", () => {
  const budget = { id: "bud-1", internalBudget: "15300000.00" };

  test("menerima kelima alokasi dataset kontrol runbook", () => {
    // §3.4: 5.814.000 / 4.284.000 / 3.060.000 / 612.000 / 306.000 atas
    // internal budget 15.300.000 — sisanya buffer.
    const result = evaluateBudgetAllocations(
      [budget],
      [
        {
          id: "c1",
          projectBudgetId: "bud-1",
          ratioPercentage: "0.380000",
          allocatedAmount: "5814000.00",
        },
        {
          id: "c2",
          projectBudgetId: "bud-1",
          ratioPercentage: "0.280000",
          allocatedAmount: "4284000.00",
        },
        {
          id: "c3",
          projectBudgetId: "bud-1",
          ratioPercentage: "0.200000",
          allocatedAmount: "3060000.00",
        },
        {
          id: "c4",
          projectBudgetId: "bud-1",
          ratioPercentage: "0.040000",
          allocatedAmount: "612000.00",
        },
        {
          id: "c5",
          projectBudgetId: "bud-1",
          ratioPercentage: "0.020000",
          allocatedAmount: "306000.00",
        },
      ],
    );

    expect(result.violations).toEqual([]);
    expect(result.checked).toBe(5);
  });

  test("menangkap alokasi yang tidak lagi mengikuti rasionya", () => {
    const result = evaluateBudgetAllocations(
      [budget],
      [
        {
          id: "c1",
          projectBudgetId: "bud-1",
          ratioPercentage: "0.380000",
          allocatedAmount: "6000000.00",
        },
      ],
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].expected).toBe("5814000.00");
  });

  test("memaafkan selisih satu sen dari pembulatan", () => {
    const result = evaluateBudgetAllocations(
      [{ id: "bud-1", internalBudget: "10000000.00" }],
      [
        {
          id: "c1",
          projectBudgetId: "bud-1",
          ratioPercentage: "0.333333",
          allocatedAmount: "3333330.01",
        },
      ],
    );

    expect(result.violations).toEqual([]);
  });

  test("menangkap kategori yang menunjuk budget yang tidak ada", () => {
    const result = evaluateBudgetAllocations(
      [],
      [
        {
          id: "c1",
          projectBudgetId: "bud-hilang",
          ratioPercentage: "0.380000",
          allocatedAmount: "5814000.00",
        },
      ],
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].actual).toContain("bud-hilang");
  });
});

describe("I4 setiap entri buku besar punya jejak audit", () => {
  test("diam saat jumlah audit menyamai jumlah entri", () => {
    const result = evaluateEveryLedgerEntryHasAudit(
      [
        { bankAccountId: "acc-1", type: "INFLOW", amount: "1000000.00" },
        { bankAccountId: "acc-1", type: "OUTFLOW", amount: "500000.00" },
      ],
      [
        { action: "INFLOW_BANK_ACCOUNT", targetId: "acc-1", targetTable: "bank_account" },
        { action: "OUTFLOW_BANK_ACCOUNT", targetId: "acc-1", targetTable: "bank_account" },
      ],
    );

    expect(result.violations).toEqual([]);
  });

  test("menangkap entri yang ditulis melewati mutateBalance", () => {
    const result = evaluateEveryLedgerEntryHasAudit(
      [
        { bankAccountId: "acc-1", type: "OUTFLOW", amount: "500000.00" },
        { bankAccountId: "acc-1", type: "OUTFLOW", amount: "700000.00" },
      ],
      [{ action: "OUTFLOW_BANK_ACCOUNT", targetId: "acc-1", targetTable: "bank_account" }],
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].expected).toBe("2 baris audit");
    expect(result.violations[0].actual).toBe("1 baris audit");
  });

  test("tidak menghitung audit tabel lain sebagai pasangan", () => {
    const result = evaluateEveryLedgerEntryHasAudit(
      [{ bankAccountId: "acc-1", type: "INFLOW", amount: "1000000.00" }],
      [{ action: "INFLOW_BANK_ACCOUNT", targetId: "acc-1", targetTable: "project_cost" }],
    );

    expect(result.violations).toHaveLength(1);
  });

  test("tidak tertukar antara arah masuk dan keluar", () => {
    const result = evaluateEveryLedgerEntryHasAudit(
      [{ bankAccountId: "acc-1", type: "OUTFLOW", amount: "500000.00" }],
      [{ action: "INFLOW_BANK_ACCOUNT", targetId: "acc-1", targetTable: "bank_account" }],
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].subject).toContain("OUTFLOW");
  });
});

describe("I5 pergerakan yang mengubah stok punya arah", () => {
  test("RESERVE boleh NEUTRAL", () => {
    const result = evaluateStockMovementsHaveDirection([
      movement({ movementType: "RESERVE", direction: "NEUTRAL" }),
    ]);

    expect(result.violations).toEqual([]);
  });

  test("menangkap USE, WASTE, dan RETURN tanpa arah — cacat yang pernah nyata", () => {
    const result = evaluateStockMovementsHaveDirection([
      movement({ id: "m1", movementType: "USE", direction: "NEUTRAL" }),
      movement({ id: "m2", movementType: "WASTE", direction: "NEUTRAL" }),
      movement({ id: "m3", movementType: "RETURN", direction: "NEUTRAL" }),
    ]);

    expect(result.violations).toHaveLength(3);
    expect(result.violations.map((v) => v.detail)).toEqual([
      "movement_type USE",
      "movement_type WASTE",
      "movement_type RETURN",
    ]);
  });

  test("tipe pergerakan baru dianggap butuh arah sampai terbukti sebaliknya", () => {
    // Ini alasan daftar-larangan: tipe yang belum dikenal gagal ke arah aman.
    const result = evaluateStockMovementsHaveDirection([
      movement({ movementType: "TIPE_BARU_YANG_BELUM_ADA", direction: "NEUTRAL" }),
    ]);

    expect(result.violations).toHaveLength(1);
  });
});

describe("I6 pembayaran vendor selesai punya entri kas", () => {
  test("diam saat pembayaran menunjuk entri kas yang ada", () => {
    const result = evaluateCompletedVendorPaymentsHaveCashEntry(
      [{ id: "vp-1", status: "COMPLETED", cashTransactionId: "ct-1", amountPaid: "5000000.00" }],
      new Set(["ct-1"]),
    );

    expect(result.violations).toEqual([]);
    expect(result.checked).toBe(1);
  });

  test("menangkap pembayaran lunas tanpa uang keluar", () => {
    const result = evaluateCompletedVendorPaymentsHaveCashEntry(
      [{ id: "vp-1", status: "COMPLETED", cashTransactionId: null, amountPaid: "5000000.00" }],
      new Set(),
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].actual).toBe("null");
  });

  test("menangkap rujukan ke entri kas yang sudah tidak ada", () => {
    const result = evaluateCompletedVendorPaymentsHaveCashEntry(
      [
        {
          id: "vp-1",
          status: "COMPLETED",
          cashTransactionId: "ct-hantu",
          amountPaid: "5000000.00",
        },
      ],
      new Set(["ct-1"]),
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].actual).toContain("ct-hantu");
  });

  test("pembayaran yang belum selesai tidak dituntut punya entri kas", () => {
    const result = evaluateCompletedVendorPaymentsHaveCashEntry(
      [
        { id: "vp-1", status: "PENDING", cashTransactionId: null, amountPaid: "5000000.00" },
        { id: "vp-2", status: "PROCESSING", cashTransactionId: null, amountPaid: "3000000.00" },
      ],
      new Set(),
    );

    expect(result.violations).toEqual([]);
    expect(result.checked).toBe(0);
  });
});
