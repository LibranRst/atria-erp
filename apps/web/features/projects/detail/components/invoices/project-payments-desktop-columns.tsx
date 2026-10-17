import React from "react";
import type { DesktopTableColumn } from "@/components/ui";
import type { ClientInvoiceItem } from "../../types/project-invoices-types";
import {
  calculateInvoicePaidAmount,
  calculateInvoiceRemaining,
} from "../../utils/project-invoices-utils";
import {
  invoiceStageLabel,
  invoiceStatusLabel,
  projectInvoiceDisplayStatus,
  type ProjectReceiptRow,
} from "./project-payments-desktop-model";
import {
  InvoiceStatus,
  ProjectPaymentAmount,
  paymentDateLabel,
} from "./project-payments-desktop-details";

export const projectInvoiceColumns: readonly DesktopTableColumn<ClientInvoiceItem>[] = [
  {
    key: "invoice",
    label: "Invoice / termin",
    widthPercent: 25,
    sortValue: (row) => row.invoiceNumber,
    render: (row) => (
      <div className="space-y-1">
        <p className="text-sm font-semibold wrap-anywhere">{row.invoiceNumber}</p>
        <p className="text-support text-on-surface-variant">{invoiceStageLabel(row.stage)}</p>
      </div>
    ),
  },
  {
    key: "amount",
    label: "Tagihan",
    widthPercent: 15,
    align: "end",
    sortValue: (row) => Number(row.amount),
    render: (row) => <ProjectPaymentAmount amount={Number(row.amount)} />,
  },
  {
    key: "paid",
    label: "Diterima",
    widthPercent: 15,
    align: "end",
    sortValue: calculateInvoicePaidAmount,
    render: (row) => <ProjectPaymentAmount amount={calculateInvoicePaidAmount(row)} />,
  },
  {
    key: "remaining",
    label: "Sisa",
    widthPercent: 15,
    align: "end",
    sortValue: calculateInvoiceRemaining,
    render: (row) => (
      <ProjectPaymentAmount
        amount={calculateInvoiceRemaining(row)}
        danger={projectInvoiceDisplayStatus(row) === "OVERDUE"}
      />
    ),
  },
  {
    key: "due",
    label: "Jatuh tempo",
    widthPercent: 16,
    sortValue: (row) => new Date(row.dueDate).getTime(),
    render: (row) => <span className="text-support">{paymentDateLabel(row.dueDate)}</span>,
  },
  {
    key: "status",
    label: "Status",
    widthPercent: 14,
    sortValue: (row) => invoiceStatusLabel(projectInvoiceDisplayStatus(row)),
    render: (row) => <InvoiceStatus invoice={row} />,
  },
];
export const projectReceiptColumns: readonly DesktopTableColumn<ProjectReceiptRow>[] = [
  {
    key: "date",
    label: "Diterima",
    widthPercent: 21,
    sortValue: (row) => new Date(row.paymentDate).getTime(),
    render: (row) => <span className="text-sm">{paymentDateLabel(row.paymentDate)}</span>,
  },
  {
    key: "invoice",
    label: "Invoice / termin",
    widthPercent: 30,
    sortValue: (row) => row.invoice.invoiceNumber,
    render: (row) => (
      <div className="space-y-1">
        <p className="text-sm font-semibold wrap-anywhere">{row.invoice.invoiceNumber}</p>
        <p className="text-support text-on-surface-variant">
          {invoiceStageLabel(row.invoice.stage)}
          {row.invoice.status === "VOID" ? " · Invoice dibatalkan" : ""}
        </p>
      </div>
    ),
  },
  {
    key: "reference",
    label: "Referensi",
    widthPercent: 29,
    sortValue: (row) => row.referenceNumber,
    render: (row) => (
      <span className="text-support wrap-anywhere">
        {row.referenceNumber || "Belum dicantumkan"}
      </span>
    ),
  },
  {
    key: "amount",
    label: "Dana diterima",
    widthPercent: 20,
    align: "end",
    sortValue: (row) => Number(row.amountPaid),
    render: (row) => <ProjectPaymentAmount amount={Number(row.amountPaid)} />,
  },
];
