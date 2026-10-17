import { formatShortIdr } from "@atria/core/utils/money";
import { parseNumericToCents } from "@atria/core/finance/money-minor";
import {
  clientInvoicePaidCents as invoicePaidCents,
  projectClientReceiptsCents,
} from "@atria/core/finance/project-cash";
import type { ClientInvoiceItem } from "../types/project-invoices-types";

export function formatShortRp(value: number): string {
  return formatShortIdr(value);
}

export function calculateInvoicePaidAmount(invoice: ClientInvoiceItem): number {
  return Number(invoicePaidCents(invoice)) / 100;
}

export function calculateInvoiceRemaining(invoice: ClientInvoiceItem): number {
  return Number(invoiceRemainingCents(invoice)) / 100;
}

function invoiceRemainingCents(invoice: ClientInvoiceItem): bigint {
  if (invoice.status === "VOID") return 0n;
  const remaining = parseNumericToCents(invoice.amount) - invoicePaidCents(invoice);
  return remaining > 0n ? remaining : 0n;
}

export function calculateInvoiceTotals(invoices: readonly ClientInvoiceItem[]): {
  readonly activeInvoicesCount: number;
  readonly totalInvoiceAmount: number;
  readonly totalPaidAmount: number;
  readonly unpaidAmount: number;
} {
  const activeInvoices = invoices.filter((invoice) => invoice.status !== "VOID");
  const totalInvoiceCents = activeInvoices.reduce(
    (sum, invoice) => sum + parseNumericToCents(invoice.amount),
    0n,
  );
  // A cancelled document does not erase money that was actually received.
  const totalPaidCents = projectClientReceiptsCents(invoices);
  const unpaidCents = activeInvoices.reduce(
    (sum, invoice) => sum + invoiceRemainingCents(invoice),
    0n,
  );

  return {
    activeInvoicesCount: activeInvoices.length,
    totalInvoiceAmount: Number(totalInvoiceCents) / 100,
    totalPaidAmount: Number(totalPaidCents) / 100,
    unpaidAmount: Number(unpaidCents) / 100,
  };
}

export interface InvoiceSettlementStatus {
  readonly activeInvoicesCount: number;
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
  const { activeInvoicesCount, totalInvoiceAmount, totalPaidAmount, unpaidAmount } =
    calculateInvoiceTotals(invoices);
  const activePaidCents = invoices.reduce(
    (sum, invoice) => sum + (invoice.status === "VOID" ? 0n : invoicePaidCents(invoice)),
    0n,
  );
  const unbilledCents =
    parseNumericToCents(contractValue.toFixed(2)) -
    parseNumericToCents(totalInvoiceAmount.toFixed(2));
  const unbilledContractAmount = Number(unbilledCents > 0n ? unbilledCents : 0n) / 100;
  const billedCoverage = contractValue > 0 ? (totalInvoiceAmount / contractValue) * 100 : 0;
  const isFullySettled =
    activeInvoicesCount > 0 &&
    contractValue > 0 &&
    activePaidCents >= parseNumericToCents(contractValue.toFixed(2)) &&
    unpaidAmount <= 0;
  const isCurrentInvoicesSettled =
    activeInvoicesCount > 0 && unpaidAmount <= 0 && !isFullySettled && unbilledContractAmount > 0;

  return {
    activeInvoicesCount,
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
