import { fromCents, parseNumericToCents } from "../finance/money-minor";
import { calculateUsedPercentage, getBudgetCategoryStatus } from "./excel-budget";

export type BudgetUsageSource = {
  readonly expenses: readonly {
    readonly amount: string;
    readonly status: string;
    readonly vendorBillId: string | null;
  }[];
  readonly payments: readonly {
    readonly vendorBillId: string;
    readonly status: string;
    readonly amountPaid: string;
  }[];
};
export type BudgetUsageSummary = {
  readonly pendingAmount: string;
  readonly actualAmount: string;
  readonly paidAmount: string;
  readonly remainingAmount: string;
  readonly usedPercentage: string;
  readonly status: "SAFE" | "WATCH" | "CRITICAL" | "OVER_BUDGET";
};
/** Canonical expense usage: pending and consumed are distinct; partial vendor payments are capped. */
export function budgetUsageSummary(
  allocated: string,
  source: BudgetUsageSource,
): BudgetUsageSummary {
  const paidByBill = new Map<string, bigint>();
  for (const p of source.payments)
    if (p.status === "COMPLETED")
      paidByBill.set(
        p.vendorBillId,
        (paidByBill.get(p.vendorBillId) ?? 0n) + parseNumericToCents(p.amountPaid),
      );
  let pending = 0n,
    actual = 0n,
    paid = 0n;
  for (const e of source.expenses) {
    const amount = parseNumericToCents(e.amount);
    if (["SUBMITTED", "VERIFIED"].includes(e.status)) pending += amount;
    if (["APPROVED", "PAID"].includes(e.status)) actual += amount;
    if (e.status === "PAID") paid += amount;
    else if (e.vendorBillId) {
      const settled = paidByBill.get(e.vendorBillId) ?? 0n;
      paid += settled < amount ? settled : amount;
    }
  }
  const used = calculateUsedPercentage(Number(fromCents(actual)), Number(allocated));
  return {
    pendingAmount: fromCents(pending),
    actualAmount: fromCents(actual),
    paidAmount: fromCents(paid),
    remainingAmount: fromCents(parseNumericToCents(allocated) - actual),
    usedPercentage: used.toFixed(4),
    status: getBudgetCategoryStatus(used),
  };
}
