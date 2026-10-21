import { parseNumericToCents } from "./money-minor";
import type { ProjectMarginCash } from "../types/project-margin";

interface ReceiptInvoice {
  readonly payments: readonly { readonly amountPaid: string }[];
}

export function clientInvoicePaidCents(invoice: ReceiptInvoice): bigint {
  return invoice.payments.reduce(
    (sum, payment) => sum + parseNumericToCents(payment.amountPaid),
    0n,
  );
}

/** A cancelled invoice does not erase an actual receipt. */
export function projectClientReceiptsCents(invoices: readonly ReceiptInvoice[]): bigint {
  return invoices.reduce((sum, invoice) => sum + clientInvoicePaidCents(invoice), 0n);
}

/** Cash outflow comes from canonical paidCost, never from accrued/consumed cost. */
export function projectMarginCash(
  invoices: readonly ReceiptInvoice[],
  paidCost: number,
): ProjectMarginCash {
  const received = projectClientReceiptsCents(invoices);
  const paid = parseNumericToCents(paidCost.toFixed(2));
  return {
    received: Number(received) / 100,
    paid: Number(paid) / 100,
    position: Number(received - paid) / 100,
  };
}
