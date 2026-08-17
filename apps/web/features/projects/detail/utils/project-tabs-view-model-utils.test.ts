import { describe, expect, test } from "bun:test";

import { calculateCashRealization } from "./project-tabs-view-model-utils";

describe("calculateCashRealization", () => {
  // Angka B10 runbook UAT: kontrak Rp17.000.000 diterima penuh, realisasi akrual
  // Rp9.700.000, kas keluar Rp12.700.000. Selisih Rp3.000.000 adalah material
  // yang sudah dibayar tetapi belum dipakai.
  const UAT = {
    totalReceived: 17_000_000,
    paidCost: 12_700_000,
    fallbackSpent: 9_700_000,
  };

  test("reports the cash that actually left the account, not the accrued cost", () => {
    const { totalPaid } = calculateCashRealization(UAT);
    expect(totalPaid).toBe(12_700_000);
  });

  test("keeps the three displayed rows adding up", () => {
    const { totalPaid, cashPosition } = calculateCashRealization(UAT);
    expect(UAT.totalReceived - totalPaid).toBe(cashPosition);
    expect(cashPosition).toBe(4_300_000);
  });

  test("falls back to accrued cost only when no dashboard figure exists", () => {
    const { totalPaid, cashPosition } = calculateCashRealization({
      ...UAT,
      paidCost: undefined,
    });
    expect(totalPaid).toBe(9_700_000);
    expect(cashPosition).toBe(7_300_000);
  });

  test("goes negative when a project has paid out more than it collected", () => {
    const { cashPosition } = calculateCashRealization({
      totalReceived: 5_100_000,
      paidCost: 12_700_000,
      fallbackSpent: 9_700_000,
    });
    expect(cashPosition).toBe(-7_600_000);
  });
});
