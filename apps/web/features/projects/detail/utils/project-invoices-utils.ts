import { formatShortIdr } from "@atria/core/utils/money";
import type { ClientInvoiceItem } from "../types/project-invoices-types";

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

export interface InvoiceSettlementStatus {
  readonly totalInvoiceAmount: number;
  readonly totalPaidAmount: number;
  readonly unpaidAmount: number;
  readonly unbilledContractAmount: number;
  readonly billedCoverage: number;
  readonly isFullySettled: boolean;
  readonly isCurrentInvoicesSettled: boolean;
}

export function calculateInvoiceSettlementStatus(
  invoices: readonly ClientInvoiceItem[],
  contractValue: number,
): InvoiceSettlementStatus {
  const { totalInvoiceAmount, totalPaidAmount, unpaidAmount } = calculateInvoiceTotals(invoices);
  const unbilledContractAmount = Math.max(0, contractValue - totalInvoiceAmount);
  const billedCoverage = contractValue > 0 ? (totalInvoiceAmount / contractValue) * 100 : 0;
  const isFullySettled =
    invoices.length > 0 &&
    contractValue > 0 &&
    totalPaidAmount >= contractValue &&
    unpaidAmount <= 0;
  const isCurrentInvoicesSettled =
    invoices.length > 0 &&
    unpaidAmount <= 0 &&
    !isFullySettled &&
    unbilledContractAmount > 0;

  return {
    totalInvoiceAmount,
    totalPaidAmount,
    unpaidAmount,
    unbilledContractAmount,
    billedCoverage,
    isFullySettled,
    isCurrentInvoicesSettled,
  };
}

export function defaultPaymentDate(): string {
  return new Date().toISOString().split("T")[0];
}
