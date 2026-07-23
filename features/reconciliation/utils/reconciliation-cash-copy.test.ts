import { describe, expect, test } from "bun:test";

import type { ReconciliationCashTransaction } from "@/app/actions/finance/reconciliation-workspace";
import {
  cashDisplayTitle,
  cashRowMetaCopy,
  cashSourceCopy,
  cashStatusCopy,
} from "./reconciliation-cash-copy";

const BASE_TRANSACTION: ReconciliationCashTransaction = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccc10",
  bankAccountId: "66666666-6666-6666-6666-666666666664",
  bankAccountName: "Kas Kecil PM Siti",
  type: "OUTFLOW",
  amount: 2_500_000,
  description: "Pencairan klaim aksesoris Workshop Cikupa",
  source: null,
  bankReference: "TRF-FLD-0609",
  createdAt: new Date("2026-06-09T10:00:00Z"),
  ageDays: 42,
  exceptionReason: null,
  exceptionAt: null,
  exceptionByName: null,
};

describe("reconciliation cash copy", () => {
  test("shows the original field expense and its project when a source is available", () => {
    const transaction: ReconciliationCashTransaction = {
      ...BASE_TRANSACTION,
      source: {
        label: "Pengeluaran Lapangan",
        projectName: "Sudirman Suites - Penthouse Fit-Out",
        description: "Pembelian lem kayu khusus sintetis & aksesoris bengkel",
      },
    };

    expect(cashDisplayTitle(transaction)).toBe(
      "Pembelian lem kayu khusus sintetis & aksesoris bengkel",
    );
    expect(cashSourceCopy(transaction, "09 Jun 2026")).toBe(
      "Pengeluaran Lapangan · Sudirman Suites - Penthouse Fit-Out",
    );
    expect(cashStatusCopy(transaction)).toBe("Perlu diperiksa · 42 hari");
    expect(cashRowMetaCopy(transaction)).toBe("Dana keluar · 42 hari");
  });

  test("keeps legacy ledger copy when no business source can be resolved", () => {
    expect(cashDisplayTitle(BASE_TRANSACTION)).toBe("Pencairan klaim aksesoris Workshop Cikupa");
    expect(cashSourceCopy(BASE_TRANSACTION, "09 Jun 2026")).toBe("Kas Kecil PM Siti · 09 Jun 2026");
    expect(cashStatusCopy(BASE_TRANSACTION)).toBe("Perlu diperiksa · 42 hari");
  });

  test("keeps direction explicit when a reconciliation exception exists", () => {
    expect(
      cashRowMetaCopy({
        ...BASE_TRANSACTION,
        exceptionReason: "Menunggu bukti bank dari kasir proyek.",
      }),
    ).toBe("Dana keluar · Pengecualian");
  });
});
