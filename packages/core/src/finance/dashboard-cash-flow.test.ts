import { describe, expect, test } from "bun:test";
import {
  buildCashFlowTrend,
  cashFlowMonthRanges,
  classifyCashFlow,
  dashboardCashFlowInputSchema,
  type CashFlowAggregate,
} from "./dashboard-cash-flow";
const now = new Date("2026-01-15T03:00:00Z");
const row = (
  type: string,
  category: string,
  amount: string,
  referenceType: string | null = null,
): CashFlowAggregate => ({ type, category, amount, referenceType, count: 1 });
describe("desktop monthly cash flow", () => {
  test("calendar ranges use Jakarta midnight, cross years and cap the current month", () => {
    const ranges = cashFlowMonthRanges(6, now);
    expect(ranges.map((r) => r.monthKey)).toEqual([
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
    expect(ranges[5]?.start.toISOString()).toBe("2025-12-31T17:00:00.000Z");
    expect(ranges[5]?.end).toEqual(now);
    expect(ranges[4]?.end).toEqual(ranges[5]?.start);
    expect(ranges[5]?.isPartial).toBe(true);
    expect(cashFlowMonthRanges(12, now)).toHaveLength(12);
  });
  test("a boundary at 17 UTC belongs to the next Jakarta calendar month", () => {
    expect(cashFlowMonthRanges(6, new Date("2026-01-31T17:00:00Z"))[5]?.monthKey).toBe("2026-02");
  });
  test("exact cents, legacy directions and exclusion policy are independent of reconciliation", () => {
    const data = buildCashFlowTrend(6, now, [
      [],
      [],
      [],
      [],
      [],
      [
        row("DEBIT", "client_payment", "0.10"),
        row("INFLOW", "owner_capital", "0.20", "manual_cash_movement"),
        row("CREDIT", "bank_fee", "0.01", "manual_cash_movement"),
        row("INFLOW", "opening_balance", "100"),
        row("OUTFLOW", "bank_transfer_out", "50"),
        row("INFLOW", "bank_transfer_in", "50"),
        row("INFLOW", "correction", "10", "manual_cash_movement"),
        row("OUTFLOW", "cash_adjustment", "5", "manual_cash_movement"),
        row("INFLOW", "petty_cash_refill", "20"),
        row("INVALID", "client_payment", "2"),
      ],
    ]);
    expect(data.buckets[5]).toMatchObject({
      cashIn: 0.3,
      cashOut: 0.01,
      net: 0.29,
      isPartial: true,
    });
    expect(data.totalNet).toBe(0.29);
    expect(data.transactionCount).toBe(3);
    expect(data.exclusions.opening).toEqual({ count: 1, amount: 100 });
    expect(data.exclusions.transfer).toEqual({ count: 2, amount: 100 });
    expect(data.exclusions.adjustment).toEqual({ count: 2, amount: 15 });
    expect(data.exclusions.unclassified).toEqual({ count: 2, amount: 22 });
    expect(data.buckets.slice(0, 5).every((r) => r.net === 0)).toBe(true);
  });
  test("transfers are excluded without requiring their counterpart", () => {
    expect(classifyCashFlow({ referenceType: "bank_transfer", category: "other" })).toBe(
      "transfer",
    );
    expect(classifyCashFlow({ referenceType: null, category: "opening_balance" })).toBe("opening");
  });
  test("only bounded windows are accepted", () => {
    expect(dashboardCashFlowInputSchema.parse({}).months).toBe(6);
    expect(dashboardCashFlowInputSchema.safeParse({ months: 120 }).success).toBe(false);
  });
});
