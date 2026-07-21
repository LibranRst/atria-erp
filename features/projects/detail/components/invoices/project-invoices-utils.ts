import { formatShortIdr } from "@/lib/utils/money";
import type { ClientInvoiceItem } from "./project-invoices-types";

export function formatShortRp(value: number): string {
  return formatShortIdr(value);
}

export function calculateInvoicePaidAmount(invoice: ClientInvoiceItem): number {
  return invoice.payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
}

export function calculateInvoiceRemaining(invoice: ClientInvoiceItem): number {
  return Number(invoice.amount) - calculateInvoicePaidAmount(invoice);
}

export function calculateInvoiceTotals(invoices: readonly ClientInvoiceItem[]): {
  readonly totalInvoiceAmount: number;
  readonly totalPaidAmount: number;
  readonly unpaidAmount: number;
} {
  const totalInvoiceAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const totalPaidAmount = invoices.reduce(
    (sum, invoice) => sum + calculateInvoicePaidAmount(invoice),
    0,
  );

  return {
    totalInvoiceAmount,
    totalPaidAmount,
    unpaidAmount: totalInvoiceAmount - totalPaidAmount,
  };
}

export function defaultPaymentDate(): string {
  return new Date().toISOString().split("T")[0];
}
