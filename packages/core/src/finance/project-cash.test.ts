import { describe, expect, test } from "bun:test";
import {
  clientInvoicePaidCents,
  projectClientReceiptsCents,
  projectMarginCash,
} from "./project-cash";

describe("project cash uses actual receipts and canonical paid cost in cents", (): void => {
  test("sums repeated fractional receipts without floating point drift", (): void => {
    const invoices = [
      {
        payments: [
          { amountPaid: "20.15" },
          ...Array.from({ length: 31 }, () => ({ amountPaid: "0.01" })),
        ],
      },
      { payments: [{ amountPaid: "0.10" }, { amountPaid: "0.20" }] },
    ];
    expect(clientInvoicePaidCents(invoices[0]!)).toBe(2046n);
    expect(projectClientReceiptsCents(invoices)).toBe(2076n);
    expect(projectMarginCash(invoices, 20.1)).toEqual({
      received: 20.76,
      paid: 20.1,
      position: 0.66,
    });
  });

  test("keeps actual receipts on void documents and preserves a valid zero", (): void => {
    const invoices = [{ status: "VOID", payments: [{ amountPaid: "0.25" }] }];
    expect(projectMarginCash(invoices, 0.75)).toEqual({
      received: 0.25,
      paid: 0.75,
      position: -0.5,
    });
    expect(projectMarginCash([], 0)).toEqual({ received: 0, paid: 0, position: 0 });
  });
});
