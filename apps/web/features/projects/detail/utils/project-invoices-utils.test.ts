import { describe, expect, it } from "bun:test";
import {
  calculateInvoicePaidAmount,
  calculateInvoiceRemaining,
  calculateInvoiceSettlementStatus,
  calculateInvoiceTotals,
} from "./project-invoices-utils";
import type { ClientInvoiceItem } from "../types/project-invoices-types";

function mockInvoice(id: string, amount: number, paidAmounts: number[] = []): ClientInvoiceItem {
  return {
    id,
    invoiceNumber: `INV-${id}`,
    stage: "Termin",
    amount: amount.toString(),
    dueDate: new Date("2026-10-01"),
    createdAt: new Date("2026-09-01"),
    status:
      paidAmounts.reduce((a, b) => a + b, 0) >= amount
        ? "PAID"
        : paidAmounts.length > 0
          ? "PARTIALLY_PAID"
          : "UNPAID",
    payments: paidAmounts.map((p, i) => ({
      id: `pay-${id}-${i}`,
      amountPaid: p.toString(),
      paymentDate: new Date("2026-09-10"),
      referenceNumber: `REF-${i}`,
    })),
  };
}

describe("project-invoices-utils", () => {
  it("calculates invoice paid amount and remaining correctly", () => {
    const inv = mockInvoice("1", 100_000_000, [30_000_000, 20_000_000]);
    expect(calculateInvoicePaidAmount(inv)).toBe(50_000_000);
    expect(calculateInvoiceRemaining(inv)).toBe(50_000_000);
  });

  it("calculates invoice totals correctly across multiple invoices", () => {
    const invoices = [
      mockInvoice("1", 50_000_000, [50_000_000]),
      mockInvoice("2", 50_000_000, [20_000_000]),
    ];
    const totals = calculateInvoiceTotals(invoices);
    expect(totals.totalInvoiceAmount).toBe(100_000_000);
    expect(totals.totalPaidAmount).toBe(70_000_000);
    expect(totals.unpaidAmount).toBe(30_000_000);
  });

  it("keeps decimal receipts and remaining cents exact across the entire collection", () => {
    const invoice = mockInvoice("cents", 100.75, [20.15, 0.1, 0.2]);
    const rows = [invoice, mockInvoice("second", 0.3, [0.1, 0.2])];
    expect(calculateInvoicePaidAmount(invoice)).toBe(20.45);
    expect(calculateInvoiceRemaining(invoice)).toBe(80.3);
    expect(calculateInvoiceTotals(rows)).toEqual({
      activeInvoicesCount: 2,
      totalInvoiceAmount: 101.05,
      totalPaidAmount: 20.75,
      unpaidAmount: 80.3,
    });
  });

  it("excludes cancelled invoices from billing and outstanding but preserves actual receipts", () => {
    const cancelled = { ...mockInvoice("cancelled", 100, [30]), status: "VOID" } as const;
    const active = mockInvoice("active", 70, [20]);
    expect(calculateInvoiceRemaining(cancelled)).toBe(0);
    expect(calculateInvoiceTotals([cancelled, active])).toEqual({
      activeInvoicesCount: 1,
      totalInvoiceAmount: 70,
      totalPaidAmount: 50,
      unpaidAmount: 50,
    });
    const status = calculateInvoiceSettlementStatus([cancelled, active], 100);
    expect(status.unbilledContractAmount).toBe(30);
    expect(status.billedCoverage).toBe(70);
  });

  it("does not offset another invoice's outstanding with a legacy overpayment", () => {
    const legacyOverpayment = mockInvoice("legacy", 10, [10.01]);
    expect(calculateInvoiceRemaining(legacyOverpayment)).toBe(0);
    expect(calculateInvoiceTotals([legacyOverpayment, mockInvoice("open", 5)]).unpaidAmount).toBe(
      5,
    );
  });

  describe("calculateInvoiceSettlementStatus", () => {
    it("does not let cancelled receipt history settle an underbilled contract", () => {
      const cancelled = { ...mockInvoice("void", 100, [100]), status: "VOID" } as const;
      const status = calculateInvoiceSettlementStatus(
        [cancelled, mockInvoice("current", 40, [40])],
        100,
      );
      expect(status.totalPaidAmount).toBe(140);
      expect(status.isFullySettled).toBe(false);
      expect(status.isCurrentInvoicesSettled).toBe(true);
      expect(status.unbilledContractAmount).toBe(60);
      expect(calculateInvoiceSettlementStatus([cancelled], 100).isFullySettled).toBe(false);
      expect(calculateInvoiceSettlementStatus([cancelled], 100).isCurrentInvoicesSettled).toBe(
        false,
      );
    });
    it("returns isFullySettled true when 100% contract value is billed and paid", () => {
      const contractValue = 100_000_000;
      const invoices = [
        mockInvoice("1", 50_000_000, [50_000_000]),
        mockInvoice("2", 50_000_000, [50_000_000]),
      ];

      const status = calculateInvoiceSettlementStatus(invoices, contractValue);

      expect(status.isFullySettled).toBe(true);
      expect(status.isCurrentInvoicesSettled).toBe(false);
      expect(status.unpaidAmount).toBe(0);
      expect(status.unbilledContractAmount).toBe(0);
      expect(status.billedCoverage).toBe(100);
      expect(status.totalPaidAmount).toBe(100_000_000);
    });

    it("returns isFullySettled true when invoice amount exceeds contract due to addendum and all is paid", () => {
      const contractValue = 100_000_000;
      const invoices = [
        mockInvoice("1", 100_000_000, [100_000_000]),
        mockInvoice("2", 15_000_000, [15_000_000]),
      ];

      const status = calculateInvoiceSettlementStatus(invoices, contractValue);

      expect(status.isFullySettled).toBe(true);
      expect(status.isCurrentInvoicesSettled).toBe(false);
      expect(status.unpaidAmount).toBe(0);
      expect(status.unbilledContractAmount).toBe(0);
      expect(status.totalPaidAmount).toBe(115_000_000);
    });

    it("returns isCurrentInvoicesSettled true when issued invoices are paid but contract still has unbilled amount", () => {
      const contractValue = 100_000_000;
      const invoices = [
        mockInvoice("1", 30_000_000, [30_000_000]),
        mockInvoice("2", 35_000_000, [35_000_000]),
      ];

      const status = calculateInvoiceSettlementStatus(invoices, contractValue);

      expect(status.isFullySettled).toBe(false);
      expect(status.isCurrentInvoicesSettled).toBe(true);
      expect(status.unpaidAmount).toBe(0);
      expect(status.unbilledContractAmount).toBe(35_000_000);
      expect(status.billedCoverage).toBe(65);
    });

    it("returns both settled flags false when there is unpaid amount on invoices", () => {
      const contractValue = 100_000_000;
      const invoices = [
        mockInvoice("1", 30_000_000, [30_000_000]),
        mockInvoice("2", 35_000_000, [10_000_000]),
      ];

      const status = calculateInvoiceSettlementStatus(invoices, contractValue);

      expect(status.isFullySettled).toBe(false);
      expect(status.isCurrentInvoicesSettled).toBe(false);
      expect(status.unpaidAmount).toBe(25_000_000);
      expect(status.unbilledContractAmount).toBe(35_000_000);
    });

    it("returns false flags when no invoices exist", () => {
      const status = calculateInvoiceSettlementStatus([], 100_000_000);
      expect(status.isFullySettled).toBe(false);
      expect(status.isCurrentInvoicesSettled).toBe(false);
      expect(status.unpaidAmount).toBe(0);
      expect(status.unbilledContractAmount).toBe(100_000_000);
      expect(status.billedCoverage).toBe(0);
    });
  });
});
