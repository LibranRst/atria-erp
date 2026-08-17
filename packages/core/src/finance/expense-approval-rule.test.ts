import { describe, expect, test } from "bun:test";

import { decideExpenseApproval } from "./expense-approval-rule";

describe("decideExpenseApproval", () => {
  const OPERASIONAL = { allocatedAmount: 612_000, actualAmount: 0 };

  test("stops the request that pushes the category past its allocation", () => {
    // Skenario B7.2: Rp400.000 lalu Rp300.000 pada alokasi Rp612.000.
    const first = decideExpenseApproval({
      ...OPERASIONAL,
      amount: 400_000,
      otherPendingAmount: 0,
    });
    expect(first.isOverrun).toBe(false);
    expect(first.requiresOwnerApproval).toBe(false);

    // Pengajuan kedua diajukan saat yang pertama masih menunggu keputusan.
    // Realisasi masih 0, jadi menilai hanya dari realisasi akan melewatkan
    // pelanggaran ini — bersama-sama keduanya melewati batas Rp88.000.
    const second = decideExpenseApproval({
      ...OPERASIONAL,
      amount: 300_000,
      otherPendingAmount: 400_000,
    });
    expect(second.isOverrun).toBe(true);
    expect(second.requiresOwnerApproval).toBe(true);
  });

  test("counts already-realised spend, not just pending", () => {
    const decision = decideExpenseApproval({
      allocatedAmount: 612_000,
      actualAmount: 400_000,
      otherPendingAmount: 0,
      amount: 300_000,
    });
    expect(decision.isOverrun).toBe(true);
  });

  test("keeps a request inside the allocation approval-free", () => {
    const decision = decideExpenseApproval({
      ...OPERASIONAL,
      amount: 600_000,
      otherPendingAmount: 0,
    });
    expect(decision.isOverrun).toBe(false);
    expect(decision.requiresOwnerApproval).toBe(false);
  });

  test("treats exactly hitting the allocation as still inside it", () => {
    const decision = decideExpenseApproval({
      ...OPERASIONAL,
      amount: 612_000,
      otherPendingAmount: 0,
    });
    expect(decision.isOverrun).toBe(false);
  });

  test("requires approval on amount alone even with budget to spare", () => {
    const decision = decideExpenseApproval({
      allocatedAmount: 100_000_000,
      actualAmount: 0,
      otherPendingAmount: 0,
      amount: 5_000_000,
    });
    expect(decision.isOverrun).toBe(false);
    expect(decision.requiresOwnerApproval).toBe(true);
  });
});
