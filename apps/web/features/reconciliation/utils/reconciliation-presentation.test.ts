import { describe, expect, test } from "bun:test";

import { cashTransactionNeedsAction, statementRowNeedsAction } from "./reconciliation-presentation";

describe("reconciliation hybrid presentation", () => {
  test("separates actionable Atria records from recorded exceptions", () => {
    expect(cashTransactionNeedsAction({ exceptionReason: null })).toBe(true);
    expect(cashTransactionNeedsAction({ exceptionReason: "Menunggu bukti eksternal" })).toBe(false);
  });

  test("treats a suggested or ambiguous bank match as actionable", () => {
    expect(
      statementRowNeedsAction({ suggestedCashTransactionId: "cash-1", candidateCount: 1 }),
    ).toBe(true);
    expect(statementRowNeedsAction({ suggestedCashTransactionId: null, candidateCount: 2 })).toBe(
      true,
    );
    expect(statementRowNeedsAction({ suggestedCashTransactionId: null, candidateCount: 0 })).toBe(
      false,
    );
  });
});
