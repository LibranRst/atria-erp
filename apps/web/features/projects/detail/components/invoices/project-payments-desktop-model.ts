import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  calculateInvoicePaidAmount,
  calculateInvoiceRemaining,
} from "../../utils/project-invoices-utils";
import type { ClientInvoiceItem, InvoicePaymentItem } from "../../types/project-invoices-types";

export type ProjectPaymentsView = "invoices" | "receipts";
export interface ProjectReceiptRow extends InvoicePaymentItem {
  readonly invoice: ClientInvoiceItem;
}
export interface ProjectPaymentsQuery {
  readonly search: string;
  readonly status: string;
  readonly date: string;
  readonly sort: string;
  readonly direction: "ascending" | "descending";
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
}

const jakartaMonth = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  timeZone: "Asia/Jakarta",
});
function monthKey(value: Date): string {
  const parts = jakartaMonth.formatToParts(value);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}
function matchesMonth(value: Date, filter: string, now: Date): boolean {
  if (filter !== "this-month" && filter !== "last-month") return true;
  const current = monthKey(now);
  const [year = "0", month = "1"] = current.split("-");
  const target =
    filter === "last-month"
      ? monthKey(new Date(Date.UTC(Number(year), Number(month) - 2, 15)))
      : current;
  return monthKey(new Date(value)) === target;
}
export function invoiceStageLabel(stage: string | undefined): string {
  if (!stage?.trim()) return "Termin klien";
  return formatBusinessLabel(stage);
}
const jakartaDay = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Jakarta",
});
function calendarDay(value: Date): string {
  const parts = jakartaDay.formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((kind) => parts.find((part) => part.type === kind)?.value ?? "")
    .join("-");
}
/** Attention is presentation-only; legacy invoice status is not rewritten. */
export function projectInvoiceDisplayStatus(
  invoice: ClientInvoiceItem,
  now: Date = new Date(),
): ClientInvoiceItem["status"] {
  if (invoice.status === "VOID" || invoice.status === "PAID") return invoice.status;
  if (calculateInvoiceRemaining(invoice) <= 0) return "PAID";
  if (calendarDay(invoice.dueDate) < calendarDay(now)) return "OVERDUE";
  return calculateInvoicePaidAmount(invoice) > 0 ? "PARTIALLY_PAID" : "UNPAID";
}
export function invoiceStatusLabel(status: ClientInvoiceItem["status"]): string {
  const labels: Record<ClientInvoiceItem["status"], string> = {
    UNPAID: "Belum dibayar",
    PARTIALLY_PAID: "Sebagian",
    PAID: "Lunas",
    OVERDUE: "Terlambat",
    VOID: "Dibatalkan",
  };
  return labels[status];
}
export function projectReceiptRows(
  invoices: readonly ClientInvoiceItem[],
): readonly ProjectReceiptRow[] {
  return invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => ({ ...payment, invoice })),
  );
}
export function filterProjectInvoices(
  invoices: readonly ClientInvoiceItem[],
  query: Pick<ProjectPaymentsQuery, "search" | "status" | "date">,
  now: Date = new Date(),
): readonly ClientInvoiceItem[] {
  const search = query.search.trim().toLocaleLowerCase("id-ID");
  return invoices.filter(
    (invoice) =>
      (query.status === "all" ||
        projectInvoiceDisplayStatus(invoice, now) === query.status ||
        (query.status === "active" && invoice.status !== "VOID")) &&
      matchesMonth(invoice.dueDate, query.date, now) &&
      (!search ||
        [
          invoice.invoiceNumber,
          invoiceStageLabel(invoice.stage),
          invoiceStatusLabel(projectInvoiceDisplayStatus(invoice, now)),
        ].some((value) => value.toLocaleLowerCase("id-ID").includes(search))),
  );
}
export function filterProjectReceipts(
  receipts: readonly ProjectReceiptRow[],
  query: Pick<ProjectPaymentsQuery, "search" | "date">,
  now: Date = new Date(),
): readonly ProjectReceiptRow[] {
  const search = query.search.trim().toLocaleLowerCase("id-ID");
  return receipts.filter(
    (receipt) =>
      matchesMonth(receipt.paymentDate, query.date, now) &&
      (!search ||
        [
          receipt.referenceNumber,
          receipt.invoice.invoiceNumber,
          invoiceStageLabel(receipt.invoice.stage),
        ].some((value) => value.toLocaleLowerCase("id-ID").includes(search))),
  );
}
/** Replace only this collection's controls; sibling views, project tabs and hash stay intact. */
export function projectPaymentsQueryUrl(
  current: string,
  kind: ProjectPaymentsView,
  patch: Partial<ProjectPaymentsQuery>,
): string {
  const url = new URL(current);
  const prefix = kind === "invoices" ? "project-invoices-" : "project-receipts-";
  for (const [field, value] of Object.entries({ ...patch, page: patch.page ?? 1 })) {
    url.searchParams.set(`${prefix}${field}`, String(value));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
